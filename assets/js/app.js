/* ================= APP — navegação, auth, fila, ficha, dashboard, parâmetros ================= */
let perfil=null, fila=[], filtro='abertas', propostaAtual=null;
window.__cot=null; window.__res=null;
document.getElementById('versao').textContent=AV_CONFIG.VERSAO;

const $=id=>document.getElementById(id);
function toast(html){const t=$('toast');t.innerHTML=html;t.style.display='block';setTimeout(()=>t.style.display='none',5500);}
function dtBR(iso){ return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));$(id).classList.add('on');window.scrollTo(0,0);}
const ehGestor=()=>perfil&&perfil.papel==='gestor';

/* ================= NAVEGAÇÃO ================= */
async function go(d){
  $('navCliente').classList.toggle('active',d==='cliente');
  $('navInterno').classList.toggle('active',d!=='cliente');
  if(d==='cliente') return show('v-cliente');
  if(!perfil) return show('v-login');
  if(d==='params'){ if(!ehGestor()) return toast('Apenas gestores acessam os parâmetros.'); await carregarParams(); return show('v-params'); }
  if(d==='dash'){ await renderDash(); return show('v-dash'); }
  if(d==='ficha') return show('v-ficha');
  show('v-fila'); await carregarFila();
}

/* ================= AUTH ================= */
async function login(){
  const btn=$('l-btn'), err=$('l-err'); err.style.display='none'; btn.disabled=true; btn.textContent='Entrando…';
  try{ await DB.entrar(val('l-user'),$('l-pass').value); await aposLogin(); }
  catch(e){ err.textContent=/invalid/i.test(e.message)?'E-mail ou senha inválidos.':e.message; err.style.display='block'; }
  btn.disabled=false; btn.textContent='Entrar';
}
async function recuperarSenha(){
  const em=val('l-user'); if(!em) return toast('Informe seu e-mail e clique novamente em "Esqueci minha senha".');
  try{ await DB.recuperar(em); toast('Enviamos um link de redefinição para <b>'+em+'</b>.'); }catch(e){ toast('Erro: '+e.message); }
}
async function aposLogin(irFila=true){
  perfil=await DB.meuPerfil();
  if(!perfil||!perfil.ativo){ await DB.sair(); perfil=null; $('l-err').textContent='Seu acesso ainda não foi ativado por um gestor.'; $('l-err').style.display='block'; return; }
  P=Object.assign(P,await DB.parametros());
  $('userChip').textContent=(perfil.nome||perfil.email)+' · '+perfil.papel; $('userChip').style.display='inline';
  ['btnSair','navDash'].forEach(i=>$(i).style.display='inline-block');
  $('navParams').style.display=ehGestor()?'inline-block':'none';
  DB.aoReceberCotacao(c=>{ toast('<b>Nova cotação recebida!</b><br>'+c.empresa+' · '+c.origem+' → '+c.destino+' · '+(EQUIP[c.equipamento]||{}).nome); if($('v-fila').classList.contains('on')) carregarFila(); else atualizarPill(); });
  if(irFila) go('fila');
}
async function logout(){ await DB.sair(); perfil=null; ['navParams','btnSair','navDash','userChip'].forEach(i=>$(i).style.display='none'); go('cliente'); }

