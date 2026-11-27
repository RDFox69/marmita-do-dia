# Product Backlog

Histórias priorizadas pelo problema descrito no briefing. A prioridade não equivale a pesquisa feita com usuárias; validar as hipóteses no roteiro de [`testes-usuarios.md`](testes-usuarios.md).

| ID | Prioridade | História de usuário | Critérios de aceitação |
| --- | --- | --- | --- |
| PB-01 | P0 | Como responsável pela marmitaria, quero registrar cliente e pedido rapidamente, para não perder informações no WhatsApp. | Nome/telefone obrigatórios; endereço obrigatório só para entrega; pedido salvo no navegador; validação informa o campo a corrigir. |
| PB-02 | P0 | Como responsável pela cozinha, quero personalizar cada marmita, para montar o pedido sem esquecer preferências. | Sem feijão, sem salada, troca por farofa, adicionais com preço e observação livre são registrados no cartão. |
| PB-03 | P0 | Como responsável, quero ver o total atualizado ao escolher itens e quantidades, para informar o valor correto. | Prato, quantidade e adicionais determinam o total; quantidade inválida ou acima do limite não é aceita. |
| PB-04 | P0 | Como responsável pela cozinha, quero organizar pedidos em etapas, para saber o que preparar, entregar e concluir. | Cada pedido começa aguardando preparo e pode avançar por preparação, pronto, entrega e concluído. |
| PB-05 | P1 | Como responsável, quero reconhecer clientes recorrentes e recuperar o endereço, para reduzir digitação repetida. | Cliente aparece na lista após o primeiro pedido; busca por nome/telefone; seleção preenche nome, telefone e endereço. |
| PB-06 | P1 | Como responsável, quero indicar entrega ou retirada, para coordenar o destino do pedido. | Opção de entrega mostra e exige endereço; retirada não exige endereço e aparece no cartão. |
| PB-07 | P1 | Como responsável, quero registrar método e situação de pagamento, para saber quem ainda precisa pagar. | Pix, dinheiro e cartão são selecionáveis; pago/pendente pode ser atualizado a partir do cartão. |
| PB-08 | P1 | Como responsável, quero consultar faturamento, recebimentos e pendências do dia, para fechar o caixa com clareza. | Faturamento considera pedidos pagos e pendentes; recebido soma somente pedidos pagos por método; valores e contagens são atualizados automaticamente. |
| PB-09 | P1 | Como pessoa que usa o sistema em tela pequena, quero navegar em telas responsivas, para registrar pedidos no balcão ou na cozinha. | Navegação e formulário funcionam em larguras de celular, tablet e desktop; controles têm rótulos e foco visível. |
| PB-10 | P2 | Como responsável, quero validar o fluxo com pessoas da operação, para priorizar melhorias com evidências reais. | Pelo menos duas sessões registradas sem dados pessoais desnecessários; dificuldades e mudanças documentadas após ocorrerem. |

## Definição de pronto

- Regras de negócio cobertas por testes automatizados relevantes.
- Interface valida entradas e comunica falhas de persistência sem alegar sucesso.
- Funciona com mouse e teclado e mantém controles operáveis em tela pequena.
- README/documentação correspondem ao comportamento real.
- Sem dados ou depoimentos fictícios apresentados como evidência.

## Priorização

P0 forma o fluxo essencial do primeiro ciclo: captar pedido e instruções, calcular e colocar na fila. P1 completa a recuperação de clientes, entrega e fechamento. P2 mantém a descoberta contínua para que a evolução do protótipo venha de observação real, não de resultados presumidos.
