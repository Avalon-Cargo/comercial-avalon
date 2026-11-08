/* ================= PROPOSTA COMERCIAL — padrão contrato Avalon ================= */
/* Um único template HTML alimenta Word (.doc editável), PDF/impressão, e-mail e WhatsApp. */

const ITENS_ADICIONAIS=[['Adicional de margem','r-margemAd'],['GRIS','r-gris'],['Adicional peso LS','r-ls'],['Adicional carga IMO','r-imo'],['Taxa DTA','r-dta'],['Ajudantes','r-ajud'],['Estadia','r-estadia'],['Emissão CT-e','r-cte'],['Adicional fim de semana','r-fds'],['Taxa de urgência','r-urg'],['Adicional de feriado','r-fer'],['Taxa de plantão','r-plantao'],['Escolta','r-escolta'],['Lashing / amarração','r-lashing'],['Gen-set / energia reefer','r-genset']];

function pct(v){ return (Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'; }
function dataBR(d){ return (d?new Date(d):new Date()).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}); }

/* dados da proposta a partir da ficha atual */
function montarProposta(){
  const c=window.__cot, R=window.__res?__res.R:receitasTotais(), cg=P.condicoes_gerais||{}, em=P.empresa||{};
  const e=EQUIP[equipAtual()], qt=num('f-qtde')||1;
  const itens=[];
  ITENS_ADICIONAIS.forEach(([n,id])=>{ if(num(id)>0) itens.push({nome:n,valor:num(id)}); });
  const advPct = num('f-residual')>0 ? P.seguro.adval_pct : (chk('f-imo')?P.seguro.adval_imo_pct:P.seguro.adval_pct);
  return {
    protocolo:c.protocolo, data:dataBR(), cliente:val('f-cliente')||c.empresa, contato:val('f-contato'),
    origem:val('f-origem'), destino:val('f-destino'), km:Math.round(num('f-km')),
    operacao:OPER[val('f-oper')]||'', equipamento:e.nome, qtde:qt, mercadoria:val('f-merc'), oversize:chk('f-oversize'),
    frete_peso:num('r-frete'), adval_pct:advPct, adval:num('r-adval'), pedagio:num('r-pedagio'), itens, total:R,
    prazo_pagamento:num('f-prazo')?num('f-prazo')+' dias corridos':(cg.pagamento||'10 dias corridos'),
    cg, em, validade:cg.validade_dias||30
  };
}

