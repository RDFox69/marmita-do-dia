# Quadro Kanban

## Limites de trabalho em andamento (WIP)

| Coluna | Limite |
| --- | --- |
| Product Backlog | Até 10 itens priorizados; itens sem prioridade ficam no documento do backlog |
| A Fazer | 3 itens |
| Em Desenvolvimento | 2 itens |
| Em Teste | 2 itens |
| Concluído | Sem limite (não é trabalho em andamento) |

Ao atingir o limite de uma coluna, terminar ou ajudar a desbloquear um cartão antes de puxar outro. Reavaliar esses limites após observar o tamanho real da equipe; não são uma medida de velocidade.

## Quadro atual

```mermaid
kanban
  Product Backlog
    Priorizar melhorias somente após observar sessões reais
  A Fazer
    PB-10: Agendar e realizar duas sessões com pessoas da operação
  Em Desenvolvimento
  Em Teste
    Validar fluxo ponta a ponta e acessibilidade em dispositivos reais
  Concluído
    PB-01: Cadastro de pedidos e validação
    PB-02: Personalizações, adicionais e observações
    PB-03: Cálculo do pedido
    PB-04: Fila da cozinha e alteração de etapas
    PB-05: Busca e recuperação de clientes
    PB-06: Entrega e retirada
    PB-07: Pagamentos e pendências
    PB-08: Fechamento diário
    PB-09: Interface responsiva e documentação inicial
```

**Estado real:** implementação e documentação do protótipo estão no repositório. O item em teste cobre a validação técnica e de acessibilidade no dispositivo antes de uma operação real; os testes de usabilidade permanecem pendentes. Não há participantes ou resultados fictícios representados no quadro.
