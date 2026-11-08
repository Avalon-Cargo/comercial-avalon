-- 0003 — Perfis de gestores e regra de novos cadastros
-- Novos cadastros nascem INATIVOS (um gestor ativa em `perfis`).
-- E-mails listados em parametros.empresa->email_alerta nascem gestores ativos.
-- As senhas iniciais foram definidas pelo painel (Authentication > Users) — nunca ficam no repositório.

create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_gestor boolean;
begin
  select coalesce((select valor->'email_alerta' ? new.email from parametros where chave='empresa'), false) into v_gestor;
  insert into perfis (id, email, nome, papel, ativo)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
          case when v_gestor then 'gestor' else 'operador' end, v_gestor)
  on conflict (id) do nothing;
  return new;
end $$;

-- Garante os dois gestores iniciais (usuários criados previamente no Auth)
insert into perfis (id,email,nome,papel,ativo)
select id,email,split_part(email,'@',1),'gestor',true from auth.users
where email in ('fabricio@avaloncargo.com.br','anderson@avaloncargo.com.br')
on conflict (id) do update set papel='gestor', ativo=true;
update perfis set nome='Fabrício' where email='fabricio@avaloncargo.com.br';
update perfis set nome='Anderson' where email='anderson@avaloncargo.com.br';
