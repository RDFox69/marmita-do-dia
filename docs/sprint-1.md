# Sprint 1 — Gestão de pedidos e cozinha

**Objetivo:** transformar um pedido recebido em um cartão completo, com total e instruções visíveis para a cozinha.

## Itens

- PB-01 — cadastro de pedido e cliente.
- PB-02 — personalizações, adicionais e observação.
- PB-03 — cálculo automático em centavos.
- PB-04 — fila e transição entre cinco etapas.
- PB-05 — consulta e recuperação de clientes recorrentes.

## Critérios de aceitação da Sprint

- É possível cadastrar entrega (com endereço) ou retirada (sem endereço).
- Nome e telefone não podem ficar vazios; quantidade deve ser de 1 a 30.
- O total muda quando quantidade/adicionais mudam e o pedido persiste após recarregar.
- Cartão da fila mostra número, cliente, itens, personalizações, observações e destino.
- A ação avança um pedido por etapa e pedido concluído não avança novamente.
- Testes cobrem cálculo, personalização/adicionais, entradas inválidas, etapa e persistência.

**Andamento:** fluxo implementado no protótipo e testes automatizados adicionados. Ainda falta validar a compreensão e velocidade com participantes reais; ver roteiro em [`testes-usuarios.md`](testes-usuarios.md).