/* ================= VISTA CLIENTE ================= */
let cEquip='dry40';
function renderEquipGrid(){
  $('c-equipGrid').innerHTML=Object.entries(EQUIP).map(([k,e])=>'<div class="equip '+(k===cEquip?'on':'')+'" role="button" tabindex="0" aria-label="'+e.nome+'" onclick="selEquip(\''+k+'\')" onkeydown="if(event.key===\'Enter\')selEquip(\''+k+'\')"><b>'+e.nome+'</b><small>'+e.desc+'</small></div>').join('');
  const solta=cEquip==='carga_solta', oo=/opentop|flatrack/.test(cEquip);
  $('c-m3Box').style.display=solta?'block':'none'; $('c-csNote').style.display=solta?'block':'none'; $('c-ooNote').style.display=oo?'block':'none';
  $('c-pesoLbl').textContent=solta?'Peso bruto total (kg) *':'Peso bruto por contêiner (kg) *';
}
function selEquip(k){ cEquip=k; renderEquipGrid(); }
async function enviarCotacao(){
  const err=$('c-err'); err.style.display='none';
  const o={empresa:val('c-empresa'),email:val('c-email'),fone:val('c-fone'),operacao:val('c-oper'),origem:val('c-origem'),destino:val('c-destino'),
    equipamento:cEquip,qtde:num('c-qtde')||1,mercadoria:val('c-merc'),peso_kg:num('c-peso'),m3:num('c-m3')||null,valor_nf:num('c-nf')||null,imo:chk('c-imo'),prazo:val('c-prazo'),obs:val('c-obs')};
  if(!o.empresa||!o.email||!o.fone||!o.origem||!o.destino||!o.mercadoria||!o.peso_kg){err.textContent='Preencha os campos obrigatórios (*): empresa, contato, origem, destino, mercadoria e peso.';err.style.display='block';return;}
  const btn=$('c-btnEnviar'); btn.disabled=true; btn.textContent='Enviando…';
  try{
    const r=await DB.enviarCotacao(o);
    $('c-okBox').style.display='block'; $('c-prot').textContent=r.protocolo; window.scrollTo(0,document.body.scrollHeight);
  }catch(e){ err.textContent='Não foi possível enviar: '+e.message+'. Tente novamente ou fale conosco pelo WhatsApp.'; err.style.display='block'; }
  btn.disabled=false; btn.textContent='Enviar solicitação de cotação';
}

/* ================= FILA ================= */
const FILTROS={abertas:['Abertas',c=>['pendente','em_analise'].includes(c.status)],proposta_enviada:['Proposta enviada',c=>c.status==='proposta_enviada'],ganha:['Ganhas',c=>c.status==='ganha'],perdida:['Perdidas/canceladas',c=>['perdida','cancelada'].includes(c.status)],todas:['Todas',()=>true]};
function atualizarPill(){ DB.fila().then(f=>{fila=f; const n=f.filter(c=>c.status==='pendente').length; $('pillQtd').textContent=n; $('pillQtd').style.display=n?'inline-block':'none';}); }
async function carregarFila(){
  $('fila').classList.add('loading');
  try{ fila=await DB.fila(); }catch(e){ toast('Erro ao carregar fila: '+e.message); }
  const n=fila.filter(c=>c.status==='pendente').length; $('pillQtd').textContent=n; $('pillQtd').style.display=n?'inline-block':'none';
  $('filtros').innerHTML=Object.entries(FILTROS).map(([k,[n,f]])=>'<button class="'+(k===filtro?'on':'')+'" onclick="filtro=\''+k+'\';carregarFila()">'+n+' ('+fila.filter(f).length+')</button>').join('');
  const lista=fila.filter(FILTROS[filtro][1]);
  $('fila').classList.remove('loading');
  if(!lista.length){$('fila').innerHTML='<div class="card"><div class="card-b" style="text-align:center;color:var(--muted);padding:34px">Nenhuma cotação neste filtro.</div></div>';return;}
  $('fila').innerHTML=lista.map(c=>{const st=STATUS[c.status]||[c.status,'gray']; const e=EQUIP[c.equipamento]||{nome:c.equipamento};
    return '<div class="q-item" role="button" tabindex="0" aria-label="Abrir '+c.protocolo+'" onclick="abrir(\''+c.id+'\')" onkeydown="if(event.key===\'Enter\')abrir(\''+c.id+'\')"><div><div class="t">'+c.empresa+' <span class="badge gray">'+c.protocolo+'</span>'+(c.imo?' <span class="badge red">IMO</span>':'')+(/reefer|opentop|flatrack/.test(c.equipamento)?' <span class="badge ana">'+e.nome+'</span>':'')+'</div><div class="m">'+c.origem+' → '+c.destino+' · '+e.nome+' ×'+c.qtde+' · '+c.mercadoria+' · '+dtBR(c.criado_em)+' · via '+c.canal+'</div></div><span class="badge '+st[1]+'">'+st[0]+'</span></div>';}).join('');
}
async function novaManual(){
  const empresa=prompt('Nome da empresa / cliente:'); if(!empresa) return;
  try{
    const c=await DB.criarManual({empresa,email:'-',fone:'-',operacao:'imp',origem:'Santos, SP',destino:'',equipamento:'dry40',qtde:1,mercadoria:'-',peso_kg:0,prazo:'10'},perfil.id);
    abrir(c.id);
  }catch(e){ toast('Erro: '+e.message); }
}

