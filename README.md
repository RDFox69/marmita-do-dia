# Marmita em Dia

Aplicação web responsiva para pequenos restaurantes e marmitarias que recebem pedidos próprios, principalmente pelo WhatsApp. O protótipo organiza pedidos, cozinha, clientes e recebimentos em um só lugar.

## Rodar localmente

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Para validar a implementação:

```bash
npm test
npm run build
```

## O que já funciona

- **Pedidos:** cadastro de cliente, telefone, entrega ou retirada, endereço, itens, quantidades, personalizações, adicionais, observações, taxa de entrega e forma/valor recebido.
- **Cozinha:** fila por etapa, com avanço de novo pedido para preparo, pronto, entrega/retirada e conclusão.
- **Clientes:** reutilização de nome, telefone e endereço em pedidos seguintes.
- **Financeiro:** vendas não canceladas separadas do valor efetivamente recebido e do saldo pendente; exportação CSV.
- **Persistência:** pedidos e clientes ficam no `localStorage` do navegador. O primeiro acesso traz dados fictícios de demonstração; não existe servidor, sincronização entre dispositivos, integração com WhatsApp nem autenticação.
- **Qualidade:** regras de domínio testadas com o executor nativo do Node e verificadas no GitHub Actions junto à build do Vite.

> Use dados fictícios para demonstrações. Os registros desta versão ficam somente no navegador e não são uma solução de backup ou armazenamento seguro de dados pessoais.

## Planejamento do produto

O documento [Planejamento do produto](docs/planejamento-do-produto.md) registra a jornada atual e suas oportunidades, wireframes textuais, roteiro de testes com pessoas, backlog com critérios de aceite, duas sprints e um Kanban com limites de WIP. Não foram realizadas entrevistas nem testes com usuários para este protótipo; os campos de resultados estão em branco para preenchimento posterior.

## Desenvolvimento e sprints

O desenvolvimento desta versão reuniu os fluxos essenciais num protótipo navegável. A organização proposta é:

| Sprint                | Foco                                                                                 | Entrega planejada                                                       |
| --------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 1 — Pedido à cozinha  | Registro de pedidos, personalizações, clientes, persistência local e fila de preparo | Criar pedido com total correto e acompanhar até pronto/retirada/entrega |
| 2 — Caixa e validação | Recebimentos, pendências, resumo financeiro, CSV, acessibilidade, testes e CI        | Distinguir vendas de pagamentos e validar os fluxos com usuários        |

As sprints são uma proposta de planejamento, não um histórico de execução. Os itens implementados, pendências de produção e critérios de aceite detalhados estão no [backlog e no plano](docs/planejamento-do-produto.md). Não se atribuem datas, commits ou entrevistas que não ocorreram.

## Uso de Inteligência Artificial

- **Trabalho assistido por IA:** geração e edição do código do protótipo, estruturação dos testes automatizados e rascunho da documentação de produto.
- **Decisões de produto/UX do desenvolvedor:** priorização de pedidos próprios vindos do WhatsApp, fluxo curto de cadastro, cozinha organizada por etapa, reutilização de endereço e separação entre vendas e dinheiro recebido foram requisitos definidos para atender o contexto da Dona Marta.
- **Sugestões revisadas:** estrutura de navegação, cálculos, validações e estados da fila foram comparados com os requisitos e com os testes do domínio antes de serem mantidos.
- **Correções manuais:** valores monetários são calculados em centavos; o total não depende de arredondamento de ponto flutuante. Endereço é exigido para entrega, pagamento acima do pedido é recusado e o caixa exclui pedidos cancelados. Esses comportamentos foram conferidos e cobertos por testes, em vez de aceitar sugestões sem validação.

## Próximos passos antes de produção

Persistência multiusuário e backup, autenticação e autorização, consentimento e política de retenção de dados, integração com WhatsApp, operação multi-dispositivo e validação com usuários reais ainda precisam ser projetados e implementados.
