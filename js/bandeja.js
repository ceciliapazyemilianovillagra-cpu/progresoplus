// VidaPlus - modulo bandeja de ideas y buscador (el buscador se muestra en Inicio)
let BANDEJA=null,BANDEJA_CARGANDO=false,BUSQ={q:'',res:null};

async function cargarBandeja(){
  if(BANDEJA_CARGANDO||!AUTH)return;
  BANDEJA_CARGANDO=true;
  try{BANDEJA=await api('listBandeja')}catch(e){BANDEJA=BANDEJA||[]}
  BANDEJA_CARGANDO=false;
  if(view==='bandeja')render();
}

async function bandejaAdd(){const i=$('#bdQ'),t=(i.value||'').trim();if(!t)return;try{await api('addBandeja',{texto:t});i.value='';BANDEJA=null;INICIO=null;await cargarBandeja();say('Guardado en la bandeja')}catch(e){say(e.message)}}
async function bandejaProcesar(id,destino){
  try{
    await api('procesarBandeja',{id,destino,fecha:today()});
    BANDEJA=(BANDEJA||[]).filter(b=>b.id!==id);INICIO=null;
    if(destino==='tarea'){DB=await api('getAll')}
    say({tarea:'Pasó a tus tareas de hoy',diario:'Pasó al diario',descartar:'Descartado'}[destino]);
    render();
  }catch(e){say(e.message)}
}
function fechaHora(iso){try{return new Date(iso).toLocaleString('es-AR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Argentina/Buenos_Aires'})}catch(_){return ''}}

VIEWS.bandeja=function(){
  const head=`<div class="module-head"><button class="link" onclick="go('hub')">‹ Inicio</button><h1>Bandeja de ideas</h1><p>Para ideas sueltas que todavía no sabés dónde van. Después las pasás a tarea o al diario.</p></div>`;
  if(BANDEJA===null)return head+'<div class="empty">Cargando…</div>';
  return head+`<div class="per-bar"><input id="bdQ" placeholder="Una idea, un pendiente, un número de teléfono…" autocomplete="off" onkeydown="if(event.key==='Enter')bandejaAdd()"><button class="save" onclick="bandejaAdd()">Guardar</button></div>${BANDEJA.length?BANDEJA.map(b=>`<div class="fin-box bd-item"><div class="bd-txt">${esc(b.texto)}<small>${fechaHora(b.creado)}${b.origen&&b.origen!=='app'?' · desde '+esc(b.origen):''}</small></div><div class="bd-btns"><button onclick="bandejaProcesar('${b.id}','tarea')">Pasar a tarea de hoy</button><button onclick="bandejaProcesar('${b.id}','diario')">Pasar al diario</button><button class="bd-x" onclick="bandejaProcesar('${b.id}','descartar')">Descartar</button></div></div>`).join(''):'<div class="empty">La bandeja está vacía. Todo en orden.</div>'}`;
};

// ---------- buscador (vive en Inicio)
async function buscarGlobal(q){
  q=String(q||'').trim();BUSQ.q=q;view='hub';
  if(q.length<2){BUSQ.res=null;render();return}
  BUSQ.res='cargando';render();
  try{BUSQ.res=await api('buscarTodo',{q})}catch(e){BUSQ.res={tareas:[],gastos:[],diario:[],bandeja:[]};say(e.message)}
  render();
}
function cerrarBusqueda(){BUSQ={q:'',res:null};render()}
function irResultado(tipo,a){
  if(tipo==='tarea'){calSel=a;calWeek=weekMonday(a);calMonth=new Date(a+'T12:00:00');go('recordatorios')}
  else if(tipo==='gasto'){FIN_MES=a.slice(0,7);go('finanzas')}
  else if(tipo==='diario')goMotivacionInicio();
  else if(tipo==='bandeja')go('bandeja');
}
function buscarResultadosHtml(){
  const r=BUSQ.res,volver=`<button class="link" style="margin:2px 0 12px" onclick="cerrarBusqueda()">‹ Volver al tablero</button>`;
  if(r==='cargando')return volver+'<div class="empty">Buscando…</div>';
  const sec=(t,arr,fn)=>arr.length?`<div class="fin-box" style="margin-bottom:14px"><h2>${t} (${arr.length})</h2>${arr.map(fn).join('')}</div>`:'';
  const total=r.tareas.length+r.gastos.length+r.diario.length+r.bandeja.length;
  if(!total)return volver+'<div class="empty">No encontramos nada con "'+esc(BUSQ.q)+'".</div>';
  const fila=(onclick,titulo,sub)=>`<button class="res-row" onclick="${onclick}"><b>${titulo}</b><small>${sub}</small></button>`;
  return volver
    +sec('Tareas',r.tareas,x=>fila(`irResultado('tarea','${x.fecha}')`,esc(x.texto),fmt(x.fecha)+(x.hecha?' · hecha':'')+(x.categoria&&x.categoria!=='personal'?' · '+(TASK_CATS[x.categoria]||x.categoria):'')))
    +sec('Gastos e ingresos',r.gastos,x=>fila(`irResultado('gasto','${x.fecha}')`,(x.tipo==='gasto'?'-':'+')+money(x.monto)+' '+esc(x.descripcion||x.categoria),fmt(x.fecha)+' · '+esc(x.categoria)))
    +sec('Diario',r.diario,x=>fila(`irResultado('diario')`,esc(String(x.texto).slice(0,120)),fmt(x.fecha)))
    +sec('Bandeja de ideas',r.bandeja,x=>fila(`irResultado('bandeja')`,esc(x.texto),'Pendiente de ordenar'));
}
