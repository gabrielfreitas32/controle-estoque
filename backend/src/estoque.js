// Regras de negócio do estoque. Toda alteração de saldo passa por aqui e gera histórico.
const { ErroNegocio } = require('./errors');
const { transacao } = require('./db');

const texto = (v) => String(v ?? '').trim();
const invalido = (msg) => new ErroNegocio(msg, { status: 400, codigo: 'DADO_INVALIDO' });

function inteiro(valor, rotulo, minimo = 0) {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (!Number.isInteger(n) || n < minimo) throw invalido(`${rotulo} deve ser um número inteiro maior ou igual a ${minimo}.`);
  if (n > 1_000_000) throw invalido(`${rotulo} é grande demais.`);
  return n;
}

// Valores em reais viram centavos inteiros (nunca decimais): aceita 12,5  12.50  "1.234,56"  "R$ 12,50".
function centavos(valor, rotulo = 'Preço de custo') {
  if (valor === undefined || valor === null || valor === '') return 0;
  let t = typeof valor === 'number' ? String(valor) : String(valor).replace(/R\$|\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) throw invalido(`${rotulo} inválido. Use o formato 12,50.`);
  const c = Math.round(Number(t) * 100);
  if (c > 100_000_000) throw invalido(`${rotulo} é grande demais.`);
  return c;
}

const alerta = (p) => (p.saldo <= 0 ? 'zerado' : p.estoque_minimo > 0 && p.saldo <= p.estoque_minimo ? 'baixo' : '');
// O custo só é enviado a quem pode vê-lo (administrador).
const paraProduto = (p, comCusto = false) => ({
  ean: p.ean, nome: p.nome, sku: p.sku || '', localizacao: p.localizacao,
  estoque_minimo: p.estoque_minimo, saldo: p.saldo, criado_em: p.criado_em,
  ...(comCusto ? { preco_custo_centavos: p.preco_custo_centavos, valor_estoque_centavos: p.preco_custo_centavos * p.saldo } : {}),
});
const resumo = (p) => ({ ean: p.ean, nome: p.nome, saldo: p.saldo, estoque_minimo: p.estoque_minimo, alerta: alerta(p) });

// Limites do período em horário local: hoje (desde 00:00), semana (desde segunda) e mês (desde o dia 1).
// O período anterior cobre o mesmo tempo já decorrido (ontem até a mesma hora, semana passada até o mesmo dia e hora...).
function periodosRanking(periodo, agora) {
  const d = new Date(agora);
  let inicio, anteriorInicio;
  if (periodo === 'hoje') {
    inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    anteriorInicio = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  } else if (periodo === 'semana') {
    const desdeSegunda = (d.getDay() + 6) % 7;
    inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate() - desdeSegunda);
    anteriorInicio = new Date(d.getFullYear(), d.getMonth(), d.getDate() - desdeSegunda - 7);
  } else if (periodo === 'mes') {
    inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    anteriorInicio = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  } else return null;
  const decorrido = agora - inicio.getTime();
  return {
    periodo,
    inicio: inicio.getTime(),
    fim: agora + 1,
    anteriorInicio: anteriorInicio.getTime(),
    anteriorFim: Math.min(inicio.getTime(), anteriorInicio.getTime() + decorrido + 1),
  };
}

