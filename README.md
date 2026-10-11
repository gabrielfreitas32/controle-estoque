# 📦 Controle de Estoque por EAN

Sistema web simples para controle interno de estoque de um e-commerce. Cada produto é identificado pelo **EAN**, e as entradas e saídas são feitas **bipando** o código de barras. A baixa acontece na hora do envio, e o inventário deixa de ser uma tarefa gigante.

## Problema

Fazer balanço ou inventário completo do estoque demanda muito tempo e atrapalha a operação. Além disso, o mesmo produto é vendido avulso e em kits (ex.: shampoo, condicionador e máscara), o que dificulta saber o saldo real de cada item.

## Funcionalidades

- **Bipar:** entrada e saída por EAN, com som de confirmação/erro, referência opcional (pedido ou conta) e bloqueio de saída sem saldo.
- **Kits virtuais:** o kit não tem saldo próprio; a saída do kit dá baixa em cada componente (montagem só na hora do envio).
- **Estoque:** busca, localização, estoque mínimo, alertas de estoque baixo/zerado e quantidade de kits possíveis.
- **Histórico:** toda movimentação registrada com data, produto, quantidade, saldo após e referência.
- **Inventário rápido:** contagem por bipagem, comparação com o sistema e aplicação de ajustes.
- **Backup:** exportação em JSON e CSV, e restauração por colagem do JSON.

## Como usar

1. Baixe ou clone o repositório.
2. Abra o arquivo `index.html` no navegador (não precisa instalar nada).
3. Na aba **Cadastro**, cadastre os produtos (EAN, nome, saldo) e os kits.
4. Na aba **Bipar**, escolha Entrada ou Saída e bipe os produtos.

Leitores de código de barras USB funcionam como teclado: o cursor precisa estar no campo de bipar.

## Estrutura do projeto

```
controle-estoque/
├── index.html          # estrutura da página
├── css/
│   └── style.css       # estilos (tema claro/escuro)
├── js/
│   ├── utils.js        # funções utilitárias
│   ├── dados.js        # estado, persistência e regras de movimentação
│   ├── bipar.js        # tela de entrada/saída
│   ├── estoque.js      # tela de estoque e kits possíveis
│   ├── cadastro.js     # cadastro de produtos e kits
│   ├── backup.js       # exportar/restaurar dados
│   ├── historico.js    # histórico de movimentações
│   ├── inventario.js   # contagem de inventário
│   └── main.js         # navegação e inicialização (carregar por último)
└── docs/
    ├── requisitos.md
    └── modelo-de-dados.md
```

Os scripts são carregados em ordem pelo `index.html` (sem módulos ES), para que o projeto funcione abrindo o arquivo direto no navegador.

## Limitações atuais

- Os dados ficam no **localStorage do navegador**: não são compartilhados entre computadores e se perdem ao limpar os dados do navegador. Faça backup com frequência.
- Sem login nem controle de permissões.
- Sem integração com marketplaces (decisão do projeto: controle apenas interno).

## Roadmap

- [ ] Banco de dados compartilhado (ex.: PostgreSQL via Supabase ou backend próprio) para uso em vários computadores
- [ ] Login de usuários e perfis de permissão
- [ ] Relatórios (giro, produtos parados, valor em estoque)
- [ ] Impressão de etiquetas
- [ ] Testes automatizados

## Publicar no GitHub Pages

1. Envie o projeto para um repositório no GitHub.
2. Em **Settings > Pages**, escolha **Deploy from a branch**, branch `main` e pasta `/ (root)`.
3. Após alguns minutos o site fica disponível no endereço indicado pelo GitHub.

> Atenção: no GitHub Pages cada navegador continua guardando seus próprios dados (veja Limitações).

## Comandos Git (primeira vez)

```bash
git init
git add .
git commit -m "feat: versão inicial do controle de estoque"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/controle-estoque.git
git push -u origin main
```

## Tecnologias

HTML, CSS e JavaScript puro (sem frameworks nem dependências).

## Licença

MIT. Veja o arquivo [LICENSE](LICENSE).
