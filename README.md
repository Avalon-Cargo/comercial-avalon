# Avalon Comercial — Cotação e Proposta

Ferramenta comercial da **Avalon Cargo Transportes e Logística** (Santos/SP): o cliente solicita cotação no site, a equipe recebe na fila, monta a ficha (rota real + piso ANTT + seguros + tributos) e gera a proposta comercial no padrão do contrato.

## Stack
- Front: HTML/CSS/JS puro (sem build) + `@supabase/supabase-js` via CDN
- Banco/Auth/Realtime: Supabase (projeto `eiwemdotmfofjzzaiyfl`)
- Hospedagem: Vercel (site estático) — ver `docs/DEPLOY.md`
- Rota real: OSRM · Geocodificação: Nominatim · Piso ANTT: coeficientes medidos (Qualp out/2026)

## Estrutura
```
index.html              telas: site público, login, fila, ficha, dashboard, parâmetros
assets/css/avalon.css   design system Avalon (bordô #9E1B32)
assets/js/config.js     URL e chave publishable do Supabase (segura p/ navegador; RLS protege os dados)
assets/js/db.js         camada de dados (auth, cotações, fichas, propostas, parâmetros, eventos, realtime)
assets/js/motor.js      motor de cálculo (equipamentos, ANTT, seguros/casco, regimes, resumo)
assets/js/proposta.js   proposta comercial (Word editável, PDF, e-mail, WhatsApp) — padrão contrato
assets/js/app.js        navegação, telas, dashboard, parâmetros
supabase/migrations/    SQL versionado (aplicar em ordem no SQL Editor)
docs/                   deploy, modelo de dados, condições gerais
```

## Equipamentos e casco (valor p/ seguro)
| Equipamento | Casco 20' | Casco 40' | Categoria ANTT |
|---|---|---|---|
| DRY / HC | R$ 40.000 | R$ 60.000 | Conteineirizada |
| Reefer | R$ 150.000 | R$ 150.000 | Frigorificada |
| Open Top | R$ 60.000 | R$ 100.000 | Conteineirizada (alerta oversize) |
| Flat Rack | R$ 80.000 | R$ 100.000 | Conteineirizada (alerta oversize) |
| Carga solta | — | — | Geral · cotação manual |

Todos os valores são editáveis em **Parâmetros** (gestor) e valem para toda a equipe.

## Segurança
- Visitante (anon) só executa a RPC `enviar_cotacao` — não lê nenhuma tabela.
- Equipe autenticada com `perfis.ativo = true` lê/edita cotações, fichas e propostas.
- Só `papel = gestor` altera parâmetros e ativa usuários.
- Novos cadastros nascem inativos. Chaves secretas (service_role, senha do banco) **nunca** entram no repositório.

## Rodar localmente
Abra `index.html` com qualquer servidor estático (ex.: extensão Live Server). Não há etapa de build.
