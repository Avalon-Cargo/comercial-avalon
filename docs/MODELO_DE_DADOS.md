# Modelo de dados

| Tabela | Conteúdo |
|---|---|
| `perfis` | 1:1 com `auth.users` · `papel` gestor/operador · `ativo` |
| `clientes` | empresa, e-mail, fone (upsert por empresa+e-mail) |
| `cotacoes` | protocolo `COT-nnnn`, canal site/manual, status, rota, equipamento, carga |
| `fichas` | versões da ficha interna (`dados` = todos os campos, `resumo` = lucro/margem/regime) |
| `propostas` | número, frete peso, total, itens adicionais, snapshot das condições, canal de envio |
| `parametros` | chave/valor JSON: cascos, taras_kg, seguro, custos_fixos, tributos, margens, antt, condicoes_gerais, empresa |
| `eventos` | trilha de auditoria por cotação |

Status: `pendente → em_analise → proposta_enviada → ganha | perdida | cancelada`.

RPC pública `enviar_cotacao(jsonb)` (security definer): valida, faz upsert do cliente, insere a cotação e devolve apenas o protocolo.
