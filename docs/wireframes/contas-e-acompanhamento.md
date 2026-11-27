# Esboço — conta, pedido e acompanhamento

Esboço de conteúdo e hierarquia (não representa teste ou tela validada).

## Entrar / criar conta

```text
+------------------------------------------------+
| Marmita em Dia       Comida caseira, em ordem  |
|                                                |
| [ Sou cliente ] [ Sou da equipe ]              |
|                                                |
| Acesse sua conta     [ Entrar ] [ Criar conta ] |
| E-mail               [_______________________] |
| Senha                [_______________________] |
|                                                |
|                [ Entrar → ]                    |
|                                                |
| Equipe: acesso depende de aprovação            |
+------------------------------------------------+
```

O cadastro de equipe cria uma solicitação, não concede permissão. Apenas a administração autoriza o acesso à fila completa.

## Pedido do cliente

```text
+---------------------------------------------+
| Novo pedido                                 |
| 1. Quem vai receber? Nome e telefone        |
| 2. Escolha a marmita   [ prato ▼ ] [ qtd ]  |
|    [ ] Sem feijão  [ ] Sem salada           |
|    [ ] Trocar salada por farofa             |
|    Acompanhamentos e observação              |
| 3. Entrega [●]  Retirada [ ]                |
|    Endereço recuperado / editável            |
|    Pagamento [ Pix ▼ ]                       |
| Total calculado               R$ 00,00        |
|                 [ Enviar pedido ]            |
+---------------------------------------------+
```

## Meus pedidos

```text
+---------------------------------------------+
| Meus pedidos                 [ Fazer pedido ]|
| #042  Em preparação                          |
| 2 × Frango grelhado · Sem feijão · Farofa    |
| Previsão em cerca de 18 min · 12:30          |
| Total R$ 55,80 · Pix pendente                |
+---------------------------------------------+
```

A previsão é uma estimativa operacional, atualizada pela equipe. Os valores do exemplo são ilustrativos.
