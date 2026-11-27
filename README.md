# Marmita em Dia

Um painel leve para pequenos restaurantes organizarem pedidos próprios, a fila da cozinha, clientes e recebimentos — sem depender de um marketplace de delivery.

## Para começar

Requer Node.js 20.19+ ou 22.12+ (compatível com Vite 7).

```bash
npm install
npm run dev
```

Abra o endereço local mostrado pelo Vite. Os pedidos ficam salvos no `localStorage` do navegador em uso; não há conta, servidor ou sincronização entre dispositivos. Evite limpar os dados do navegador sem antes exportar ou anotar as informações importantes.

```bash
npm test       # regras de negócio e armazenamento
npm run build  # compilação para produção em dist/
npm run preview
```

## O que já funciona

- **Visão geral:** pedidos do dia por etapa, faturamento, pagamentos concluídos e valores pendentes.
- **Novo pedido:** nome e telefone, pratos e quantidades, personalizações, adicionais, observações, retirada ou entrega, endereço, meio e situação do pagamento. O total muda conforme as escolhas.
- **Fila da cozinha:** cinco etapas com cartões que destacam cliente, itens, personalizações, endereço, entrega e pagamento. Um botão avança o pedido.
- **Clientes:** lista e busca por contatos já registrados; ao iniciar um novo pedido, recupera telefone e endereço.
- **Fechamento de caixa:** faturamento separado do que foi recebido, totais pagos por Pix, dinheiro ou cartão, pendências e contagem de pedidos.
- **Persistência local:** pedidos permanecem após recarregar o navegador. Se os dados estiverem indisponíveis ou corrompidos, a aplicação informa o problema sem os sobrescrever.

### Regras de negócio

Os preços são mantidos em centavos inteiros para evitar erros de arredondamento. Cada adicional é cobrado por marmita. O faturamento diário soma pedidos pagos e pendentes; os recebimentos por meio de pagamento incluem apenas pedidos marcados como pagos. Os resumos consideram a data local do navegador. O pedido não inclui taxa de entrega e não há cancelamento/estorno nesta primeira versão.

## Descoberta e experiência

- [Jornada atual e oportunidades](docs/jornada-usuario.md)
- [Esboços das telas](docs/wireframes/wireframes.svg)
- [Protótipo navegável e roteiro](docs/prototipo/README.md)
- [Roteiro e registros em branco para duas sessões](docs/testes-usuarios.md)

Os campos dos testes com usuários estão intencionalmente vazios. Ainda não foram realizadas nem documentadas sessões reais.

## Product Backlog e execução

- [Product Backlog e critérios de aceitação](docs/product-backlog.md)
- [Sprint 1 — Pedidos e cozinha](docs/sprint-1.md)
- [Sprint 2 — Entregas e financeiro](docs/sprint-2.md)
- [Quadro Kanban atual, limites de WIP e diagrama](docs/kanban.md)

### Plano resumido

| Sprint | Objetivo | Entregas |
| --- | --- | --- |
| 1 — Gestão de pedidos e cozinha | Tirar os pedidos do meio das conversas e deixar as instruções visíveis | Cadastro, clientes recorrentes, cálculo, personalizações e fila com cinco etapas |
| 2 — Entregas e controle financeiro | Saber como cada pedido será recebido e quanto entrou no caixa | Retirada/entrega, endereço, forma/situação de pagamento, resumo diário |

O andamento detalhado e as tarefas que aguardam validação com pessoas reais estão no quadro Kanban.

## Testes e automação

Os testes usam o executor nativo `node:test` e cobrem cálculo e limites, adicionais e personalizações, validação de pedidos, transição de etapa, faturamento, recebimentos separados de pendências e armazenamento. O workflow [Testes](.github/workflows/tests.yml) executa os testes e o build em pushes e pull requests.

Para seguir o ciclo TDD ao alterar uma regra: escreva primeiro um caso que falha (`npm test`), implemente a menor alteração para fazê-lo passar e rode os testes novamente; depois refatore mantendo a suíte verde. A suíte cobre os comportamentos centrais, mas os novos cenários devem ser acrescentados junto com cada regra alterada.

## Publicação no GitHub Pages

O workflow [Deploy to GitHub Pages](.github/workflows/pages.yml) testa e publica o app em pushes para `main` e para a branch de publicação, além de permitir execução manual. O endereço do projeto no Pages usa o caminho `/marmita-do-dia/`; localmente, o Vite continua usando a raiz do servidor.

## Uso de Inteligência Artificial

O GitHub Copilot apoiou a conversão do briefing em módulos de interface, regras de pedidos e caixa, testes automatizados e documentação de descoberta e planejamento.

- **Decisões de produto da equipe desenvolvedora:** priorizar poucos passos, deixar personalizações visíveis, separar faturamento de recebimento e usar armazenamento local para manter a primeira versão leve. São escolhas de escopo baseadas no briefing, ainda sem validação com a operação real.
- **Revisão humana das sugestões:** o fluxo gerado inicialmente encaminhava também pedidos de retirada para “em entrega”; a equipe ajustou a transição para concluir uma retirada sem registrar uma entrega inexistente. A busca de clientes também foi ajustada para preservar endereço de entregas anteriores quando o pedido mais recente foi uma retirada.
- **Limitações e correções:** os testes automatizados e a conferência no navegador foram usados para revisar cálculo e fluxo. Uma auditoria de dependências identificou um aviso alto na versão travada de Vite; foi atualizada para uma versão corrigida dentro da faixa já declarada. Preços e dados nos wireframes são exemplos ilustrativos, não observações de clientes.
- **Limites do uso de IA:** o Copilot não entrevistou Dona Marta nem participantes, não executou sessões de usabilidade e não produziu depoimentos. Não há resultados ou comentários atribuídos a usuários neste repositório; os registros aguardam sessões reais.

A primeira versão não tem sincronização em nuvem, taxa de entrega, cancelamento/estorno ou exportação de dados. Essas lacunas devem ser revistas com a equipe e usuárias antes de uma operação de produção.

## Pessoas do projeto

- Enzo Yano
- Henrique Hida
- Matheus Schalch

## Histórico

As alterações deste desenvolvimento devem ser registradas em commits incrementais reais. Não foram criados commits históricos fictícios.
