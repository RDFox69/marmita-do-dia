# Protótipo navegável

A aplicação do repositório é o protótipo funcional para as sessões de teste. Não é uma simulação estática: registra pedidos no backend Python/Flask, aplica permissões por conta, permite avançar a fila e atualiza os resumos financeiros.

## Preparar uma sessão

1. Instale Python 3.12, Node.js 22.12+ e as dependências indicadas no README.
2. Rode o Flask (`npm run server`) e, em outro terminal, `npm run dev`; abra a URL local do Vite.
3. Use uma base de teste vazia e contas/dados fictícios. Não reutilize dados de clientes reais.
4. Prepare uma conta de equipe aprovada com `python -m flask --app app promote-operator email@example.com`. A aprovação precisa ser feita pela pessoa responsável.
5. Explique que o protótipo não envia mensagens pelo WhatsApp. Pedidos e contas de teste ficam no banco SQLite do servidor e não devem ser usados em produção sem hospedagem e backups.
6. Leia o roteiro em [`../testes-usuarios.md`](../testes-usuarios.md) e peça consentimento antes de anotar observações.

As atividades e os resultados observados ainda precisam ser coletados. Não atribua a participantes as tarefas de preparação descritas aqui.
