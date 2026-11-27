# Marmita em Dia

Um painel leve para pequenos restaurantes organizarem pedidos próprios, a fila da cozinha, clientes e recebimentos — sem depender de um marketplace de delivery.

## Para começar

O backend e as regras de acesso usam **Python 3.12, Flask e SQLite**. Node.js 22.12+ é usado para compilar a interface web.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
npm ci
npm run build
npm run server
```

Abra `http://127.0.0.1:5000`. Para desenvolver a interface com atualização automática, deixe o Flask em execução e, em outro terminal, rode `npm run dev`; o Vite encaminha as chamadas `/api` ao servidor Python. A base SQLite fica em `instance/marmita.sqlite3` e persiste entre reinícios do servidor.

```bash
npm test
python -m unittest discover -s tests -p "test_*.py"
npm run build
```

No PowerShell, o comando `py -3.12` pode ser substituído por `python` se essa versão já estiver no `PATH`.

## O que já funciona

- **Visão geral:** pedidos do dia por etapa, faturamento, pagamentos concluídos e valores pendentes.
- **Novo pedido:** nome e telefone, pratos e quantidades, personalizações, adicionais, observações, retirada ou entrega, endereço, meio e situação do pagamento. O total muda conforme as escolhas.
- **Fila da cozinha:** cinco etapas com cartões que destacam cliente, itens, personalizações, endereço, entrega e pagamento. Um botão avança o pedido; a equipe vê os pedidos ativos, todos ou somente os de hoje.
- **Contas e permissões:** clientes criam conta, enviam pedidos e acompanham status e previsão. A equipe vê todos os pedidos; seu acesso precisa de aprovação administrativa.
- **Clientes:** lista e busca por contatos já registrados; ao iniciar um novo pedido, recupera telefone e endereço.
- **Fechamento de caixa:** faturamento separado do que foi recebido, totais pagos por Pix, dinheiro ou cartão, pendências e contagem de pedidos.
- **Persistência no servidor:** clientes, pedidos, pagamentos e status ficam no SQLite do servidor e são compartilhados entre dispositivos; a interface atualiza a fila automaticamente a cada 15 segundos.

### Regras de negócio

Os preços são mantidos em centavos inteiros e calculados pelo servidor; cada adicional é cobrado por marmita. O faturamento diário soma pedidos pagos e pendentes; os recebimentos por meio incluem apenas pedidos pagos. Os resumos consideram a data local do navegador. A previsão inicial usa uma estimativa provisória de 35 minutos e passa a 20 minutos quando o preparo começa; a equipe pode acrescentar 15 minutos. Essa hipótese ainda precisa ser validada com a rotina real. O pedido não inclui taxa de entrega e não há cancelamento/estorno nesta primeira versão.

### Contas da equipe

O cadastro público cria clientes ou solicitações de acesso à cozinha, mas **nunca concede o papel de operário automaticamente**. Depois que a pessoa cria a conta e solicita acesso, a administração aprova no servidor:

```bash
python -m flask --app app promote-operator equipe@example.com
```

O backend guarda senhas com hash, usa sessão `HttpOnly` e valida token CSRF nas alterações. Clientes só consultam os próprios pedidos; apenas perfis `operator` podem ver a fila completa, avançar etapas, ajustar previsões ou atualizar pagamentos. Defina `SECRET_KEY` forte e `COOKIE_SECURE=true` em produção. A recuperação de senha por e-mail e backups automáticos ainda não fazem parte deste protótipo.

## Descoberta e experiência

- [Jornada atual e oportunidades](docs/jornada-usuario.md)
- [Esboços das telas](docs/wireframes/wireframes.svg)
- [Esboços de conta e acompanhamento](docs/wireframes/contas-e-acompanhamento.md)
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

Os testes usam `node:test` para as regras da interface e `unittest`/Flask test client para autenticação, isolamento de pedidos por cliente, papéis, CSRF, cálculo no servidor, ETA, pagamentos e transições da fila. O workflow [Testes](.github/workflows/tests.yml) executa ambas as suítes e compila a interface em pushes e pull requests.

Para seguir o ciclo TDD ao alterar uma regra: escreva primeiro um caso que falha (`npm test`), implemente a menor alteração para fazê-lo passar e rode os testes novamente; depois refatore mantendo a suíte verde. A suíte cobre os comportamentos centrais, mas os novos cenários devem ser acrescentados junto com cada regra alterada.

## Publicação

O GitHub Pages hospeda somente arquivos estáticos e não executa o backend Flask. Por isso, o workflow de Pages foi removido para evitar substituir a versão publicada por uma interface sem autenticação ou persistência. A URL anteriormente publicada pode continuar mostrando o protótipo antigo, mas não representa esta versão integrada. O projeto inclui [`render.yaml`](render.yaml) para hospedar interface e API no mesmo domínio, com SQLite em disco persistente; esse plano de hospedagem tem custo e precisa ser provisionado pela pessoa responsável antes da publicação. Até esse provisionamento, a nova versão pode ser executada localmente seguindo as instruções acima.

## Uso de Inteligência Artificial

O GitHub Copilot apoiou a conversão do briefing em módulos de interface, regras de pedidos e caixa, API Flask, testes automatizados e documentação de descoberta e planejamento.

- **Decisões de produto da equipe desenvolvedora:** manter poucos passos, deixar personalizações visíveis, separar faturamento de recebimento e usar Python/Flask com SQLite para autenticação, API e persistência compartilhada. HTML/CSS/JavaScript ficam somente na interface executada pelo navegador. O papel da equipe exige aprovação administrativa para impedir autoelevação de acesso.
- **Revisão humana das sugestões:** o fluxo gerado inicialmente encaminhava também pedidos de retirada para “em entrega”; a equipe ajustou a transição para concluir uma retirada sem registrar uma entrega inexistente. A busca de clientes também foi ajustada para preservar endereço de entregas anteriores quando o pedido mais recente foi uma retirada. A conferência da fila revelou que o botão mostrava a ação da etapa seguinte; o rótulo foi corrigido para corresponder ao que a equipe faz na etapa atual.
- **Limitações e correções:** os testes automatizados verificam os cálculos, permissões e fluxo; a estimativa de preparo é provisória e requer validação operacional. A aplicação não guarda dados no navegador como fonte principal: SQLite no servidor é o armazenamento compartilhado.
- **Limites do uso de IA:** o Copilot não entrevistou Dona Marta nem participantes, não executou sessões de usabilidade e não produziu depoimentos. Não há resultados ou comentários atribuídos a usuários neste repositório; os registros aguardam sessões reais.

Esta versão não oferece recuperação de senha por e-mail, taxa de entrega, cancelamento/estorno, exportação nem backup automático. O deploy e os testes com pessoas reais ainda precisam ser feitos antes do uso em produção.

## Pessoas do projeto

- Enzo Yano
- Henrique Hida
- Matheus Schalch

## Histórico

As alterações deste desenvolvimento devem ser registradas em commits incrementais reais. Não foram criados commits históricos fictícios.