/* ================= FICHA ================= */
function popularEquipSelect(){ $('f-equip').innerHTML=Object.entries(EQUIP).map(([k,e])=>'<option value="'+k+'">'+e.nome+'</option>').join(''); }
function syncMargem(v){$('f-margemR').value=v;$('f-margemN').value=v;}
async function abrir(id){
  const c=await DB.cotacao(id); window.__cot=c; window.__res=null; propostaAtual=null;
  const [ficha,hist]=await Promise.all([DB.ultimaFicha(id),DB.historico(id)]);
  $('f-titulo').textContent=c.protocolo+' — '+(c.empresa||'Nova cotação');
  $('f-meta').innerHTML='Recebida <b>'+dtBR(c.criado_em)+'</b> via <b>'+c.canal+'</b>'+(ficha?' · ficha <b>v'+ficha.versao+'</b> salva em '+dtBR(ficha.criado_em):' · <b>sem ficha salva</b>');
  $('f-status').value=c.status;
  $('f-hist').innerHTML=hist.map(h=>'<div>'+dtBR(h.criado_em)+' · <b>'+h.tipo+'</b> '+(h.detalhe&&Object.keys(h.detalhe).length?JSON.stringify(h.detalhe):'')+'</div>').join('');
  // zera campos
  document.querySelectorAll('#v-ficha input[type=number],#v-ficha textarea').forEach(el=>el.value='');
  document.querySelectorAll('#v-ficha input[type=checkbox]').forEach(el=>el.checked=false);
  $('f-seguro').checked=true; $('f-compv').checked=true; $('f-retvazio').checked=true; $('d-comvend').value='10';
  // dados do cliente → ficha
  $('f-cliente').value=c.empresa; $('f-contato').value=(c.email!=='-'?c.email:'')+(c.fone&&c.fone!=='-'?' · '+c.fone:'');
  $('f-oper').value=c.operacao; $('f-viagem').value='Single'; $('f-origem').value=c.origem; $('f-destino').value=c.destino;
  $('f-merc').value=c.mercadoria==='-'?'':c.mercadoria; $('f-equip').value=c.equipamento; $('f-qtde').value=c.qtde; $('f-pesoKg').value=c.peso_kg||''; $('f-m3').value=c.m3||'';
  $('f-nf').value=c.valor_nf||''; $('f-prazo').value=c.prazo||10; $('f-obs').value=c.obs||''; $('f-imo').checked=c.imo;
  $('f-propBox').style.display='none';
  go('ficha');
  if(ficha&&ficha.dados&&Object.keys(ficha.dados).length){
    restaurarFicha(ficha.dados); $('f-status').value=c.status; analisarVeiculo(); checarPolice(); recalc(false);
    if(ficha.resumo) toast('Ficha v'+ficha.versao+' restaurada do banco.');
  } else {
    syncMargem(c.imo?P.margens.imo:P.margens.padrao);
    await motorCalcular();
  }
}
function mudarEquip(){ const c=window.__cot; if(c){c.equipamento=equipAtual();} prefillLeve(); }
async function motorCalcular(){
  const btn=$('f-btnCalc'); btn.disabled=true; btn.textContent='Calculando…';
  try{ set('f-km',await rotaKm(val('f-origem'),val('f-destino'))); }
  catch(e){ if(!num('f-km')) $('f-pisoHint').textContent='Rota automática indisponível — informe o km manualmente.'; }
  prefill(); btn.disabled=false; btn.textContent='↻ Recalcular rota + ANTT';
}
async function mudarStatus(st){ const c=window.__cot; if(!c) return; try{ await DB.mudarStatus(c.id,st,perfil.id); c.status=st; toast('Status: <b>'+STATUS[st][0]+'</b>'); }catch(e){ toast('Erro: '+e.message); } }
async function sincronizarCotacao(){
  const c=window.__cot; const [email,fone]=val('f-contato').split('·').map(s=>s.trim());
  const patch={empresa:val('f-cliente')||c.empresa,origem:val('f-origem'),destino:val('f-destino'),equipamento:equipAtual(),qtde:num('f-qtde')||1,mercadoria:val('f-merc')||c.mercadoria,peso_kg:num('f-pesoKg'),imo:chk('f-imo'),prazo:String(num('f-prazo')),operacao:val('f-oper'),valor_nf:num('f-nf')||null,m3:num('f-m3')||null,obs:val('f-obs'),atendido_por:perfil.id};
  if(email&&email.includes('@')) patch.email=email; if(fone) patch.fone=fone;
  await DB.atualizarCotacao(c.id,patch); Object.assign(c,patch);
}
async function salvarFicha(){
  const c=window.__cot; if(!c) return;
  try{
    await sincronizarCotacao();
    const f=await DB.salvarFicha(c.id,coletarFicha(),window.__res||{},num('f-margemN'),perfil.id);
    if(c.status==='pendente'){ await mudarStatus('em_analise'); $('f-status').value='em_analise'; }
    $('f-meta').innerHTML='Recebida <b>'+dtBR(c.criado_em)+'</b> via <b>'+c.canal+'</b> · ficha <b>v'+f.versao+'</b> salva em '+dtBR(f.criado_em||new Date().toISOString());
    toast('Ficha <b>v'+f.versao+'</b> salva no banco.'); return f;
  }catch(e){ toast('Erro ao salvar: '+e.message); }
}
async function responder(){
  const c=window.__cot; if(!c) return;
  const f=await salvarFicha(); if(!f) return;
  const p=montarProposta();
  try{
    propostaAtual=await DB.criarProposta({cotacao_id:c.id,ficha_id:f.id,numero:p.protocolo+'/'+f.versao,frete_peso:p.frete_peso,total:p.total,itens:p.itens,condicoes:{...p.cg,adval_pct:p.adval_pct,pedagio:p.pedagio,prazo_pagamento:p.prazo_pagamento},validade_dias:p.validade},perfil.id);
    await DB.mudarStatus(c.id,'proposta_enviada',perfil.id); c.status='proposta_enviada'; $('f-status').value='proposta_enviada';
  }catch(e){ return toast('Erro ao registrar proposta: '+e.message); }
  const box=$('f-propBox'); box.style.display='block';
  box.innerHTML='<b>Proposta '+propostaAtual.numero+' registrada — escolha o canal de envio para '+(p.cliente||'o cliente')+':</b>'+
    '<div class="prop-actions">'+
    '<button class="btn sm" style="background:#2b579a" onclick="gerarWord()">📄 Proposta em Word (editável)</button>'+
    '<button class="btn ghost sm" onclick="gerarPDF()">⬇ PDF / Imprimir</button>'+
    '<button class="btn sm" onclick="enviarEmail()">✉ E-mail</button>'+
    '<button class="btn sm" style="background:#1faa52" onclick="enviarWhats()">✆ WhatsApp</button>'+
    '</div><div class="hint" style="margin-top:8px"><b>Word é o padrão oficial</b> (estrutura do contrato, condições gerais dos Parâmetros) — ajuste adicionais antes de enviar. E-mail e WhatsApp abrem com o resumo pronto.</div>';
  toast('<b>'+c.protocolo+'</b> → Proposta enviada');
}
function registrarEnvio(canal){ if(propostaAtual&&window.__cot) DB.marcarEnvio(propostaAtual.id,canal,window.__cot.id,perfil.id); }

