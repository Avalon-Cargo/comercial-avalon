-- 0004: Database Webhook -> Edge Function alerta-cotacao
-- Dispara a cada nova cotação (INSERT em public.cotacoes).
-- Pré-requisitos: função 'alerta-cotacao' publicada e secrets configurados
-- (RESEND_API_KEY, ALERTA_FROM, APP_URL, WEBHOOK_SECRET).
-- Substitua <WEBHOOK_SECRET> pelo mesmo valor salvo nos secrets da função.

create extension if not exists pg_net;

drop trigger if exists trg_alerta_cotacao on public.cotacoes;
create trigger trg_alerta_cotacao
  after insert on public.cotacoes
  for each row
  execute function supabase_functions.http_request(
    'https://eiwemdotmfofjzzaiyfl.supabase.co/functions/v1/alerta-cotacao',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
    '{}',
    '5000'
  );