function propostaHTML(p,modo){
  const word=modo==='word';
  const td='padding:7px 9px;border-bottom:1px solid #ddd;font-size:11pt';
  const row=(k,v,b)=>'<tr><td style="'+td+'">'+k+'</td><td style="'+td+';text-align:right'+(b?';font-weight:bold':'')+'">'+v+'</td></tr>';
  const cg=p.cg, em=p.em;
  const condicoes=[
    ['Adicional cavalo LS','<b>'+(cg.adicional_ls_pct||20)+'%</b> sobre o Frete Peso ('+(cg.adicional_ls_desc||'cargas acima de 25 t com tara')+')'],
    ['Horas livres para carga/descarga','<b>'+(cg.horas_livres||'12h')+'</b>'],
    ['Pernoite / estadia','<b>'+fmt(cg.pernoite||955)+'</b> por pernoite · após '+(cg.horas_livres||'12h')+' livres, <b>'+fmt(cg.hora_extra||85)+'</b> por hora'],
    ['Antecipação de retirada do contêiner','<b>'+fmt(cg.antecipacao_draft||500)+'</b> ('+(cg.antecipacao_free_time_dias||5)+' dias de free time)'],
    ['Ajudante','<b>'+fmt(cg.ajudante||300)+'</b> por ajudante — '+(cg.ajudante_min||"mínimo 2 para 20' e 3 para 40'")],
    ['Escolta','<b>'+(cg.escolta||'Sob consulta')+'</b>'],
    ['Frete morto','<b>'+(cg.frete_morto_pct||90)+'%</b> do Frete Peso'],
    ['Taxa de urgência / cancelamento','<b>'+(cg.urgencia_cancelamento_pct||50)+'%</b> do Frete Peso'],
    ['Validade da proposta','<b>'+(cg.validade_dias||30)+' dias</b>, sem alteração nos valores de diesel e pedágio']
  ].map(([k,v])=>'<tr><td style="'+td+';width:38%"><b>'+k+'</b></td><td style="'+td+'">'+v+'</td></tr>').join('');
  const itensRows=p.itens.map(i=>row(i.nome,fmt(i.valor))).join('');
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Proposta Comercial '+p.protocolo+'</title>'+
  (word?'<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->':'')+
  '<style>body{font-family:Arial,sans-serif;color:#3f4043;font-size:11pt;max-width:760px;margin:'+(word?'0':'30px auto')+'}table{border-collapse:collapse;width:100%}h3{margin:18px 0 6px;font-size:12pt;color:#9E1B32;text-transform:uppercase}p{line-height:1.5}@media print{button{display:none}}</style></head><body>'+
  // Cabeçalho
  '<table style="background:#141414"><tr><td style="padding:12px 16px;color:#fff;font-size:15pt"><b>AVALON CARGO</b></td><td style="padding:12px 16px;color:#fff;text-align:right;font-size:10pt">PROPOSTA COMERCIAL · '+p.protocolo+'<br>'+p.data+'</td></tr></table>'+
  '<p style="margin-top:14px"><b>'+(em.nome||'Avalon Cargo Transportes e Logística')+'</b>'+(em.cnpj?' · CNPJ '+em.cnpj:'')+'<br>'+(em.cidade||'Santos/SP')+(em.email?' · '+em.email:'')+(em.fone?' · '+em.fone:'')+'</p>'+
  '<p><b>Cliente:</b> '+p.cliente+'<br><b>Contato:</b> '+(p.contato||'—')+'<br><b>Operação:</b> '+p.operacao+' · <b>Carga:</b> '+(p.mercadoria||'—')+' — '+p.equipamento+' × '+p.qtde+(p.oversize?' <b>(carga excede perfil — oversize)</b>':'')+'</p>'+
  // Rota
  '<table style="background:#9E1B32"><tr><td style="padding:9px 16px;color:#fff"><b>TRANSPORTE RODOVIÁRIO — '+p.origem.toUpperCase()+' &gt;&gt;&gt; '+p.destino.toUpperCase()+' &gt;&gt;&gt; '+p.origem.toUpperCase()+'</b><span style="float:right">'+p.km+' km ida e volta</span></td></tr></table>'+
  // Valores
  '<h3>Valores</h3><table>'+
  row('Frete Peso ('+p.equipamento+')',fmt(p.frete_peso),true)+
  row('Ad-valorem ('+pct(p.adval_pct)+' sobre o valor da mercadoria)',fmt(p.adval))+
  row('Pedágios','Oficial (hoje '+fmt(p.pedagio)+')')+
  itensRows+
  row('Rastreamento 24h',cg.rastreamento||'Incluso')+
  row('ICMS',cg.icms||'Isento')+
  row('Impostos',cg.impostos||'Incluso')+
  '<tr style="background:#f6f5f4"><td style="'+td+';font-size:12pt"><b>TOTAL DA OPERAÇÃO</b></td><td style="'+td+';text-align:right;font-size:13pt"><b>'+fmt(p.total)+'</b></td></tr>'+
  row('Prazo de pagamento',p.prazo_pagamento+' (boleto)')+
  '</table>'+
  '<p style="font-size:10pt">Em caso de atraso no pagamento incidirá multa de <b>'+pct(cg.multa_pct||5)+'</b> acrescida de juros de <b>'+pct(cg.juros_dia_pct||0.30)+'</b> ao dia.</p>'+
  // Condições gerais
  '<h3>Condições gerais</h3><table>'+condicoes+'</table>'+
  '<p style="font-size:10pt">Todos os custos decorrentes da operação, ainda que causados por terceiros (terminal, armador, órgãos anuentes, condições de via), serão de responsabilidade do contratante e cobrados mediante comprovação.</p>'+
  '<p style="font-size:10pt"><b><u>Todas as nossas operações incluem:</u></b> Seguro Contra Acidentes (RCTR-C) · Seguro Contra Roubo (RC-DC) · Gerenciamento de Risco · Equipe de Monitoramento 24h · Sistema de Rastreamento 24h · Equipe Operacional 24h.</p>'+
  '<p style="font-size:10pt">As partes reconhecem a validade da contratação por meio eletrônico, bem como de documentos, aceites e assinaturas trocados por e-mail ou aplicativo de mensagens.</p>'+
  '<p style="color:#9E1B32"><i>Proposta válida por '+p.validade+' dias.</i></p>'+
  // Assinaturas
  '<table style="margin-top:36px"><tr><td style="width:50%;padding:0 20px;text-align:center;border-top:1px solid #999">'+(em.nome||'Avalon Cargo Transportes e Logística')+'<br><span style="font-size:9pt">Transportadora</span></td><td style="width:50%;padding:0 20px;text-align:center;border-top:1px solid #999">'+p.cliente+'<br><span style="font-size:9pt">Contratante — aceite</span></td></tr></table>'+
  (modo==='print'?'<button onclick="window.print()" style="margin-top:24px;padding:10px 16px;background:#9E1B32;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer">Salvar como PDF / Imprimir</button>':'')+
  '</body></html>';
}

