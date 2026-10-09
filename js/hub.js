// VidaPlus - modulo hub (Inicio): tablero con indicadores y graficos. La navegacion esta en el menu, no aca.
let INICIO=null,INICIO_CARGANDO=false;
const MARRON='#8A5A3B';
async function cargarInicio(){
  if(INICIO_CARGANDO||!AUTH)return;
  INICIO_CARGANDO=true;
  try{INICIO=await api('resumenInicio')}catch(e){INICIO={mes:'',gastoMes:0,ingresoMes:0,porCategoria:[],gastoDias:[],kcalDias:[],kcalHoy:0,bandeja:0}}
  INICIO_CARGANDO=false;
  if(view==='hub')render();
}

function ultimosDias(n){const out=[];for(let i=n-1;i>=0;i--){const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()-i);out.push(ymd(d))}return out}
function diaLetra(ds){return ['D','L','M','X','J','V','S'][new Date(ds+'T12:00:00').getDay()]}

// grafico de barras. refLine = linea punteada marron (ej: lo que gastas por dia)
function svgBarras(vals,labels,opt){
  opt=opt||{};const W=320,H=132,pad=14,base=H-20,max=Math.max(1,...vals,opt.ref||0),n=vals.length,bw=(W-pad*2)/n;let g='';
  vals.forEach((v,i)=>{const h=Math.round(v/max*(base-14)),w=bw*.64,x=pad+i*bw+bw*.18,ult=i===n-1;g+=`<rect x="${x.toFixed(1)}" y="${base-h}" width="${w.toFixed(1)}" height="${Math.max(h,v>0?2:0)}" rx="4" fill="${ult?MARRON:'#12121A'}"/><text x="${(x+w/2).toFixed(1)}" y="${H-5}" text-anchor="middle" font-size="10" fill="#8A8A93">${labels[i]}</text>`});
  if(opt.ref){const y=base-Math.round(opt.ref/max*(base-14));g+=`<line x1="4" x2="${W-4}" y1="${y}" y2="${y}" stroke="${MARRON}" stroke-width="1.5" stroke-dasharray="4 4"/>`}
  return `<svg viewBox="0 0 ${W} ${H}" class="dash-svg" role="img" aria-label="${opt.aria||'Gráfico de barras'}">${g}</svg>`;
}
// grafico de linea. pts = [{f:'AAAA-MM-DD',v:numero}]
function svgLinea(pts,color){
  if(pts.length<2)return '<div class="dash-vacio">Cargá al menos 2 pesos para ver cómo evolucionás.</div>';
  const W=320,H=132,pl=8,pr=8,pt=14,pb=22,vs=pts.map(p=>p.v),mn=Math.min(...vs),mx=Math.max(...vs),rg=Math.max(mx-mn,.5),T=p=>new Date(p.f+'T12:00:00').getTime(),t0=T(pts[0]),dt=Math.max(1,T(pts[pts.length-1])-t0);
  const X=p=>pl+(T(p)-t0)/dt*(W-pl-pr),Y=p=>pt+(1-(p.v-mn)/rg)*(H-pt-pb),last=pts[pts.length-1];
  const d=pts.map((p,i)=>(i?'L':'M')+X(p).toFixed(1)+' '+Y(p).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="dash-svg" role="img" aria-label="Gráfico de peso"><defs><linearGradient id="lgp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${X(last).toFixed(1)} ${H-pb} L${X(pts[0]).toFixed(1)} ${H-pb}Z" fill="url(#lgp)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(last).toFixed(1)}" cy="${Y(last).toFixed(1)}" r="4.5" fill="${color}" stroke="#fff" stroke-width="2"/><text x="${pl}" y="${H-5}" font-size="10" fill="#8A8A93">${fmt(pts[0].f)}</text><text x="${W-pr}" y="${H-5}" text-anchor="end" font-size="10" fill="#8A8A93">${fmt(last.f)}</text></svg>`;
}
function dashCard(titulo,sub,cuerpo){return `<div class="dash-card"><h2>${titulo}</h2><p class="sub">${sub}</p>${cuerpo}</div>`}

function hub(){
  if(INICIO===null)setTimeout(cargarInicio,0);
  const nombre=esc((AUTH?.user?.nombre||'').split(' ')[0]||''),hoy=today(),I=INICIO,premium=!!AUTH?.settings?.recordatorios_premium,cargando='…';
  const cab=`<div class="hub-greet"><h1>Hola, ${nombre}</h1><p class="hub-sub">Así venís hoy.</p></div><div class="gsearch"><input id="gq" value="${esc(BUSQ.q)}" placeholder="Buscar en tareas, gastos, notas e ideas…" autocomplete="off" onkeydown="if(event.key==='Enter')buscarGlobal(this.value)"><button onclick="buscarGlobal($('#gq').value)" aria-label="Buscar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button></div>`;
  if(BUSQ.res)return `<section class="view on hub-view tiles-view">${cab}${buscarResultadosHtml()}</section>`;

  // ---- datos locales
  const fechaDe=x=>x.vencimiento?x.vencimiento.slice(0,10):x.fecha;
  const pend=DB.tareas.filter(x=>!x.hecha),deHoy=pend.filter(x=>fechaDe(x)===hoy),atras=pend.filter(x=>fechaDe(x)<hoy);
  const pesos=DB.pesos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)),ultimo=pesos[pesos.length-1],objetivo=AUTH?.settings?.peso_objetivo_kg?Number(AUTH.settings.peso_objetivo_kg):null;
  const bal=calcularBalanceCalorico([]),tdee=bal?bal.tdee:0;
  const dias7=ultimosDias(7),dias14=ultimosDias(14);
  const habPct=dias7.map(ds=>{const due=DB.habitos.filter(h=>h.activo!==false&&h.activo!=='false'&&habitDue(h,ds));if(!due.length)return 0;return Math.round(due.filter(h=>DB.habitoLogs.some(l=>String(l.habito_id)===String(h.id)&&l.fecha===ds)).length/due.length*100)});
  const habHoy=habPct[6];

  // ---- indicadores
  const kTareas=premium?`<div class="kpi k-brown"><small>Tareas para hoy</small><b>${deHoy.length}</b><span>${atras.length?atras.length+' atrasada'+(atras.length===1?'':'s'):'Nada atrasado'}</span></div>`:'';
  const balMes=I?I.ingresoMes-I.gastoMes:0;
  const kGasto=`<div class="kpi"><small>Gastado este mes</small><b>${I?money(I.gastoMes):cargando}</b><span>${I?(I.ingresoMes?'Ingresos '+money(I.ingresoMes)+' · balance '+(balMes<0?'-':'')+money(Math.abs(balMes)):'Todavía sin ingresos cargados'):''}</span></div>`;
  let kcalSub='';if(I){if(!bal)kcalSub='Completá tus datos en Cuerpo para comparar';else if(!I.kcalHoy)kcalSub='Todavía no cargaste comidas hoy';else{const d=I.kcalHoy-tdee;kcalSub=d<-100?'Déficit de '+Math.abs(d)+' kcal':d>100?'Superávit de '+d+' kcal':'Mantenimiento'}}
  const kCal=`<div class="kpi"><small>Calorías de hoy</small><b>${I?I.kcalHoy+(bal?' <i>de '+tdee+'</i>':''):cargando}</b><span>${kcalSub}</span></div>`;
  const falta=ultimo&&objetivo?+(ultimo.kg-objetivo).toFixed(1):null;
  const kPeso=`<div class="kpi"><small>Peso actual</small><b>${ultimo?ultimo.kg+' kg':'Sin datos'}</b><span>${falta==null?'Definí tu objetivo en Cuerpo':falta>0?'Te faltan '+falta+' kg':'¡Objetivo alcanzado!'}</span></div>`;

  // ---- graficos
  let rubros='<div class="dash-vacio">Cargá tus gastos en Finanzas y acá vas a ver en qué se te va la plata.</div>';
  if(I&&I.porCategoria.length){const mx=Math.max(...I.porCategoria.map(c=>c.total));rubros=I.porCategoria.map(c=>`<div class="rub"><div class="rub-t"><span>${esc(c.categoria)}</span><b>${money(c.total)}</b></div><div class="rub-b"><i style="width:${Math.max(4,Math.round(c.total/mx*100))}%"></i></div></div>`).join('')}
  else if(!I)rubros='<div class="dash-vacio">Cargando…</div>';
  const gMap=Object.fromEntries((I?I.gastoDias:[]).map(x=>[x.fecha,x.total]));
  const gastos14=svgBarras(dias14.map(d=>gMap[d]||0),dias14.map(diaLetra),{aria:'Gastos de los últimos 14 días'});
  const kMap=Object.fromEntries((I?I.kcalDias:[]).map(x=>[x.fecha,x.kcal]));
  const cal7=svgBarras(dias7.map(d=>kMap[d]||0),dias7.map(diaLetra),{ref:tdee||0,aria:'Calorías de los últimos 7 días'});
  const pts=pesos.filter(p=>p.fecha>=ymd(new Date(Date.now()-90*864e5))).map(p=>({f:p.fecha,v:Number(p.kg)}));
  const hab7=svgBarras(habPct,dias7.map(diaLetra),{ref:0,aria:'Hábitos cumplidos en la semana'});

  const lista=premium?`<div class="dash-card dash-wide"><h2>Para hacer hoy</h2><p class="sub">Tareas de hoy y las que quedaron atrasadas. Tildá las que ya hiciste.</p>${[...atras,...deHoy].slice(0,8).map(taskItem).join('')||'<div class="dash-vacio">No tenés nada pendiente para hoy.</div>'}${atras.length+deHoy.length>8?'<div class="sub" style="margin-top:8px">Hay más tareas en la Agenda.</div>':''}</div>`:'';

  return `<section class="view on hub-view tiles-view">${cab}
<div class="dash-kpis">${kTareas}${kGasto}${kCal}${kPeso}</div>
<div class="dash-charts">
${dashCard('En qué gastás este mes','Tus gastos por rubro, del que más al que menos.',rubros)}
${dashCard('Gastos de los últimos 14 días','Cuánto gastaste cada día. La barra marrón es hoy.',gastos14)}
${dashCard('Calorías de los últimos 7 días','Lo que comiste cada día. La línea marrón es lo que gasta tu cuerpo.',cal7)}
${dashCard('Tu peso','Cómo viene tu peso en los últimos 3 meses.',svgLinea(pts,MARRON))}
${dashCard('Hábitos de la semana','Qué porcentaje de tus hábitos cumpliste cada día'+(habHoy?'. Hoy: '+habHoy+'%':'')+'.',hab7)}
${lista}
</div>
</section>`;
}
