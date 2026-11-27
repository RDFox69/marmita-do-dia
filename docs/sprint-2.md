# Sprint 2 — Entregas e controle financeiro

**Objetivo:** tornar visível o destino do pedido e separar o valor vendido do dinheiro já recebido.

## Itens

- PB-06 — entrega/retirada e recuperação de endereço.
- PB-07 — método e situação do pagamento.
- PB-08 — fechamento do dia e resumo por forma de recebimento.
- PB-09 — uso responsivo no computador, tablet e celular.
- PB-10 — preparação do teste com pelo menos duas pessoas.
- PB-13 — acesso de equipe aprovado pela administração e fila compartilhada.
- PB-14 — persistência no servidor e proteção das rotas.

## Critérios de aceitação da Sprint

- Endereço aparece para pedido de entrega; retirada fica identificada sem exigir endereço.
- Pix, dinheiro e cartão são registrados e uma pendência pode ser marcada como paga.
- Faturamento inclui pedidos pagos e pendentes; recebimentos por forma excluem pendentes.
- Painel indica valores e quantidades pagos e não pagos para a data local.
- Pedidos persistem no servidor e continuam disponíveis após recarregar ou trocar de dispositivo.
- Clientes consultam somente os próprios pedidos; a equipe autorizada consulta a fila completa.
- Mudanças de etapa, pagamento e previsão são aceitas somente para a equipe autorizada.
- O cadastro público não permite que alguém se conceda acesso de operário.
- Roteiro tem cenários de personalização, cliente recorrente, entrega/retirada e formas distintas de pagamento; resultados aguardam sessões reais.

**Andamento:** aplicação Python/Flask, API, persistência SQLite e fluxo de autorização preparados; deploy e provisionamento do servidor ainda pendentes. As sessões com participantes não foram realizadas e não há evidências de uso real ainda.