function propostaTexto(p){
  const cg=p.cg;
  let t='Olá! Segue a proposta comercial Avalon Cargo — '+p.protocolo+'\n\n'+
    'Rota: '+p.origem+' >>> '+p.destino+' >>> '+p.origem+' ('+p.km+' km ida e volta)\n'+
    'Equipamento: '+p.equipamento+' × '+p.qtde+'\n\n'+
    'Frete peso: '+fmt(p.frete_peso)+'\nAd-valorem ('+pct(p.adval_pct)+'): '+fmt(p.adval)+'\nPedágios: oficial (hoje '+fmt(p.pedagio)+')\n';
  p.itens.forEach(i=>t+=i.nome+': '+fmt(i.valor)+'\n');
  t+='Rastreamento 24h: incluso · ICMS: isento · Impostos: inclusos\n'+
    'TOTAL DA OPERAÇÃO: '+fmt(p.total)+'\n'+
    'Prazo de pagamento: '+p.prazo_pagamento+' (boleto)\n\n'+
    'Condições: adicional LS '+(cg.adicional_ls_pct||20)+'% · '+(cg.horas_livres||'12h')+' livres · pernoite '+fmt(cg.pernoite||955)+' · ajudante '+fmt(cg.ajudante||300)+' · frete morto '+(cg.frete_morto_pct||90)+'% · urgência/cancelamento '+(cg.urgencia_cancelamento_pct||50)+'%\n'+
    'Inclusos: Seguros RCTR-C/RC-DC · Gerenciamento de risco · Monitoramento 24h · Equipe operacional 24h\n'+
    'Proposta válida por '+p.validade+' dias.\n\n'+
    'A proposta completa segue em anexo (Word/PDF). Qualquer dúvida estamos à disposição!\n'+(p.em.nome||'Avalon Cargo')+' · '+(p.em.cidade||'Santos/SP');
  return t;
}

/* ---- saídas ---- */
function gerarWord(){
  const p=montarProposta();
  const blob=new Blob(['\ufeff'+propostaHTML(p,'word')],{type:'application/msword'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Proposta-Avalon-'+p.protocolo+'.doc';document.body.appendChild(a);a.click();a.remove();
  registrarEnvio('download'); toast('<b>Word baixado:</b> Proposta-Avalon-'+p.protocolo+'.doc — ajuste adicionais e envie.');
}
function gerarPDF(){
  const p=montarProposta(); const w=window.open('','_blank'); w.document.write(propostaHTML(p,'print')); w.document.close(); registrarEnvio('download');
}
function enviarEmail(){
  const p=montarProposta(), c=window.__cot;
  location.href='mailto:'+encodeURIComponent(c.email||'')+'?subject='+encodeURIComponent('Proposta comercial — Avalon Cargo ('+p.protocolo+')')+'&body='+encodeURIComponent(propostaTexto(p));
  registrarEnvio('email');
}
function enviarWhats(){
  const p=montarProposta(), c=window.__cot, dig=(c.fone||'').replace(/\D/g,'');
  window.open('https://wa.me/'+(dig.length<=11?'55':'')+dig+'?text='+encodeURIComponent(propostaTexto(p)),'_blank');
  registrarEnvio('whatsapp');
}
