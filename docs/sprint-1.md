# Sprint 1 — Gestão de pedidos e cozinha

**Objetivo:** transformar um pedido recebido em um cartão completo, com total e instruções visíveis para a cozinha.

## Itens

- PB-01 — cadastro de pedido e cliente.
- PB-02 — personalizações, adicionais e observação.
- PB-03 — cálculo automático em centavos.
- PB-04 — fila e transição entre cinco etapas.
- PB-05 — consulta e recuperação de clientes recorrentes.
- PB-11 — base da autenticação por cliente e papéis.
- PB-12 — pedido de cliente e acompanhamento de preparo.

## Critérios de aceitação da Sprint

- É possível cadastrar entrega (com endereço) ou retirada (sem endereço).
- Nome e telefone não podem ficar vazios; quantidade deve ser de 1 a 30.
- O total muda quando quantidade/adicionais mudam; o servidor valida e persiste o pedido.
- Cartão da fila mostra número, cliente, itens, personalizações, observações e destino.
- A ação avança um pedido por etapa e pedido concluído não avança novamente.
- Testes cobrem cálculo no servidor, personalização/adicionais, entradas inválidas e etapa.

**Andamento:** fluxo e testes automatizados implementados. A validação com participantes reais continua pendente; ver roteiro em [`testes-usuarios.md`](testes-usuarios.md). A publicação do backend requer um serviço Python com armazenamento persistente.
