# Quadro Kanban

## Limites de trabalho em andamento (WIP)

| Coluna | Limite |
| --- | --- |
| Product Backlog | Até 14 histórias priorizadas; itens sem prioridade ficam no documento do backlog |
| A Fazer | 3 itens |
| Em Desenvolvimento | 2 itens |
| Em Teste | 2 itens |
| Concluído | Sem limite (não é trabalho em andamento) |

Ao atingir o limite de uma coluna, terminar ou ajudar a desbloquear um cartão antes de puxar outro. Reavaliar esses limites após observar o tamanho real da equipe; não são uma medida de velocidade.

## Quadro atual

```mermaid
kanban
  Product Backlog
    PB-10: Validar fluxo com pessoas da operação
  A Fazer
    Provisionar serviço Python com armazenamento persistente
  Em Desenvolvimento
  Em Teste
    Executar smoke test do deploy após o provisionamento
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
    PB-11: Autenticação, sessão e solicitação segura de acesso
    PB-12: Pedido do cliente, status e ETA
    PB-13: Fila compartilhada com controles da equipe
    PB-14: Persistência SQLite e proteção das rotas
```

**Estado real:** a primeira versão local e a implementação do backend estão em andamento neste repositório; o item de publicação depende do provisionamento de hospedagem Python com disco persistente. Testes automatizados são preparados para CI, mas validação manual em dispositivos e sessões com participantes permanecem pendentes. Não há participantes ou resultados fictícios representados no quadro.
