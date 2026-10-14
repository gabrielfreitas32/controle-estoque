# Levantamento de requisitos

## Contexto

E-commerce que vende o mesmo produto avulso e em kits, em várias contas de marketplaces. O inventário completo é demorado, e o controle de saída era manual. O sistema é de uso interno, usado somente na rede Wi-Fi da empresa, e não se integra aos marketplaces.

## Requisitos funcionais

| ID | Requisito |
|----|-----------|
| RF01 | Cadastrar, editar e excluir produtos (EAN, nome, SKU, localização, estoque mínimo, saldo) |
| RF02 | Registrar entrada de produtos por leitura do EAN |
| RF03 | Registrar saída de produtos por leitura do EAN, com referência opcional (pedido/conta) |
| RF04 | Cadastrar kits como composição de produtos simples |
| RF05 | Dar baixa em todos os componentes ao registrar a saída de um kit |
| RF06 | Calcular a quantidade de kits possíveis a partir do saldo dos componentes |
| RF07 | Alertar produtos com estoque baixo (≤ mínimo) ou zerado |
| RF08 | Manter histórico de todas as movimentações |
| RF09 | Realizar inventário por contagem bipada e aplicar ajustes |
| RF10 | Exportar o estoque em CSV e fazer backup do banco de dados (automático a cada 24 h e por script) |
| RF11 | Autenticar usuários (login e senha) e manter o histórico de quem fez cada movimentação |
| RF12 | Controlar permissões por perfil: administrador (tudo) e operador (bipar e consultar) |
| RF14 | Administrar usuários pela tela (criar, redefinir senha, desativar) e permitir que cada usuário troque a própria senha |
| RF13 | Registrar o preço de custo de cada produto e calcular o valor total do estoque (saldo × custo), visível somente ao administrador |

## Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF01 | Funcionar com leitores de código de barras USB (que simulam teclado) |
| RNF02 | Interface utilizável em desktop e celular, com tema claro/escuro |
| RNF03 | Rodar sem custo de hospedagem, num computador da empresa, e sem dependências externas |
| RNF04 | Dados compartilhados entre computadores da mesma rede local |
| RNF05 | Validar todas as regras no servidor, nunca apenas na tela |
| RNF06 | Guardar senhas com hash e nunca em texto puro |

## Regras de negócio

- **RN01:** o saldo nunca pode ficar negativo; saída maior que o saldo é bloqueada.
- **RN02:** o kit não possui saldo próprio; é montado somente na hora do envio.
- **RN03:** a saída de um kit só é efetuada se todos os componentes tiverem saldo suficiente (operação tudo ou nada).
- **RN04:** EAN é único por produto; SKU, quando informado, também é único.
- **RN05:** o código de um kit não pode coincidir com o EAN ou SKU de um produto.
- **RN06:** um produto usado em algum kit não pode ser excluído.
- **RN07:** toda alteração de saldo gera um registro no histórico, com o usuário responsável.
- **RN08:** apenas administradores cadastram, editam e excluem produtos e kits, ajustam saldo e fazem inventário.
- **RN09:** após 5 tentativas de login erradas, o acesso do aparelho fica bloqueado por 15 minutos.

## RF15 — Estorno de movimentação
- Somente o administrador estorna entradas e saídas, informando um motivo obrigatório (mín. 3 caracteres).
- O estorno gera um novo lançamento (ajuste) ligado ao original; o original permanece no histórico, marcado como estornado. Nada é apagado.
- Saída de kit é estornada por inteiro (todas as linhas do grupo), tudo ou nada.
- Não estorna: ajuste/estorno, lançamento já estornado, produto excluído, entrada cujo saldo já foi consumido (saldo insuficiente).
- Registra quem fez e quando.

## RF16 — HTTPS na rede interna e leitura por câmera
- Com `certs/servidor.crt` e `servidor.key` presentes, o servidor abre também a porta HTTPS (padrão 3443, `HTTPS_PORT`), mantendo o HTTP.
- `npm run gerar-certificado` cria a autoridade local e o certificado (reaproveita a autoridade em execuções seguintes).
- O certificado da autoridade é baixado em `/estoque-ca.crt` (público, sem segredo).
- A tela Bipar tem o botão Câmera: leitor EAN-13/EAN-8/UPC-A próprio (sem bibliotecas), com confirmação em duas leituras e conferência do dígito verificador.

## RF17 — Ranking de vendas (aba Ranking)
- Períodos: hoje (desde 00:00), esta semana (desde segunda-feira) e este mês (desde o dia 1), no horário do computador.
- Mostra unidades vendidas, comparação com o período anterior no mesmo trecho de tempo (ontem até a mesma hora, semana passada até o mesmo dia, mês passado até o mesmo dia), saídas por dia e produtos mais vendidos.
- Base: saídas registradas; saída estornada não conta; entradas e ajustes não contam. Kit conta cada produto que saiu.
- Para o administrador, mostra o valor das saídas a preço de custo (quantidade × custo de cada produto), no total e por produto, e avisa quando há produto sem custo cadastrado. O operador não vê valores.
