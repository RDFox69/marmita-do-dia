# Roteiro de teste com usuárias

**Status:** roteiro pronto; sessões ainda não realizadas. Não há resultados, falas ou dificuldades observadas preenchidos neste documento.

## Objetivo e preparação

Verificar se pessoas que recebem pedidos de comida conseguem registrar e acompanhar pedidos, recuperar um cliente recorrente e distinguir faturamento de pagamentos recebidos. Convide pelo menos duas pessoas que participem da operação de um pequeno negócio de alimentação. Obtenha consentimento, não use dados pessoais reais sem autorização e não ensine a navegação antes da primeira tentativa. O facilitador deve observar e anotar, sem sugerir onde clicar.

**Materiais:** aplicação Flask em execução com banco de teste, computador ou celular/tablet disponível, este roteiro e caneta/notas. Duração sugerida: 20–30 minutos por sessão. Prepare previamente uma conta de equipe aprovada e pelo menos uma conta de cliente com pedidos fictícios; não use contas nem dados reais sem autorização.

## Abertura (ler para participante)

“Estamos testando uma primeira versão de uma ferramenta para organizar pedidos de uma marmitaria. Não estamos testando você. Use como achar mais natural e fale o que estiver pensando. O sistema registra os pedidos de teste no servidor da aplicação e não se conecta ao WhatsApp. Você pode parar quando quiser.”

## Cenários e tarefas

### Pessoa participante 1 — pedido personalizado e caixa (perfil de equipe)

1. Registre um pedido fictício para **Ana Souza**, telefone **(11) 99999-1001**, entrega em **Rua das Flores, 25, Centro**.
2. Escolha **Frango grelhado**, quantidade **2**, marque **Sem feijão** e adicione **Farofa**. Escreva “molho separado” nas observações.
3. Registre pagamento **Pix**, ainda **não pago**.
4. Encontre o pedido na fila e avance uma etapa. Diga o que espera que aconteça a seguir.
5. Abra o fechamento de caixa e explique qual valor está faturado e qual foi recebido.

### Pessoa participante 2 — retorno, endereço e acompanhamento (perfil de cliente)

1. Crie uma conta de teste e solicite uma marmita para entrega. Escolha **Marmita vegetariana**, marque **Sem salada**, selecione **dinheiro** e envie o pedido.
2. Na área “Meus pedidos”, localize o pedido e explique o que entende pela etapa e pela previsão.
3. Faça outro pedido, confira se o endereço anterior foi recuperado e mude para **retirada no local**, **Marmita executiva**, pagamento **cartão**.
4. Após a equipe avançar o pedido e confirmar o pagamento, atualize a página e diga se o andamento está claro.
5. Se o tempo permitir, tente abrir a página de outro cliente e explique o que esperava ver.

## O que observar

- Consegue começar sem orientação? Em qual ponto hesita?
- Consegue distinguir campos obrigatórios e compreender os nomes das opções?
- O total e os adicionais fazem sentido e permanecem visíveis?
- Percebe quando seleciona entrega versus retirada?
- Localiza rapidamente telefone/endereço de cliente recorrente?
- Percebe a etapa do pedido e entende como avançá-la?
- Consegue explicar a diferença entre faturamento, recebido e pendente?
- Texto, contraste, alvo dos botões e rolagem funcionam no dispositivo usado?
- O que a pessoa espera que o sistema faça e não faz?

Não transforme silêncio em aprovação. Registre comportamento observado separadamente de interpretação da equipe.

## Registro das sessões

Preencha somente após a sessão. Use um código para a pessoa; não inclua telefone, endereço ou outro dado identificável.

### Sessão 1

| Campo | Registro |
| --- | --- |
| Data e dispositivo | |
| Perfil relevante (sem identificação pessoal) | |
| Consentimento registrado? | |
| Tarefas concluídas sem ajuda | |
| Dificuldades observadas (com etapa/contexto) | |
| Comentários literais autorizados | |
| Problemas e severidade percebida | |
| Melhorias propostas | |

### Sessão 2

| Campo | Registro |
| --- | --- |
| Data e dispositivo | |
| Perfil relevante (sem identificação pessoal) | |
| Consentimento registrado? | |
| Tarefas concluídas sem ajuda | |
| Dificuldades observadas (com etapa/contexto) | |
| Comentários literais autorizados | |
| Problemas e severidade percebida | |
| Melhorias propostas | |

## Síntese após as sessões

- Padrões observados em ambas as sessões:
- Necessidades diferentes entre as pessoas:
- Alterações priorizadas e justificativa:
- Alterações implementadas (linkar PR/commit real):
- Itens não implementados e motivo:
- Limitações da amostra:
