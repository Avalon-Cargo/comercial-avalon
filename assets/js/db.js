/* ================= CAMADA DE DADOS — Supabase ================= */
const sb = window.supabase.createClient(AV_CONFIG.SUPABASE_URL, AV_CONFIG.SUPABASE_ANON_KEY);

const DB = {
  /* ---- auth ---- */
  async sessao(){ const {data}=await sb.auth.getSession(); return data.session; },
  async entrar(email,senha){ const {data,error}=await sb.auth.signInWithPassword({email,password:senha}); if(error) throw error; return data.session; },
  async sair(){ await sb.auth.signOut(); },
  async recuperar(email){ const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}); if(error) throw error; },
  async meuPerfil(){ const s=await this.sessao(); if(!s) return null; const {data}=await sb.from('perfis').select('*').eq('id',s.user.id).maybeSingle(); return data; },

  /* ---- site público ---- */
  async enviarCotacao(p){ const {data,error}=await sb.rpc('enviar_cotacao',{p}); if(error) throw error; return data[0]; },

  /* ---- parâmetros ---- */
  async parametros(){ const {data,error}=await sb.from('parametros').select('chave,valor'); if(error) throw error; const o={}; data.forEach(r=>o[r.chave]=r.valor); return o; },
  async salvarParametro(chave,valor,uid){ const {error}=await sb.from('parametros').upsert({chave,valor,atualizado_por:uid,atualizado_em:new Date().toISOString()}); if(error) throw error; },

  /* ---- cotações ---- */
  async fila(){ const {data,error}=await sb.from('cotacoes').select('*').order('criado_em',{ascending:false}).limit(300); if(error) throw error; return data; },
  async cotacao(id){ const {data,error}=await sb.from('cotacoes').select('*').eq('id',id).single(); if(error) throw error; return data; },
  async criarManual(c,uid){ const {data,error}=await sb.from('cotacoes').insert({...c,canal:'manual',atendido_por:uid}).select().single(); if(error) throw error; await this.evento(data.id,'criada_manual',{},uid); return data; },
  async atualizarCotacao(id,patch){ const {error}=await sb.from('cotacoes').update(patch).eq('id',id); if(error) throw error; },
  async mudarStatus(id,status,uid){ await this.atualizarCotacao(id,{status,atendido_por:uid}); await this.evento(id,'status',{status},uid); },

  /* ---- fichas (versionadas) ---- */
  async ultimaFicha(cotacaoId){ const {data}=await sb.from('fichas').select('*').eq('cotacao_id',cotacaoId).order('versao',{ascending:false}).limit(1).maybeSingle(); return data; },
  async salvarFicha(cotacaoId,dados,resumo,margemAlvo,uid){
    const ult=await this.ultimaFicha(cotacaoId); const versao=(ult?ult.versao:0)+1;
    const {data,error}=await sb.from('fichas').insert({cotacao_id:cotacaoId,versao,dados,resumo,margem_alvo:margemAlvo,criado_por:uid}).select().single(); if(error) throw error;
    await this.evento(cotacaoId,'ficha_salva',{versao,total:resumo.R,margem:resumo.margem},uid); return data;
  },

  /* ---- propostas ---- */
  async criarProposta(p,uid){ const {data,error}=await sb.from('propostas').insert({...p,criado_por:uid}).select().single(); if(error) throw error; return data; },
  async marcarEnvio(propostaId,canal,cotacaoId,uid){ await sb.from('propostas').update({canal_envio:canal,enviada_em:new Date().toISOString()}).eq('id',propostaId); await this.evento(cotacaoId,'proposta_enviada',{canal},uid); },
  async propostas(){ const {data}=await sb.from('propostas').select('cotacao_id,total,frete_peso,criado_em,ficha_id'); return data||[]; },
  async ultimaProposta(cotacaoId){ const {data}=await sb.from('propostas').select('*').eq('cotacao_id',cotacaoId).order('criado_em',{ascending:false}).limit(1).maybeSingle(); return data; },

  /* ---- eventos ---- */
  async evento(cotacaoId,tipo,detalhe,uid){ await sb.from('eventos').insert({cotacao_id:cotacaoId,tipo,detalhe:detalhe||{},usuario_id:uid||null}); },
  async historico(cotacaoId){ const {data}=await sb.from('eventos').select('tipo,detalhe,criado_em,usuario_id').eq('cotacao_id',cotacaoId).order('criado_em',{ascending:false}).limit(30); return data||[]; },

  /* ---- equipe ---- */
  async perfis(){ const {data}=await sb.from('perfis').select('id,nome,email,papel,ativo').order('nome'); return data||[]; },
  async atualizarPerfil(id,patch){ const {error}=await sb.from('perfis').update(patch).eq('id',id); if(error) throw error; },

  /* ---- realtime: nova cotação chega na fila ---- */
  aoReceberCotacao(cb){ return sb.channel('cotacoes-novas').on('postgres_changes',{event:'INSERT',schema:'public',table:'cotacoes'},p=>cb(p.new)).subscribe(); }
};
