-- Avalon Comercial · Fase 0 · schema inicial
create extension if not exists pgcrypto;

-- ===== PERFIS (vinculados ao Supabase Auth) =====
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text unique,
  papel text not null default 'operador' check (papel in ('gestor','operador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, email, nome, papel)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
          coalesce(new.raw_user_meta_data->>'papel','operador'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo);
$$;
create or replace function is_gestor() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'gestor');
$$;

-- ===== CLIENTES =====
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  cnpj text,
  contato text,
  email text,
  fone text,
  criado_em timestamptz not null default now()
);
create unique index if not exists clientes_empresa_email_idx on clientes (lower(empresa), lower(coalesce(email,'')));

-- ===== COTAÇÕES (o que o cliente envia pelo site) =====
create sequence if not exists cotacao_seq start 1000;
create table if not exists cotacoes (
  id uuid primary key default gen_random_uuid(),
  protocolo text unique not null default ('COT-' || nextval('cotacao_seq')),
  canal text not null default 'site' check (canal in ('site','manual','email')),
  status text not null default 'pendente' check (status in ('pendente','em_analise','proposta_enviada','ganha','perdida','cancelada')),
  cliente_id uuid references clientes(id),
  empresa text not null,
  email text not null,
  fone text not null,
  operacao text not null check (operacao in ('imp','exp','cabotagem','nacional','outro')),
  origem text not null,
  destino text not null,
  equipamento text not null check (equipamento in ('dry20','dry40','reefer20','reefer40','opentop20','opentop40','flatrack20','flatrack40','carga_solta')),
  qtde int not null default 1 check (qtde > 0),
  mercadoria text not null,
  peso_kg numeric not null,
  m3 numeric,
  valor_nf numeric,
  imo boolean not null default false,
  prazo text,
  obs text,
  atendido_por uuid references perfis(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists cotacoes_status_idx on cotacoes (status, criado_em desc);

-- ===== FICHAS (cálculo interno; 1 cotação pode ter várias versões) =====
create table if not exists fichas (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references cotacoes(id) on delete cascade,
  versao int not null default 1,
  dados jsonb not null default '{}',      -- todos os campos da ficha (km, eixos, categoria ANTT, receitas, despesas)
  resumo jsonb not null default '{}',     -- lucro, margem, regime, frete efetivo
  margem_alvo numeric,
  criado_por uuid references perfis(id),
  criado_em timestamptz not null default now(),
  unique (cotacao_id, versao)
);

-- ===== PROPOSTAS (documento gerado/enviado) =====
create table if not exists propostas (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references cotacoes(id) on delete cascade,
  ficha_id uuid references fichas(id),
  numero text unique,
  frete_peso numeric not null,
  total numeric not null,
  itens jsonb not null default '[]',       -- adicionais na tabela da proposta
  condicoes jsonb not null default '{}',   -- snapshot das condições gerais usadas
  arquivo_url text,
  canal_envio text check (canal_envio in ('email','whatsapp','download')),
  enviada_em timestamptz,
  validade_dias int not null default 30,
  criado_por uuid references perfis(id),
  criado_em timestamptz not null default now()
);

-- ===== PARÂMETROS (chave/valor editável pelo gestor) =====
create table if not exists parametros (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  atualizado_por uuid references perfis(id),
  atualizado_em timestamptz not null default now()
);

-- ===== EVENTOS (auditoria) =====
create table if not exists eventos (
  id bigserial primary key,
  cotacao_id uuid references cotacoes(id) on delete cascade,
  usuario_id uuid,
  tipo text not null,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);

-- ===== updated_at =====
create or replace function touch_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists cotacoes_touch on cotacoes;
create trigger cotacoes_touch before update on cotacoes for each row execute function touch_atualizado();

-- ===== RLS =====
alter table perfis enable row level security;
alter table clientes enable row level security;
alter table cotacoes enable row level security;
alter table fichas enable row level security;
alter table propostas enable row level security;
alter table parametros enable row level security;
alter table eventos enable row level security;

-- anônimo: só insere cotação pelo site
drop policy if exists cot_insert_anon on cotacoes;
create policy cot_insert_anon on cotacoes for insert to anon, authenticated with check (true);
drop policy if exists cot_staff_all on cotacoes;
create policy cot_staff_all on cotacoes for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists perfis_self on perfis;
create policy perfis_self on perfis for select to authenticated using (id = auth.uid() or is_staff());
drop policy if exists perfis_gestor on perfis;
create policy perfis_gestor on perfis for update to authenticated using (is_gestor()) with check (is_gestor());

drop policy if exists clientes_staff on clientes;
create policy clientes_staff on clientes for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists fichas_staff on fichas;
create policy fichas_staff on fichas for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists propostas_staff on propostas;
create policy propostas_staff on propostas for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists eventos_staff on eventos;
create policy eventos_staff on eventos for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists params_read on parametros;
create policy params_read on parametros for select to authenticated using (is_staff());
drop policy if exists params_write on parametros;
create policy params_write on parametros for all to authenticated using (is_gestor()) with check (is_gestor());

-- ===== SEED de parâmetros =====
insert into parametros (chave, valor, descricao) values
('cascos', '{"dry20":40000,"dry40":60000,"reefer20":150000,"reefer40":150000,"opentop20":60000,"opentop40":100000,"flatrack20":80000,"flatrack40":100000}', 'Valor do contêiner para seguro (R$)'),
('taras_kg', '{"dry20":2300,"dry40":3900,"reefer20":3000,"reefer40":4500,"opentop20":2400,"opentop40":4000,"flatrack20":2800,"flatrack40":5000}', 'Tara aproximada por equipamento (kg)'),
('seguro', '{"taxa_pct":0.035,"averbacao_padrao":275000,"adval_pct":0.10,"adval_imo_pct":0.15}', 'Seguro RCTR-C/RC-DC e Ad Valorem'),
('custos_fixos', '{"comissao":50,"custo_operacional":150,"cubagem_kg_m3":300,"pedagio_km":1.40}', 'Custos fixos por operação e fatores'),
('tributos', '{"presumido":17,"real":12,"simples":14}', 'Alíquotas por regime (%)'),
('margens', '{"padrao":15,"imo":15}', 'Margem alvo padrão (%)'),
('antt', '{"Conteineirizada":[6.7911,647.26],"Geral":[6.8283,657.60],"Frigorificada":[8.0623,757.99],"Perigosa Conteineirizada":[7.2121,753.09],"Perigosa Geral":[7.2494,763.43],"Perigosa Frigorificada":[8.6997,878.92],"fator_6_eixos":1.076}', 'Coeficientes piso ANTT 5 eixos [por km, fixo] — Qualp out/2026'),
('condicoes_gerais', '{"adicional_ls_pct":20,"adicional_ls_desc":"cargas acima 25 tons com tara","horas_livres":"12h","pernoite":955,"hora_extra":85,"antecipacao_draft":500,"antecipacao_free_time_dias":5,"ajudante":300,"ajudante_min":"mínimo 2 p/ 20'' e 3 para 40''","escolta":"Sob consulta","validade_dias":30,"frete_morto_pct":90,"urgencia_cancelamento_pct":50,"pagamento":"10 dias corridos","multa_pct":5,"juros_dia_pct":0.30,"rastreamento":"Incluso","icms":"Isento","impostos":"Incluso"}', 'Condições gerais da proposta (padrão contrato Samsung SDS)'),
('empresa', '{"nome":"Avalon Cargo Transportes e Logística","cidade":"Santos/SP","email_alerta":["fabricio@avaloncargo.com.br","anderson@avaloncargo.com.br"]}', 'Dados da empresa e destinatários do alerta')
on conflict (chave) do nothing;

-- ===== VIEW para dashboard =====
create or replace view v_dashboard as
select date_trunc('month', criado_em) as mes,
       count(*) as cotacoes,
       count(*) filter (where status in ('proposta_enviada','ganha','perdida')) as respondidas,
       count(*) filter (where status = 'ganha') as ganhas,
       count(*) filter (where equipamento = 'carga_solta') as carga_solta
from cotacoes group by 1 order by 1 desc;

select 'ok' as resultado, count(*) as parametros from parametros;
