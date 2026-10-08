// VidaPlus - modulo bandeja de entrada y buscador global
let BANDEJA=null,BANDEJA_CARGANDO=false,BUSQ={q:'',res:null};

async function cargarBandeja(){
  if(BANDEJA_CARGANDO||!AUTH)return;
  BANDEJA_CARGANDO=true;
  try{BANDEJA=await api('listBandeja')}catch(e){BANDEJA=BANDEJA||[]}
  BANDEJA_CARGANDO=false;
  if(view==='bandeja'||view==='hub')render();
}
function bandejaCuenta(){if(BANDEJA===null&&AUTH&&!BANDEJA_CARGANDO)setTimeout(cargarBandeja,0);return BANDEJA?BANDEJA.length:0}

async function bandejaAdd(){const i=$('#bdQ'),t=(i.value||'').trim();if(!t)return;try{await api('addBandeja',{texto:t});i.value='';BANDEJA=null;await cargarBandeja();say('Guardado en la bandeja')}catch(e){say(e.message)}}
async function bandejaProcesar(id,destino){
  try{
    await api('procesarBandeja',{id,destino,fecha:today()});
    BANDEJA=(BANDEJA||[]).filter(b=>b.id!==id);
    if(destino==='tarea'){DB=await api('getAll')}
    if(destino==='persona')PERS=null;
    say({tarea:'Pasó a tus tareas de hoy',diario:'Pasó al diario',persona:'Pasó a Personas',descartar:'Descartado'}[destino]);
    render();
  }catch(e){say(e.message)}
}
function fechaHora(iso){try{return new Date(iso).toLocaleString('es-AR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Argentina/Buenos_Aires'})}catch(_){return ''}}

VIEWS.bandeja=function(){
  const head=`<div class="module-head"><button class="link" onclick="go('hub')">‹ Inicio</button><h1>Bandeja de ideas</h1><p>Para ideas sueltas que todavía no sabés dónde van. Después las pasás a tarea, diario o personas.</p></div>`;
  if(BANDEJA===null)return head+'<div class="empty">Cargando…</div>';
  return head+`<div class="per-bar"><input id="bdQ" placeholder="Una idea, un pendiente, un número de teléfono…" autocomplete="off" onkeydown="if(event.key==='Enter')bandejaAdd()"><button class="save" onclick="bandejaAdd()">Guardar</button></div>${BANDEJA.length?BANDEJA.map(b=>`<div class="fin-box bd-item"><div class="bd-txt">${esc(b.texto)}<small>${fechaHora(b.creado)}${b.origen&&b.origen!=='app'?' · desde '+esc(b.origen):''}</small></div><div class="bd-btns"><button onclick="bandejaProcesar('${b.id}','tarea')">A tarea de hoy</button><button onclick="bandejaProcesar('${b.id}','diario')">Al diario</button><button onclick="bandejaProcesar('${b.id}','persona')">A personas</button><button class="bd-x" onclick="bandejaProcesar('${b.id}','descartar')">Descartar</button></div></div>`).join(''):'<div class="empty">La bandeja está vacía. Todo en orden.</div>'}`;
};

// ---------- buscador global
async function buscarGlobal(q){
  q=String(q||'').trim();BUSQ.q=q;view='buscar';
  if(q.length<2){BUSQ.res=null;render();return}
  BUSQ.res='cargando';render();
  try{BUSQ.res=await api('buscarTodo',{q})}catch(e){BUSQ.res={tareas:[],gastos:[],personas:[],diario:[],bandeja:[]};say(e.message)}
  render();
}
function irResultado(tipo,a,b){
  if(tipo==='tarea'){calSel=a;calWeek=weekMonday(a);calMonth=new Date(a+'T12:00:00');go('hub')}
  else if(tipo==='gasto'){FIN_MES=a.slice(0,7);go('finanzas')}
  else if(tipo==='persona'){go('personas');persAbrir(a)}
  else if(tipo==='diario')goMotivacionInicio();
  else if(tipo==='bandeja')go('bandeja');
}
VIEWS.buscar=function(){
  const head=`<div class="module-head"><button class="link" onclick="go('hub')">‹ Inicio</button><h1>Buscar</h1><p>Encuentra cualquier cosa en tareas, gastos, personas, notas y bandeja.</p></div><div class="per-bar"><input id="gq2" value="${esc(BUSQ.q)}" placeholder="Escribí al menos 2 letras…" autocomplete="off" onkeydown="if(event.key==='Enter')buscarGlobal(this.value)"><button class="save" onclick="buscarGlobal($('#gq2').value)">Buscar</button></div>`;
  const r=BUSQ.res;
  if(r==='cargando')return head+'<div class="empty">Buscando…</div>';
  if(!r)return head+'<div class="empty">Escribí algo para buscar.</div>';
  const sec=(t,arr,fn)=>arr.length?`<div class="fin-box" style="margin-bottom:14px"><h2>${t} (${arr.length})</h2>${arr.map(fn).join('')}</div>`:'';
  const total=r.tareas.length+r.gastos.length+r.personas.length+r.diario.length+r.bandeja.length;
  if(!total)return head+'<div class="empty">No encontramos nada con "'+esc(BUSQ.q)+'".</div>';
  const fila=(onclick,titulo,sub)=>`<button class="res-row" onclick="${onclick}"><b>${titulo}</b><small>${sub}</small></button>`;
  return head+sec('Tareas',r.tareas,x=>fila(`irResultado('tarea','${x.fecha}')`,esc(x.texto),fmt(x.fecha)+(x.hecha?' · hecha':'')+(x.categoria&&x.categoria!=='personal'?' · '+(TASK_CATS[x.categoria]||x.categoria):'')))
    +sec('Personas',r.personas,x=>fila(`irResultado('persona','${x.id}')`,esc(x.nombre),[x.rol,x.organizacion].filter(Boolean).map(esc).join(' · ')+' · '+persEstadoTxt(x.estado)))
    +sec('Gastos e ingresos',r.gastos,x=>fila(`irResultado('gasto','${x.fecha}')`,(x.tipo==='gasto'?'-':'+')+money(x.monto)+' '+esc(x.descripcion||x.categoria),fmt(x.fecha)+' · '+esc(x.categoria)))
    +sec('Diario',r.diario,x=>fila(`irResultado('diario')`,esc(String(x.texto).slice(0,120)),fmt(x.fecha)))
    +sec('Bandeja',r.bandeja,x=>fila(`irResultado('bandeja')`,esc(x.texto),'Pendiente de ordenar'));
};
