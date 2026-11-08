/* ================= MOTOR DE CÁLCULO ================= */
/* Equipamentos: casco (seguro) e tara vêm de `parametros` (cascos / taras_kg) */
const EQUIP = {
  dry40:     {nome:"Contêiner 40' DRY/HC", tam:'40', tipo:'dry',      desc:'Padrão seco · HC incluso'},
  dry20:     {nome:"Contêiner 20' DRY",    tam:'20', tipo:'dry',      desc:'Padrão seco'},
  reefer40:  {nome:"Reefer 40'",           tam:'40', tipo:'reefer',   desc:'Refrigerado · ANTT Frigorificada'},
  reefer20:  {nome:"Reefer 20'",           tam:'20', tipo:'reefer',   desc:'Refrigerado · ANTT Frigorificada'},
  opentop40: {nome:"Open Top 40'",         tam:'40', tipo:'opentop',  desc:'Teto aberto · carga alta'},
  opentop20: {nome:"Open Top 20'",         tam:'20', tipo:'opentop',  desc:'Teto aberto · carga alta'},
  flatrack40:{nome:"Flat Rack 40'",        tam:'40', tipo:'flatrack', desc:'Plataforma · carga larga/pesada'},
  flatrack20:{nome:"Flat Rack 20'",        tam:'20', tipo:'flatrack', desc:'Plataforma · carga larga/pesada'},
  carga_solta:{nome:'Carga solta',         tam:null, tipo:'solta',    desc:'Sob consulta · veículo dedicado'}
};
const OPER = {imp:'Importação',exp:'Exportação',cabotagem:'Cabotagem',nacional:'Nacional',outro:'Outro'};
const STATUS = {pendente:['Pendente','pend'],em_analise:['Em análise','ana'],proposta_enviada:['Proposta enviada','resp'],ganha:['Ganha','ganha'],perdida:['Perdida','perd'],cancelada:['Cancelada','perd']};
const VEICULOS=[['Van',1500,8],['VUC',3000,12],['3/4',4000,20],['Toco',6000,40],['Truck',12000,50],['Carreta',25000,90]];
const EXCLUIDOS=['medicament','remedio','vacina','grao','soja','milho','trigo','cigarro','tabaco','fumo','arma','munic','explosiv','bagagem','ceramica','cristal','farinha de peixe','farelo','motociclet','obra de arte','antiguidade','relogio','joia','ouro','pedra precios','dinheiro','cheque','radioativ','nuclear','amianto','asbesto'];

/* P = parâmetros vindos do banco (preenchido em app.js). Defaults garantem funcionamento offline do motor. */
let P = {
  cascos:{dry20:40000,dry40:60000,reefer20:150000,reefer40:150000,opentop20:60000,opentop40:100000,flatrack20:80000,flatrack40:100000},
  taras_kg:{dry20:2300,dry40:3900,reefer20:3000,reefer40:4500,opentop20:2400,opentop40:4000,flatrack20:2800,flatrack40:5000},
  seguro:{taxa_pct:0.035,averbacao_padrao:275000,adval_pct:0.10,adval_imo_pct:0.15},
  custos_fixos:{comissao:50,custo_operacional:150,cubagem_kg_m3:300,pedagio_km:1.40},
  tributos:{presumido:17,real:12,simples:14}, margens:{padrao:15,imo:15},
  antt:{'Conteineirizada':[6.7911,647.26],'Geral':[6.8283,657.60],'Frigorificada':[8.0623,757.99],'Perigosa Conteineirizada':[7.2121,753.09],'Perigosa Geral':[7.2494,763.43],'Perigosa Frigorificada':[8.6997,878.92],fator_6_eixos:1.076},
  condicoes_gerais:{}, empresa:{}
};

