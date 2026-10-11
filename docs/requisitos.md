# Levantamento de requisitos

## Contexto

E-commerce que vende o mesmo produto avulso e em kits. O inventário completo é demorado, e o controle de saída era manual. O sistema é de uso interno e não se integra aos marketplaces.

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
| RF10 | Exportar backup (JSON) e estoque (CSV) e restaurar backup |

## Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF01 | Funcionar com leitores de código de barras USB (que simulam teclado) |
| RNF02 | Interface utilizável em desktop e celular, com tema claro/escuro |
| RNF03 | Funcionar sem instalação (abrir `index.html` no navegador) |
| RNF04 | Futuro: dados compartilhados entre computadores e autenticação de usuários |

## Regras de negócio

- **RN01:** o saldo nunca pode ficar negativo; saída maior que o saldo é bloqueada.
- **RN02:** o kit não possui saldo próprio; é montado somente na hora do envio.
- **RN03:** a saída de um kit só é efetuada se todos os componentes tiverem saldo suficiente (operação tudo ou nada).
- **RN04:** EAN é único por produto; SKU, quando informado, também é único.
- **RN05:** o código de um kit não pode coincidir com o EAN ou SKU de um produto.
- **RN06:** um produto usado em algum kit não pode ser excluído.
- **RN07:** toda alteração de saldo gera um registro no histórico.
