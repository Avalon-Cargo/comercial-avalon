-- 0005: habilita Realtime (postgres_changes) na tabela cotacoes
-- Necessario para o toast "Nova cotacao recebida!" na Area Avalon.
-- RLS continua valendo: so usuarios autenticados com perfil ativo recebem os eventos.
alter publication supabase_realtime add table public.cotacoes;