const fmt=v=>(isFinite(v)?v:0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const num=id=>parseFloat(document.getElementById(id).value)||0;
const val=id=>(document.getElementById(id).value||'').trim();
const chk=id=>document.getElementById(id).checked;
const set=(id,v)=>{document.getElementById(id).value=(Math.round(v*100)/100)};
const norm=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const equipAtual=()=>val('f-equip')||'dry40';
const ehSolta=()=>equipAtual()==='carga_solta';

/* ---- rota real ---- */
async function geocode(q){
  const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=1&q='+encodeURIComponent(q),{headers:{'Accept-Language':'pt-BR'}});
  const j=await r.json();if(!j.length)throw new Error('geo:'+q);return {lat:+j[0].lat,lon:+j[0].lon};
}
async function rotaKm(origem,destino){
  const [a,b]=await Promise.all([geocode(origem),geocode(destino)]);
  const r=await fetch('https://router.project-osrm.org/route/v1/driving/'+a.lon+','+a.lat+';'+b.lon+','+b.lat+'?overview=false');
  const j=await r.json(); if(!j.routes||!j.routes.length) throw new Error('rota');
  return j.routes[0].distance/1000*2; // ida e volta
}

/* ---- categoria ANTT sugerida pelo equipamento ---- */
function sugereCategoria(){
  const imo=chk('f-imo'), e=EQUIP[equipAtual()];
  if(e.tipo==='solta') return imo?'Perigosa Geral':'Geral';
  if(e.tipo==='reefer') return imo?'Perigosa Frigorificada':'Frigorificada';
  return imo?'Perigosa Conteineirizada':'Conteineirizada';
}

/* ---- seguros: averbação + casco por equipamento ---- */
function segurosRS(){
  if(!chk('f-seguro')) return 0;
  const casco=P.cascos[equipAtual()]||0, qt=num('f-qtde')||1, taxa=P.seguro.taxa_pct;
  return (num('f-nf')*taxa/100)+(casco*taxa/100*qt);
}
function receitasTotais(){
  return ['r-frete','r-pedagio','r-margemAd','r-adval','r-gris','r-ls','r-imo','r-dta','r-ajud','r-estadia','r-cte','r-fds','r-urg','r-fer','r-plantao','r-escolta','r-lashing','r-genset'].reduce((s,id)=>s+num(id),0);
}
function custosTerceiros(){
  return ['d-frete','d-pedagio','d-margem','d-estadia','d-ajud','d-especiais','d-outras','d-comterc'].reduce((s,id)=>s+num(id),0);
}
function custosFixos(){ return P.custos_fixos.comissao+P.custos_fixos.custo_operacional; }
function regimes(R){
  const base={'Lucro Presumido':P.tributos.presumido,'Lucro Real':P.tributos.real,'Simples':P.tributos.simples};
  const C=custosTerceiros()+segurosRS()+custosFixos();
  const v=parseFloat(document.getElementById('d-comvend').value)/100;
  const out={};
  for(const [k,t] of Object.entries(base)){ const lb=R*(1-t/100)-C, com=Math.max(0,lb)*v; out[k]={t,lucro:lb-com,com}; }
  return out;
}

/* ---- piso ANTT e pedágio ---- */
function recalcANTT(){
  const km=num('f-km'), eixos=parseInt(val('f-eixos')), cat=val('f-cat'), qt=num('f-qtde')||1;
  let hint='', piso=0;
  if(P.antt[cat]&&(eixos===5||eixos===6)){
    piso=km*P.antt[cat][0]+P.antt[cat][1]; if(eixos===6)piso*=P.antt.fator_6_eixos;
    hint='Coeficientes de medições reais (Qualp, Tabela A, retorno vazio incluído).'+(eixos===6?' 6 eixos: fator medido +7,6%.':'');
  } else hint='Sem coeficiente oficial para '+eixos+' eixos — consultar Qualp/ANTT e preencher manualmente.';
  if(chk('f-altodes')) hint+=' ALTO DESEMPENHO: usar Tabela B oficial (menor) — ajustar manualmente.';
  if(!chk('f-retvazio')) hint+=' Sem retorno vazio: piso oficial difere — conferir.';
  if(piso) set('f-piso',piso);
  document.getElementById('f-pisoHint').textContent=hint;
  const ped=km*P.custos_fixos.pedagio_km*(eixos===6?1.2:(eixos<5?0.6:1));
  set('f-pedagioCalc',ped);
  document.getElementById('f-pedHint').textContent='Estimativa km × R$'+P.custos_fixos.pedagio_km.toFixed(2)+' — substituir pelo valor real do Qualp quando houver.';
  set('d-frete',num('f-piso')*qt);
  set('r-pedagio',num('f-pedagioCalc')*qt); set('d-pedagio',num('f-pedagioCalc')*qt);
}
function pisoManual(){ set('d-frete',num('f-piso')*(num('f-qtde')||1)); recalc(true); }
function pedManual(){ const qt=num('f-qtde')||1; set('r-pedagio',num('f-pedagioCalc')*qt); set('d-pedagio',num('f-pedagioCalc')*qt); recalc(true); }
function antER(){ recalcANTT(); recalc(true); }

/* ---- veículo / eixos / alertas do equipamento ---- */
function analisarVeiculo(){
  const e=EQUIP[equipAtual()], veic=document.getElementById('f-veic'); let eixos=5, msg='';
  document.getElementById('f-m3Box').style.display=e.tipo==='solta'?'block':'none';
  if(e.tipo==='solta'){
    const kg=num('f-pesoKg'), cubado=num('f-m3')*P.custos_fixos.cubagem_kg_m3, ref=Math.max(kg,cubado);
    const v=VEICULOS.find(x=>ref<=x[1]&&(num('f-m3')||0)<=x[2])||VEICULOS[VEICULOS.length-1];
    msg='<b>CARGA SOLTA — cotação manual:</b> frete variável/pontual, depende de parceiros de terminal. Preencher <b>Frete terceiro</b> e demais custos manualmente.<br>Veículo sugerido: <b>'+v[0]+'</b> (referência '+Math.round(ref)+' kg = maior entre peso real '+Math.round(kg)+' kg e cubado '+Math.round(cubado)+' kg · fator '+P.custos_fixos.cubagem_kg_m3+' kg/m³)';
    eixos=v[0]==='Carreta'?5:(v[0]==='Truck'?3:2);
  } else {
    const tara=P.taras_kg[equipAtual()]||3900, tot=num('f-pesoKg')+tara;
    eixos=tot<=25000?5:6;
    if(tot>25000) msg+='<b>Cavalo LS:</b> carga + tara = '+(tot/1000).toFixed(1)+' t (acima de 25 t) — aplicar adicional LS de '+(P.condicoes_gerais.adicional_ls_pct||20)+'% sobre o frete peso.<br>';
    if(tot>32500) msg+='<b>Atenção:</b> acima de 32,5 t — operação fora do padrão.<br>';
    if(e.tipo==='reefer') msg+='<b>Reefer:</b> categoria ANTT Frigorificada aplicada · confirmar necessidade de gen-set e temperatura/set-point.<br>';
    if(e.tipo==='opentop'||e.tipo==='flatrack') msg+='<b>'+e.nome+':</b> verificar dimensões — se exceder perfil, exige lashing, possível escolta e AET (marque "oversize").<br>';
  }
  document.getElementById('f-eixos').value=eixos;
  veic.innerHTML=msg; veic.style.display=msg?'block':'none';
}
function checarPolice(){
  const m=norm(val('f-merc')), bloq=EXCLUIDOS.some(t=>m.includes(norm(t))), el=document.getElementById('f-polAlert');
  el.style.display=bloq?'block':'none';
  if(bloq) el.innerHTML='<b>Pólice:</b> mercadoria possivelmente FORA da cobertura (lista de excluídos Sompo). Confirmar antes de cotar.';
}

/* ---- pré-preenchimento completo (após rota) ---- */
function prefill(){
  analisarVeiculo();
  document.getElementById('f-cat').value=sugereCategoria();
  checarPolice();
  recalcANTT();
  const imo=chk('f-imo');
  if(!num('f-nf')) document.getElementById('f-nf').value=P.seguro.averbacao_padrao;
  const advPct=num('f-residual')>0?P.seguro.adval_pct:(imo?P.seguro.adval_imo_pct:P.seguro.adval_pct);
  const advBase=num('f-residual')>0?num('f-residual'):num('f-nf');
  set('r-adval',advBase*advPct/100);
  recalc(true);
}
/* pré-preenchimento leve: peso/IMO/m³ mudaram, sem refazer rota */
function prefillLeve(){ analisarVeiculo(); document.getElementById('f-cat').value=sugereCategoria(); recalcANTT(); recalc(true); }

/* ---- resumo ---- */
function recalc(ajustaFrete){
  if(!window.__cot) return;
  const alvo=num('f-margemN')/100;
  if(ajustaFrete){
    const outras=receitasTotais()-num('r-frete');
    const C=custosTerceiros()+segurosRS()+custosFixos();
    const t=Math.min(P.tributos.presumido,P.tributos.real,P.tributos.simples)/100, v=parseFloat(document.getElementById('d-comvend').value)/100;
    const den=(1-t)*(1-v)-alvo;
    if(den>0.01){const R=C*(1-v)/den; set('r-frete',Math.max(0,Math.ceil((R-outras)/10)*10));}
  }
  const R=receitasTotais(), regs=regimes(R);
  let melhor=null;for(const[k,o]of Object.entries(regs)) if(!melhor||o.lucro>regs[melhor].lucro) melhor=k;
  const o=regs[melhor], margem=R>0?o.lucro/R*100:0, km=num('f-km'), custoTotal=custosTerceiros()+segurosRS();
  window.__res={R,lucro:o.lucro,margem,melhor,aliquota:o.t,custoTotal,comissao:o.com,seguros:segurosRS(),piso:num('f-piso'),km};
  const box=(k,v,cls)=>'<div class="rbox '+(cls||'')+'"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>';
  document.getElementById('resumo').innerHTML=
    box('Lucro Efetivo',fmt(o.lucro),o.lucro>0?'hl':'neg')+
    box('Percentual de Lucro',margem.toFixed(2).replace('.',',')+'%')+
    box('Resultado da Operação',o.lucro>0?'Operação viável':'Operação INVIÁVEL',o.lucro>0?'':'neg')+
    box('Melhor Regime Tributário',melhor)+
    box('Frete Efetivo + Impostos',fmt(R))+
    box('Alíquota ('+melhor+')',o.t.toFixed(2).replace('.',',')+'%')+
    box('Custo Total do Transporte',fmt(custoTotal))+
    box('Custo total por Km',km>0?fmt(custoTotal/km):'—')+
    box('Seguros (averbação + casco)',fmt(segurosRS()))+
    box('Valor ANTT (piso/un)',fmt(num('f-piso')))+
    box('Comissão de Vendedores',fmt(o.com))+
    box('Casco '+EQUIP[equipAtual()].nome,fmt(P.cascos[equipAtual()]||0));
}

/* ---- serialização da ficha (todos os campos f-/r-/d-) ---- */
function coletarFicha(){
  const o={};
  document.querySelectorAll('#v-ficha input[id],#v-ficha select[id],#v-ficha textarea[id]').forEach(el=>{ o[el.id]=el.type==='checkbox'?el.checked:el.value; });
  return o;
}
function restaurarFicha(d){
  Object.entries(d||{}).forEach(([id,v])=>{ const el=document.getElementById(id); if(!el) return; if(el.type==='checkbox') el.checked=!!v; else el.value=v; });
}