function criarEstoque(db) {
  const sql = {
    produto: db.prepare('SELECT * FROM produtos WHERE ean = ?'),
    produtoPorSku: db.prepare('SELECT * FROM produtos WHERE sku = ?'),
    produtos: db.prepare('SELECT * FROM produtos ORDER BY nome COLLATE NOCASE'),
    inserirProduto: db.prepare('INSERT INTO produtos (ean, nome, sku, localizacao, estoque_minimo, saldo, preco_custo_centavos, criado_em) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'),
    atualizarProduto: db.prepare('UPDATE produtos SET nome = ?, sku = ?, localizacao = ?, estoque_minimo = ?, preco_custo_centavos = ? WHERE ean = ?'),
    atualizarSaldo: db.prepare('UPDATE produtos SET saldo = ? WHERE ean = ?'),
    excluirProduto: db.prepare('DELETE FROM produtos WHERE ean = ?'),
    kit: db.prepare('SELECT * FROM kits WHERE codigo = ?'),
    kits: db.prepare('SELECT * FROM kits ORDER BY nome COLLATE NOCASE'),
    itensDoKit: db.prepare('SELECT i.produto_ean AS ean, p.nome AS nome, i.quantidade AS quantidade FROM kit_itens i JOIN produtos p ON p.ean = i.produto_ean WHERE i.kit_codigo = ? ORDER BY p.nome'),
    kitsComProduto: db.prepare('SELECT DISTINCT kit_codigo FROM kit_itens WHERE produto_ean = ?'),
    inserirKit: db.prepare('INSERT INTO kits (codigo, nome, criado_em) VALUES (?, ?, ?)'),
    inserirItem: db.prepare('INSERT INTO kit_itens (kit_codigo, produto_ean, quantidade) VALUES (?, ?, ?)'),
    excluirKit: db.prepare('DELETE FROM kits WHERE codigo = ?'),
    inserirMov: db.prepare('INSERT INTO movimentacoes (produto_ean, produto_nome, tipo, quantidade, saldo_apos, referencia, observacao, usuario, criado_em, grupo, estorno_de) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    movPorId: db.prepare('SELECT * FROM movimentacoes WHERE id = ?'),
    movsDoGrupo: db.prepare('SELECT * FROM movimentacoes WHERE grupo = ? ORDER BY id'),
    marcarEstornada: db.prepare('UPDATE movimentacoes SET estornado_por = ? WHERE id = ?'),
    totais: db.prepare(`SELECT COUNT(*) AS produtos, COALESCE(SUM(saldo), 0) AS unidades,
      COALESCE(SUM(saldo * preco_custo_centavos), 0) AS valor,
      COALESCE(SUM(CASE WHEN preco_custo_centavos = 0 THEN 1 ELSE 0 END), 0) AS sem_custo,
      COALESCE(SUM(CASE WHEN preco_custo_centavos = 0 AND saldo > 0 THEN 1 ELSE 0 END), 0) AS sem_custo_com_saldo,
      COALESCE(SUM(CASE WHEN saldo <= 0 THEN 1 ELSE 0 END), 0) AS zerados,
      COALESCE(SUM(CASE WHEN saldo > 0 AND estoque_minimo > 0 AND saldo <= estoque_minimo THEN 1 ELSE 0 END), 0) AS baixos
      FROM produtos`),
    maioresValores: db.prepare('SELECT ean, nome, saldo, preco_custo_centavos, saldo * preco_custo_centavos AS valor FROM produtos WHERE saldo * preco_custo_centavos > 0 ORDER BY valor DESC LIMIT 5'),
    movs: db.prepare('SELECT * FROM movimentacoes ORDER BY id DESC LIMIT ?'),
  };

  const localizar = (codigo) => sql.produto.get(codigo) || sql.produtoPorSku.get(codigo);

  // Único ponto que altera saldo: valida (RN01), grava e registra no histórico (RN07).
  function aplicar(produto, delta, tipo, referencia, observacao, usuario, grupo = null, estornoDe = null) {
    const saldo = produto.saldo + delta;
    if (saldo < 0) {
      throw new ErroNegocio(`Sem saldo: ${produto.nome} (saldo ${produto.saldo})`, { status: 409, codigo: 'SEM_SALDO' });
    }
    sql.atualizarSaldo.run(saldo, produto.ean);
    const { lastInsertRowid } = sql.inserirMov.run(produto.ean, produto.nome, tipo, delta, saldo, referencia || '', observacao || '', usuario || '', Date.now(), grupo, estornoDe);
    return { ...produto, saldo, movId: Number(lastInsertRowid) };
  }

  // Um código de kit não pode coincidir com EAN/SKU de produto (RN05).
  function garantirCodigoLivreParaProduto(ean, sku, eanAtual) {
    if (sql.kit.get(ean.toUpperCase())) throw new ErroNegocio('Esse EAN coincide com o código de um kit.', { status: 409, codigo: 'CODIGO_EM_USO' });
    if (sku && sql.kit.get(sku.toUpperCase())) throw new ErroNegocio('Esse SKU coincide com o código de um kit.', { status: 409, codigo: 'CODIGO_EM_USO' });
    const outro = sku && sql.produtoPorSku.get(sku);
    if (outro && outro.ean !== eanAtual) throw new ErroNegocio('Esse SKU já pertence a outro produto.', { status: 409, codigo: 'SKU_EXISTE' });
  }

  return {
    // ---------- Movimentações (bipar) ----------
    movimentar({ tipo, codigo, quantidade, referencia, usuario }) {
      if (tipo !== 'entrada' && tipo !== 'saida') throw invalido('Tipo deve ser "entrada" ou "saida".');
      const qtd = inteiro(quantidade, 'Quantidade', 1);
      codigo = texto(codigo);
      if (!codigo) throw invalido('Informe o EAN ou o código do kit.');
      referencia = texto(referencia).slice(0, 80);

      return transacao(db, () => {
        const kit = sql.kit.get(codigo.toUpperCase());
        if (kit) {
          if (tipo !== 'saida') throw new ErroNegocio('Kit só pode ser usado na saída. Dê entrada nos produtos individuais.', { codigo: 'KIT_SO_SAIDA' });
          const itens = sql.itensDoKit.all(kit.codigo);
          // Tudo ou nada (RN03): confere todos os componentes antes de baixar qualquer um.
          for (const it of itens) {
            const p = sql.produto.get(it.ean);
            const preciso = it.quantidade * qtd;
            if (p.saldo < preciso) {
              throw new ErroNegocio(`Sem saldo para o kit: ${p.nome} (saldo ${p.saldo}, precisa ${preciso})`, { status: 409, codigo: 'SEM_SALDO' });
            }
          }
          const grupo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // liga as linhas do kit (para estornar juntas)
          const afetados = itens.map((it) => aplicar(sql.produto.get(it.ean), -it.quantidade * qtd, 'saida', referencia, `Kit ${kit.codigo}`, usuario, grupo));
          return { alvo: 'kit', produtos: afetados.map(resumo), mensagem: `Saída do kit ${kit.nome} ×${qtd}, baixa em ${afetados.length} produto(s)` };
        }

        const p = localizar(codigo);
        if (!p) throw new ErroNegocio(`EAN não cadastrado: ${codigo}`, { status: 404, codigo: 'NAO_CADASTRADO' });
        if (tipo === 'saida' && p.saldo < qtd) {
          throw new ErroNegocio(`Sem saldo: ${p.nome} (saldo ${p.saldo})`, { status: 409, codigo: 'SEM_SALDO' });
        }
        const novo = aplicar(p, tipo === 'saida' ? -qtd : qtd, tipo, referencia, '', usuario);
        const aviso = alerta(novo) ? ' ⚠ estoque baixo' : '';
        return { alvo: 'produto', produtos: [resumo(novo)], mensagem: `${tipo === 'saida' ? 'Saída' : 'Entrada'}: ${novo.nome} ×${qtd}, saldo ${novo.saldo}${aviso}` };
      });
    },

    // ---------- Produtos ----------
    listarProdutos: (comCusto = false) => sql.produtos.all().map((p) => paraProduto(p, comCusto)),

    // Balanço do estoque. Os valores em dinheiro só vão para o administrador.
    resumoEstoque(comCusto = false) {
      const t = sql.totais.get();
      const r = { produtos: t.produtos, unidades: t.unidades, zerados: t.zerados, baixos: t.baixos };
      if (comCusto) {
        r.valor_total_custo_centavos = t.valor;
        r.produtos_sem_custo = t.sem_custo;
        r.produtos_sem_custo_com_saldo = t.sem_custo_com_saldo;
        r.maiores_valores = sql.maioresValores.all().map((m) => ({
          ean: m.ean, nome: m.nome, saldo: m.saldo, preco_custo_centavos: m.preco_custo_centavos, valor_centavos: m.valor,
        }));
      }
      return r;
    },

    // Ranking de saídas (vendas) por período, no horário do computador. Estornos descontam: a saída estornada não conta.
    ranking(periodo, comCusto = false, agora = Date.now()) {
      const limites = periodosRanking(periodo, agora);
      if (!limites) throw invalido('Período inválido. Use hoje, semana ou mes.');
      const total = (de, ate) => db.prepare("SELECT COALESCE(SUM(-quantidade), 0) AS unidades FROM movimentacoes WHERE tipo = 'saida' AND estornado_por IS NULL AND criado_em >= ? AND criado_em < ?").get(de, ate).unidades;
      const produtos = db.prepare(`SELECT m.produto_ean AS ean, m.produto_nome AS nome, SUM(-m.quantidade) AS unidades, COALESCE(p.preco_custo_centavos, 0) AS custo
        FROM movimentacoes m LEFT JOIN produtos p ON p.ean = m.produto_ean
        WHERE m.tipo = 'saida' AND m.estornado_por IS NULL AND m.criado_em >= ? AND m.criado_em < ?
        GROUP BY m.produto_ean ORDER BY unidades DESC, nome COLLATE NOCASE LIMIT 100`).all(limites.inicio, limites.fim);
      const porDia = db.prepare("SELECT strftime('%Y-%m-%d', criado_em / 1000, 'unixepoch', 'localtime') AS dia, SUM(-quantidade) AS unidades FROM movimentacoes WHERE tipo = 'saida' AND estornado_por IS NULL AND criado_em >= ? AND criado_em < ? GROUP BY dia ORDER BY dia").all(limites.inicio, limites.fim);
      return {
        periodo: limites.periodo,
        inicio: limites.inicio,
        fim: limites.fim,
        unidades: produtos.reduce((s, p) => s + p.unidades, 0),
        produtos_vendidos: produtos.length,
        anterior: { unidades: total(limites.anteriorInicio, limites.anteriorFim) },
        produtos: produtos.map((p) => ({ ean: p.ean, nome: p.nome, unidades: p.unidades, ...(comCusto ? { valor_custo_centavos: p.unidades * p.custo, sem_custo: p.custo === 0 } : {}) })),
        por_dia: porDia,
      };
    },

    criarProduto(dados, usuario) {
      const ean = texto(dados.ean);
      const nome = texto(dados.nome);
      if (!ean || !nome) throw invalido('Informe EAN e nome.');
      if (ean.length > 60 || nome.length > 200) throw invalido('EAN ou nome grande demais.');
      const sku = texto(dados.sku) || null;
      const minimo = inteiro(dados.estoque_minimo ?? 0, 'Estoque mínimo');
      const saldo = inteiro(dados.saldo ?? 0, 'Saldo');
      const custo = centavos(dados.preco_custo);
      return transacao(db, () => {
        if (sql.produto.get(ean)) throw new ErroNegocio('Já existe um produto com esse EAN.', { status: 409, codigo: 'EAN_EXISTE' });
        garantirCodigoLivreParaProduto(ean, sku, null);
        sql.inserirProduto.run(ean, nome, sku, texto(dados.localizacao), minimo, custo, Date.now());
        if (saldo > 0) aplicar(sql.produto.get(ean), saldo, 'entrada', '', 'Saldo inicial', usuario);
        return paraProduto(sql.produto.get(ean), true);
      });
    },

    atualizarProduto(ean, dados, usuario) {
      const nome = texto(dados.nome);
      if (!nome) throw invalido('Informe o nome do produto.');
      const sku = texto(dados.sku) || null;
      const minimo = inteiro(dados.estoque_minimo ?? 0, 'Estoque mínimo');
      const saldo = dados.saldo === undefined ? undefined : inteiro(dados.saldo, 'Saldo');
      const custoNovo = dados.preco_custo === undefined ? undefined : centavos(dados.preco_custo);
      return transacao(db, () => {
        const p = sql.produto.get(ean);
        if (!p) throw new ErroNegocio('Produto não encontrado.', { status: 404, codigo: 'NAO_ENCONTRADO' });
        garantirCodigoLivreParaProduto(ean, sku, ean);
        sql.atualizarProduto.run(nome, sku, texto(dados.localizacao), minimo, custoNovo ?? p.preco_custo_centavos, ean);
        if (saldo !== undefined && saldo !== p.saldo) aplicar(sql.produto.get(ean), saldo - p.saldo, 'ajuste', '', 'Ajuste manual', usuario);
        return paraProduto(sql.produto.get(ean), true);
      });
    },

    excluirProduto(ean) {
      return transacao(db, () => {
        if (!sql.produto.get(ean)) throw new ErroNegocio('Produto não encontrado.', { status: 404, codigo: 'NAO_ENCONTRADO' });
        const usados = sql.kitsComProduto.all(ean).map((k) => k.kit_codigo);
        if (usados.length) throw new ErroNegocio(`Produto usado nos kits: ${usados.join(', ')}. Remova-o dos kits antes.`, { status: 409, codigo: 'PRODUTO_EM_KIT' });
        sql.excluirProduto.run(ean);
        return { ok: true };
      });
    },

    // ---------- Kits ----------
    listarKits: () => sql.kits.all().map((k) => ({
      codigo: k.codigo, nome: k.nome,
      itens: sql.itensDoKit.all(k.codigo).map((i) => ({ ean: i.ean, nome: i.nome, quantidade: i.quantidade })),
    })),

    criarKit({ codigo, nome, itens }) {
      const cod = texto(codigo).toUpperCase();
      const nm = texto(nome);
      if (!cod || !nm) throw invalido('Informe o código e o nome do kit.');
      if (!/^[A-Z0-9._-]{2,40}$/.test(cod)) throw invalido('O código do kit deve ter de 2 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.');
      if (!Array.isArray(itens) || !itens.length || itens.length > 50) throw invalido('Informe de 1 a 50 componentes.');
      const lista = itens.map((i) => ({ ean: texto(i?.ean), quantidade: inteiro(i?.quantidade, 'Quantidade do componente', 1) }));
      if (new Set(lista.map((i) => i.ean)).size !== lista.length) throw invalido('Há componentes repetidos no kit.');
      return transacao(db, () => {
        if (sql.kit.get(cod)) throw new ErroNegocio('Já existe um kit com esse código.', { status: 409, codigo: 'KIT_EXISTE' });
        if (localizar(cod)) throw new ErroNegocio('Esse código já é de um produto (EAN/SKU). Use outro código para o kit.', { status: 409, codigo: 'CODIGO_EM_USO' });
        sql.inserirKit.run(cod, nm, Date.now());
        for (const i of lista) {
          if (!sql.produto.get(i.ean)) throw new ErroNegocio(`Componente não cadastrado: ${i.ean}`, { status: 400, codigo: 'DADO_INVALIDO' });
          sql.inserirItem.run(cod, i.ean, i.quantidade);
        }
        return { codigo: cod, nome: nm, itens: sql.itensDoKit.all(cod) };
      });
    },

    excluirKit(codigo) {
      const cod = texto(codigo).toUpperCase();
      if (!sql.kit.get(cod)) throw new ErroNegocio('Kit não encontrado.', { status: 404, codigo: 'NAO_ENCONTRADO' });
      sql.excluirKit.run(cod);
      return { ok: true };
    },

    // ---------- Inventário ----------
    aplicarInventario(contagens, usuario) {
      if (!Array.isArray(contagens) || !contagens.length || contagens.length > 5000) throw invalido('Envie a lista de contagens.');
      return transacao(db, () => {
        let ajustes = 0;
        const produtos = [];
        for (const c of contagens) {
          const ean = texto(c?.ean);
          const p = sql.produto.get(ean);
          if (!p) throw new ErroNegocio(`Produto não cadastrado: ${ean}`, { status: 404, codigo: 'NAO_CADASTRADO' });
          const contado = inteiro(c.quantidade, 'Quantidade contada');
          if (contado !== p.saldo) {
            produtos.push(resumo(aplicar(p, contado - p.saldo, 'inventario', '', 'Contagem de inventário', usuario)));
            ajustes++;
          }
        }
        return { ajustes, produtos };
      });
    },

    // ---------- Estorno ----------
    // Desfaz uma entrada ou saída (e todas as linhas de uma saída de kit), com motivo, sem apagar o histórico.
    estornar(id, motivo, usuario) {
      id = Number(id);
      motivo = texto(motivo);
      if (motivo.length < 3) throw invalido('Informe o motivo do estorno (pelo menos 3 caracteres).');
      if (motivo.length > 200) throw invalido('O motivo do estorno é longo demais (máximo 200 caracteres).');
      return transacao(db, () => {
        const m = Number.isInteger(id) ? sql.movPorId.get(id) : null;
        if (!m) throw new ErroNegocio('Lançamento não encontrado.', { status: 404, codigo: 'NAO_ENCONTRADO' });
        if (m.estorno_de) throw new ErroNegocio('Esse lançamento já é um estorno e não pode ser estornado.', { status: 409, codigo: 'JA_ESTORNO' });
        if (m.estornado_por) throw new ErroNegocio('Esse lançamento já foi estornado.', { status: 409, codigo: 'JA_ESTORNADO' });
        if (m.tipo !== 'entrada' && m.tipo !== 'saida') {
          throw new ErroNegocio('Só entradas e saídas podem ser estornadas. Ajustes e inventários são corrigidos com uma nova contagem.', { status: 409, codigo: 'TIPO_NAO_ESTORNAVEL' });
        }
        const linhas = (m.grupo ? sql.movsDoGrupo.all(m.grupo) : [m]).filter((l) => !l.estorno_de && !l.estornado_por);
        const afetados = [];
        for (const l of linhas) {
          const p = sql.produto.get(l.produto_ean);
          if (!p) throw new ErroNegocio(`O produto ${l.produto_nome} foi excluído e o lançamento não pode ser estornado.`, { status: 409, codigo: 'PRODUTO_EXCLUIDO' });
          if (p.saldo - l.quantidade < 0) {
            throw new ErroNegocio(`Não dá para estornar: o saldo atual de ${p.nome} (${p.saldo}) é menor que o ${l.tipo === 'entrada' ? 'da entrada' : 'necessário'}. Confira a contagem antes.`, { status: 409, codigo: 'SEM_SALDO' });
          }
          const novo = aplicar(p, -l.quantidade, 'ajuste', l.referencia, `Estorno do lançamento #${l.id}: ${motivo}`, usuario, null, l.id);
          sql.marcarEstornada.run(novo.movId, l.id);
          afetados.push(resumo(novo));
        }
        const o = linhas.length > 1 ? `${linhas.length} linhas do kit` : `${m.produto_nome} ×${Math.abs(m.quantidade)}`;
        return { estornados: linhas.length, produtos: afetados, mensagem: `Estorno feito: ${o}` };
      });
    },

    // ---------- Histórico ----------
    listarMovimentacoes({ busca, limite } = {}) {
      const max = Math.min(Math.max(parseInt(limite, 10) || 100, 1), 500);
      const termo = texto(busca).toLowerCase();
      // Com busca, filtra em JavaScript (respeita acentos) sobre as últimas 3000 movimentações.
      const linhas = sql.movs.all(termo ? 3000 : max);
      const rotulo = { entrada: 'entrada', saida: 'saída saida', ajuste: 'ajuste estorno', inventario: 'inventário inventario' };
      return linhas
        .filter((m) => !termo || [m.produto_nome, m.produto_ean, m.referencia, m.observacao, m.usuario, rotulo[m.tipo]].join(' ').toLowerCase().includes(termo))
        .slice(0, max)
        .map((m) => ({
          id: m.id, t: m.criado_em, tipo: m.tipo, estorno_de: m.estorno_de, estornado_por: m.estornado_por, ean: m.produto_ean, nome: m.produto_nome,
          quantidade: m.quantidade, saldo_apos: m.saldo_apos, referencia: m.referencia, observacao: m.observacao, usuario: m.usuario,
        }));
    },
  };
}

module.exports = { criarEstoque };
