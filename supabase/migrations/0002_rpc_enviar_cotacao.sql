-- RPC pública: site envia a cotação e recebe só o protocolo (sem permissão de leitura na tabela)
create or replace function enviar_cotacao(p jsonb)
returns table (protocolo text, criado_em timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid; v_prot text; v_dt timestamptz;
begin
  if coalesce(p->>'empresa','')='' or coalesce(p->>'email','')='' or coalesce(p->>'fone','')='' or coalesce(p->>'origem','')='' or coalesce(p->>'destino','')='' or coalesce(p->>'mercadoria','')='' then
    raise exception 'Campos obrigatorios ausentes';
  end if;
  insert into clientes (empresa, email, fone) values (p->>'empresa', lower(p->>'email'), p->>'fone')
  on conflict ((lower(empresa)), (lower(coalesce(email,'')))) do update set fone = excluded.fone
  returning id into v_cliente;
  insert into cotacoes (cliente_id, canal, empresa, email, fone, operacao, origem, destino, equipamento, qtde, mercadoria, peso_kg, m3, valor_nf, imo, prazo, obs)
  values (v_cliente, 'site', p->>'empresa', lower(p->>'email'), p->>'fone', coalesce(p->>'operacao','imp'), p->>'origem', p->>'destino',
          coalesce(p->>'equipamento','dry40'), greatest(1, coalesce((p->>'qtde')::int,1)), p->>'mercadoria',
          coalesce((p->>'peso_kg')::numeric,0), (p->>'m3')::numeric, (p->>'valor_nf')::numeric, coalesce((p->>'imo')::boolean,false), p->>'prazo', p->>'obs')
  returning cotacoes.protocolo, cotacoes.criado_em into v_prot, v_dt;
  insert into eventos (cotacao_id, tipo, detalhe) select id, 'recebida_site', jsonb_build_object('equipamento', equipamento) from cotacoes where cotacoes.protocolo = v_prot;
  return query select v_prot, v_dt;
end $$;
revoke all on function enviar_cotacao(jsonb) from public;
grant execute on function enviar_cotacao(jsonb) to anon, authenticated;
-- remove a cotação de teste do curl
delete from cotacoes where empresa = 'TESTE G4 OS';