/* ================= DASHBOARD ================= */
async function renderDash(){
  const [todas,props]=await Promise.all([DB.fila(),DB.propostas()]); fila=todas;
  const tot=todas.length, pend=todas.filter(c=>c.status==='pendente').length, resp=todas.filter(c=>['proposta_enviada','ganha','perdida'].includes(c.status)).length, ganhas=todas.filter(c=>c.status==='ganha').length;
  const ultimaPorCot={}; props.forEach(p=>{ if(!ultimaPorCot[p.cotacao_id]||p.criado_em>ultimaPorCot[p.cotacao_id].criado_em) ultimaPorCot[p.cotacao_id]=p; });
  const valor=Object.values(ultimaPorCot).reduce((s,p)=>s+Number(p.total||0),0);
  const valorGanho=todas.filter(c=>c.status==='ganha').reduce((s,c)=>s+Number((ultimaPorCot[c.id]||{}).total||0),0);
  const kpi=(k,v,cls)=>'<div class="kpi"><div class="k">'+k+'</div><div class="v '+(cls||'')+'">'+v+'</div></div>';
  $('dashKpis').innerHTML=kpi('Cotações recebidas',tot)+kpi('Pendentes',pend,pend?'red':'')+kpi('Valor proposto',fmt(valor))+kpi('Ganhas · valor',ganhas+' · '+fmt(valorGanho));
  const dias=[];const hoje=new Date();
  for(let i=13;i>=0;i--){const d=new Date(hoje);d.setDate(d.getDate()-i);dias.push({k:d.toISOString().slice(0,10),lbl:String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'),n:0});}
  todas.forEach(c=>{const f=dias.find(x=>x.k===c.criado_em.slice(0,10));if(f)f.n++;});
  const max=Math.max(1,...dias.map(d=>d.n)), bw=34, H=150;
  let svg='<svg width="100%" viewBox="0 0 '+(dias.length*bw)+' '+(H+26)+'">';
  dias.forEach((d,i)=>{const h=d.n/max*H;svg+='<rect x="'+(i*bw+5)+'" y="'+(H-h)+'" width="'+(bw-10)+'" height="'+Math.max(h,1)+'" rx="3" fill="'+(d.n?'#9E1B32':'#e6e4e2')+'"/>'+(d.n?'<text x="'+(i*bw+bw/2)+'" y="'+(H-h-5)+'" font-size="10" text-anchor="middle" fill="#58595B" font-weight="700">'+d.n+'</text>':'')+'<text x="'+(i*bw+bw/2)+'" y="'+(H+16)+'" font-size="8.5" text-anchor="middle" fill="#8a8b8e">'+d.lbl+'</text>';});
  $('chartBars').innerHTML=svg+'</svg>';
  const pctR=tot?resp/tot:0, circ=2*Math.PI*44;
  $('chartDonut').innerHTML='<div style="display:flex;align-items:center;gap:16px"><svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="44" fill="none" stroke="#f0d9b0" stroke-width="14"/><circle cx="55" cy="55" r="44" fill="none" stroke="#1e7a3c" stroke-width="14" stroke-dasharray="'+(circ*pctR)+' '+circ+'" stroke-linecap="round" transform="rotate(-90 55 55)"/><text x="55" y="60" text-anchor="middle" font-size="18" font-weight="800" fill="#3f4043">'+Math.round(pctR*100)+'%</text></svg>'+
    '<div style="font-size:12.5px;line-height:2"><span class="badge resp">Respondidas '+resp+'</span><br><span class="badge pend">Pendentes '+pend+'</span><br><span class="badge ganha">Ganhas '+ganhas+'</span></div></div>';
  const agr=(fn)=>{const o={};todas.forEach(c=>{const k=fn(c);o[k]=(o[k]||0)+1;});return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,6);};
  const linha=([r,n])=>'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--line);font-size:12.5px"><span>'+r+'</span><b>'+n+'</b></div>';
  const rotas=agr(c=>c.origem+' → '+c.destino), eq=agr(c=>(EQUIP[c.equipamento]||{nome:c.equipamento}).nome);
  $('topRotas').innerHTML=rotas.length?rotas.map(linha).join(''):'<span class="kv">Sem dados ainda.</span>';
  $('topEquip').innerHTML=eq.length?eq.map(linha).join(''):'<span class="kv">Sem dados ainda.</span>';
}

/* ================= PARÂMETROS ================= */
async function carregarParams(){
  P=Object.assign(P,await DB.parametros());
  $('p-cascos').innerHTML=Object.entries(EQUIP).filter(([k])=>k!=='carga_solta').map(([k,e])=>'<div><label>'+e.nome+'</label><input id="pc-'+k+'" type="number" value="'+(P.cascos[k]||0)+'"></div>').join('');
  const cf=P.custos_fixos, sg=P.seguro, tr=P.tributos, mg=P.margens;
  $('p-comissao').value=cf.comissao; $('p-custoop').value=cf.custo_operacional; $('p-cubagem').value=cf.cubagem_kg_m3; $('p-pedkm').value=cf.pedagio_km;
  $('p-seguro').value=sg.taxa_pct; $('p-averb').value=sg.averbacao_padrao; $('p-adval').value=sg.adval_pct; $('p-advalImo').value=sg.adval_imo_pct;
  $('p-tPres').value=tr.presumido; $('p-tReal').value=tr.real; $('p-tSimples').value=tr.simples; $('p-mPad').value=mg.padrao; $('p-mImo').value=mg.imo;
  Object.entries(P.condicoes_gerais||{}).forEach(([k,v])=>{ const el=$('cg-'+k); if(el) el.value=v; });
  const em=P.empresa||{}; $('em-nome').value=em.nome||''; $('em-cidade').value=em.cidade||''; $('em-cnpj').value=em.cnpj||''; $('em-email').value=em.email||''; $('em-fone').value=em.fone||''; $('em-alertas').value=(em.email_alerta||[]).join(', ');
  const eq=await DB.perfis();
  $('p-equipe').innerHTML='<table class="tbl"><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Ativo</th></tr>'+eq.map(u=>'<tr><td>'+(u.nome||'')+'</td><td>'+u.email+'</td><td><select onchange="DB.atualizarPerfil(\''+u.id+'\',{papel:this.value}).then(()=>toast(\'Papel atualizado\'))"><option value="gestor"'+(u.papel==='gestor'?' selected':'')+'>gestor</option><option value="operador"'+(u.papel==='operador'?' selected':'')+'>operador</option></select></td><td><input type="checkbox" '+(u.ativo?'checked':'')+' onchange="DB.atualizarPerfil(\''+u.id+'\',{ativo:this.checked}).then(()=>toast(\'Acesso atualizado\'))"></td></tr>').join('')+'</table><div class="hint" style="margin-top:8px">Novos usuários são criados em Supabase → Authentication → Users e nascem inativos; ative aqui.</div>';
}
async function salvarParams(){
  const cascos={}; Object.keys(EQUIP).filter(k=>k!=='carga_solta').forEach(k=>cascos[k]=num('pc-'+k));
  const cg={}; document.querySelectorAll('#v-params input[id^="cg-"]').forEach(el=>{ cg[el.id.slice(3)]=el.type==='number'?parseFloat(el.value)||0:el.value; });
  const novo={
    cascos, seguro:{taxa_pct:num('p-seguro'),averbacao_padrao:num('p-averb'),adval_pct:num('p-adval'),adval_imo_pct:num('p-advalImo')},
    custos_fixos:{comissao:num('p-comissao'),custo_operacional:num('p-custoop'),cubagem_kg_m3:num('p-cubagem'),pedagio_km:num('p-pedkm')},
    tributos:{presumido:num('p-tPres'),real:num('p-tReal'),simples:num('p-tSimples')}, margens:{padrao:num('p-mPad'),imo:num('p-mImo')},
    condicoes_gerais:cg,
    empresa:{...(P.empresa||{}),nome:val('em-nome'),cidade:val('em-cidade'),cnpj:val('em-cnpj'),email:val('em-email'),fone:val('em-fone'),email_alerta:val('em-alertas').split(',').map(s=>s.trim()).filter(Boolean)}
  };
  try{ for(const [k,v] of Object.entries(novo)) await DB.salvarParametro(k,v,perfil.id); P=Object.assign(P,novo);
    $('p-okMsg').textContent='Salvo no banco ✓'; setTimeout(()=>$('p-okMsg').textContent='',3000);
  }catch(e){ toast('Erro ao salvar: '+e.message); }
}

/* ================= AUTOCOMPLETE DE CIDADES ================= */
function attachAC(inputId){
  const inp=$(inputId), list=$('ac-'+inputId); if(!inp||!list)return; let timer=null;
  inp.addEventListener('input',()=>{clearTimeout(timer);const q=inp.value.trim(); if(q.length<3){list.style.display='none';return;}
    timer=setTimeout(async()=>{try{
      const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=5&addressdetails=1&q='+encodeURIComponent(q),{headers:{'Accept-Language':'pt-BR'}});
      const data=await r.json();list.innerHTML='';
      const UF={'São Paulo':'SP','Rio de Janeiro':'RJ','Minas Gerais':'MG','Paraná':'PR','Santa Catarina':'SC','Rio Grande do Sul':'RS','Espírito Santo':'ES','Bahia':'BA','Goiás':'GO','Mato Grosso':'MT','Mato Grosso do Sul':'MS','Pernambuco':'PE','Ceará':'CE','Pará':'PA','Amazonas':'AM','Maranhão':'MA','Distrito Federal':'DF','Rio Grande do Norte':'RN','Paraíba':'PB','Alagoas':'AL','Sergipe':'SE','Piauí':'PI','Tocantins':'TO','Rondônia':'RO','Acre':'AC','Roraima':'RR','Amapá':'AP'};
      data.forEach(d=>{const cid=d.address.city||d.address.town||d.address.village||d.address.municipality||d.name; const uf=UF[d.address.state]||d.address.state||'';
        const el=document.createElement('div');el.className='ac-item';
        el.innerHTML='<b>'+cid+(uf?', '+uf:'')+'</b><small>'+(d.display_name.length>60?d.display_name.slice(0,60)+'…':d.display_name)+'</small>';
        el.onclick=()=>{inp.value=cid+(uf?', '+uf:'');list.style.display='none';if(inputId.startsWith('f-'))motorCalcular();};
        list.appendChild(el);});
      list.style.display=data.length?'block':'none';
    }catch(e){list.style.display='none';}},420);});
}
['c-origem','c-destino','f-origem','f-destino'].forEach(attachAC);
document.addEventListener('click',e=>{if(!e.target.closest('.ac-wrap'))document.querySelectorAll('.ac-list').forEach(l=>l.style.display='none');});

/* ================= BOOT ================= */
renderEquipGrid(); popularEquipSelect();
(async()=>{ const s=await DB.sessao(); if(s) await aposLogin(false); })();
/* link de redefinição de senha (e-mail "Esqueci minha senha") */
sb.auth.onAuthStateChange(async(ev)=>{ if(ev==='PASSWORD_RECOVERY'){ const nova=prompt('Defina sua nova senha (mínimo 8 caracteres):'); if(nova&&nova.length>=8){ const {error}=await sb.auth.updateUser({password:nova}); toast(error?'Erro: '+error.message:'Senha atualizada. Você já está conectado.'); if(!error) await aposLogin(); } } });
