// VidaPlus - modulo hub (Inicio): una tarjeta por seccion, con el dato de hoy a la derecha
let INICIO=null,INICIO_CARGANDO=false;
async function cargarInicio(){
  if(INICIO_CARGANDO||!AUTH)return;
  INICIO_CARGANDO=true;
  try{INICIO=await api('resumenInicio')}catch(e){INICIO={gastoMes:0,kcalHoy:0,personasHoy:0,bandeja:0,mes:''}}
  INICIO_CARGANDO=false;
  if(view==='hub')render();
}

function hubCard(cls,destino,icono,titulo,desc,valor,leyenda,extra){
  return `<button class="hub-card ${cls}" onclick="go('${destino}')"><span class="hub-icon"><svg viewBox="0 0 24 24">${icono}</svg></span><span class="hub-tx"><b>${titulo}</b><span>${desc}</span></span><span class="hub-live"><b>${valor}</b><small>${leyenda}</small>${extra||''}</span></button>`;
}

function hub(){
  if(INICIO===null)setTimeout(cargarInicio,0);
  const nombre=esc((AUTH?.user?.nombre||'').split(' ')[0]||'');
  const premium=!!AUTH?.settings?.recordatorios_premium;
  const I=INICIO,hoy=today(),dash='…';
  // agenda
  const fechaDe=x=>x.vencimiento?x.vencimiento.slice(0,10):x.fecha;
  const pend=DB.tareas.filter(x=>!x.hecha),deHoy=pend.filter(x=>fechaDe(x)===hoy).length,atras=pend.filter(x=>fechaDe(x)<hoy).length;
  // cuerpo
  const pesos=DB.pesos.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha)),peso=pesos.length?pesos[0].kg+' kg':'Sin peso';
  const habHoy=DB.habitos.filter(h=>h.activo!==false&&h.activo!=='false'&&habitDue(h)),habHechos=habHoy.filter(h=>DB.habitoLogs.some(l=>String(l.habito_id)===String(h.id)&&l.fecha===hoy)).length;
  // comida
  const bal=calcularBalanceCalorico([]);
  const iconos={
    agenda:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
    fin:'<path d="M3 7h15a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M3 7l12-4v4"/><circle cx="17" cy="14" r="1.2"/>',
    comida:'<path d="M5 11h14M7 11V5h10v6M6 11l1 9h10l1-9"/>',
    cuerpo:'<path d="M4 18 9 12l3 3 6-9 2 3"/>',
    pers:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
    band:'<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    motiv:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/>'
  };
  const agenda=premium
    ? hubCard('rem','recordatorios',iconos.agenda,'Agenda','Tareas con fecha y aviso por WhatsApp',deHoy,deHoy===1?'tarea para hoy':'tareas para hoy',atras?`<em class="hub-warn">${atras} atrasada${atras===1?'':'s'}</em>`:'')
    : `<button class="hub-card rem locked" onclick="go('recordatorios')"><span class="hub-icon"><svg viewBox="0 0 24 24">${iconos.agenda}</svg></span><span class="hub-tx"><b>Agenda</b><span>Función premium — conocé más</span></span><span class="hub-lock">Premium</span></button>`;
  return `<section class="view on hub-view tiles-view">
<div class="hub-greet"><h1>Hola, ${nombre}</h1><p class="hub-sub">Esto es lo de hoy. Tocá una tarjeta para entrar.</p></div>
${agenda}
${hubCard('fin','finanzas',iconos.fin,'Finanzas','Lo que gastás y a dónde se va la plata',I?money(I.gastoMes):dash,'gastado este mes')}
${hubCard('food','nutricion',iconos.comida,'Comida','Lo que comés, calorías, menú y recetas',I?(bal?I.kcalHoy+' de '+bal.tdee:I.kcalHoy+' kcal'):dash,bal?'kcal de hoy':'comidas de hoy')}
${hubCard('body','fisico',iconos.cuerpo,'Cuerpo','Hábitos, rutinas de gym, peso y dieta',peso,habHoy.length?habHechos+' de '+habHoy.length+' hábitos hoy':'Sin hábitos')}
${hubCard('pers','personas',iconos.pers,'Personas','Contactos, qué hablaron y próximo paso',I?I.personasHoy:dash,'seguimientos para hoy')}
${hubCard('band','bandeja',iconos.band,'Bandeja de ideas','Anotá cualquier idea para ordenarla después',I?I.bandeja:dash,'para ordenar')}
${hubCard('motiv','motivacion',iconos.motiv,'Motivación','Evangelio del día, diario y lecturas','Leer','lectura de hoy')}
</section>`;
}
