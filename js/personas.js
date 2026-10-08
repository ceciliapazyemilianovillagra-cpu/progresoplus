// VidaPlus - modulo personas (CRM): contactos, estado, historial y proximo paso
let PERS=null,PERS_Q='',PERS_EST='';
const PERS_ESTADOS=[['nuevo','Nuevo'],['contactado','Contactado'],['respondio','Respondió'],['reunion','Reunión'],['propuesta','Propuesta'],['pausa','En pausa']];
const persEstadoTxt=e=>(PERS_ESTADOS.find(x=>x[0]===e)||[0,e])[1];

async function cargarPersonas(){try{PERS=await api('listPersonas')}catch(e){PERS=[];say(e.message)}if(view==='personas')render()}

function persFiltradas(){const q=PERS_Q.toLowerCase().trim();return PERS.filter(p=>(!PERS_EST||p.estado===PERS_EST)&&(!q||[p.nombre,p.rol,p.organizacion,p.ciudad,p.notas,p.proxima_accion].some(v=>String(v||'').toLowerCase().includes(q))))}

function persSet(k,v){if(k==='q'){PERS_Q=v;const el=$('#persList');if(el)el.innerHTML=persListaHtml()}else{PERS_EST=v;render()}}

function persRowHtml(p){const venc=p.proxima_fecha&&p.proxima_fecha<=today();return `<button class="per-row" onclick="persAbrir('${p.id}')"><span class="per-main"><b>${esc(p.nombre)}</b><small>${[p.rol,p.organizacion].filter(Boolean).map(esc).join(' · ')||'Sin rol ni organización'}</small></span><span class="per-estado e-${p.estado}">${persEstadoTxt(p.estado)}</span><span class="per-prio">${p.prioridad||''}</span><span class="per-next ${venc?'venc':''}">${p.proxima_accion?esc(p.proxima_accion):'<i>Sin próximo paso</i>'}${p.proxima_fecha?'<small>'+fmt(p.proxima_fecha)+(venc?' · hoy o atrasado':'')+'</small>':''}</span><span class="per-last">${p.ultima_accion?fmt(p.ultima_accion):''}</span></button>`}

function persListaHtml(){const l=persFiltradas();return l.length?l.map(persRowHtml).join(''):'<div class="empty">No hay personas con ese filtro. Tocá "+ Persona" para agregar.</div>'}

VIEWS.personas=function(){
  const head=`<div class="module-head"><button class="link" onclick="go('hub')">‹ Menú principal</button><h1>Personas</h1><p>Tus contactos, qué hablaste y cuál es el próximo paso.</p></div>`;
  if(PERS===null)return head+'<div class="empty">Cargando…</div>';
  const cuenta=e=>e?PERS.filter(p=>p.estado===e).length:PERS.length;
  const chips=[['','Todos'],...PERS_ESTADOS].map(([k,l])=>`<button class="chip ${PERS_EST===k?'on':''}" onclick="persSet('est','${k}')">${l} <i>${cuenta(k)}</i></button>`).join('');
  const pend=PERS.filter(p=>p.proxima_fecha&&p.proxima_fecha<=today()&&p.estado!=='pausa');
  return head+`<div class="per-bar"><input id="persQ" placeholder="Buscar por nombre, organización, ciudad…" value="${esc(PERS_Q)}" oninput="persSet('q',this.value)" autocomplete="off"><button class="save" onclick="persForm()">+ Persona</button><button class="cancel" onclick="IMP_TIPO='personas';go('importar')">Importar</button></div><div class="chip-group per-chips">${chips}</div>${pend.length?`<div class="fin-box per-pend"><h2>Para hacer hoy o atrasados (${pend.length})</h2>${pend.slice(0,8).map(persRowHtml).join('')}</div>`:''}<div class="per-table"><div class="per-head"><span>Nombre</span><span>Estado</span><span>Prior.</span><span>Próximo paso</span><span>Último</span></div><div id="persList">${persListaHtml()}</div></div>`;
};

async function persAbrir(id){busy(1);let p;try{p=await api('getPersona',{id})}catch(e){busy(0);return say(e.message)}busy(0);persModal(p)}
function persForm(){persModal({id:'',nombre:'',estado:'nuevo',historial:[]})}

function persModal(p){
  const v=k=>esc(p[k]||'');
  const opt=(arr,sel)=>arr.map(([k,l])=>`<option value="${k}" ${sel===k?'selected':''}>${l}</option>`).join('');
  const hist=p.id?`<div class="per-box"><b>Registrar contacto</b><textarea id="nTxt" placeholder="¿Qué pasó? Ej: hablamos por teléfono, quedó en responder"></textarea><div class="per-grid"><label class="form-field">Pasa a estado<select id="nEst"><option value="">Sin cambios</option>${opt(PERS_ESTADOS,'')}</select></label><label class="form-field">Próximo paso<input id="nProx" placeholder="Ej: mandar propuesta"></label><label class="form-field">Fecha<input id="nF" type="date"></label><label class="form-field">Hora (opcional)<input id="nH" type="time"></label></div><label class="inline-check"><input id="nTarea" type="checkbox" checked>Crear una tarea en Recordatorios</label><label class="inline-check"><input id="nAlerta" type="checkbox">Avisarme por WhatsApp a esa hora</label><button class="save" type="button" style="width:100%;margin-top:8px" onclick="persNota('${p.id}')">Guardar contacto</button></div><div class="per-box"><b>Historial</b><div class="per-hist">${(p.historial||[]).map(h=>`<div><small>${fmt(h.fecha)}</small>${esc(h.texto)}</div>`).join('')||'<div class="sub">Todavía no hay contactos registrados.</div>'}</div></div>`:'';
  const d=$('#modal');
  d.innerHTML=`<form method="dialog" onsubmit="return false" class="per-modal"><h2>${p.id?esc(p.nombre):'Nueva persona'}</h2><div class="per-grid"><label class="form-field">Nombre<input id="pNom" value="${v('nombre')}"></label><label class="form-field">Rol<input id="pRol" value="${v('rol')}" placeholder="Productor, periodista…"></label><label class="form-field">Organización<input id="pOrg" value="${v('organizacion')}"></label><label class="form-field">Ciudad<input id="pCiu" value="${v('ciudad')}"></label><label class="form-field">Teléfono<input id="pTel" inputmode="tel" value="${v('telefono')}"></label><label class="form-field">Email<input id="pMail" type="email" value="${v('email')}"></label><label class="form-field">Prioridad<select id="pPrio"><option value="">Sin definir</option>${opt([['A','A - alta'],['B','B - media'],['C','C - baja']],p.prioridad||'')}</select></label><label class="form-field">Estado<select id="pEst">${opt(PERS_ESTADOS,p.estado||'nuevo')}</select></label></div><label class="form-field">Notas<textarea id="pNotas">${v('notas')}</textarea></label><div class="per-grid"><label class="form-field">Próximo paso<input id="pProx" value="${v('proxima_accion')}"></label><label class="form-field">Fecha del próximo paso<input id="pProxF" type="date" value="${p.proxima_fecha||''}"></label></div><div class="actions"><button class="save" type="button" onclick="persGuardar('${p.id}')">Guardar</button></div>${p.id&&p.telefono?`<a class="per-wa" target="_blank" rel="noopener" href="https://wa.me/${String(p.telefono).replace(/[^0-9]/g,'')}">Abrir WhatsApp con ${esc(p.nombre.split(' ')[0])}</a>`:''}${hist}<div class="actions" style="margin-top:12px">${p.id?'<button class="danger" type="button" onclick="persBorrar(\''+p.id+'\')">Eliminar</button>':''}<button class="cancel" type="button" onclick="$(\'#modal\').close()">Cerrar</button></div></form>`;
  if(!d.open)d.showModal();
}

async function persGuardar(id){
  const g=i=>($('#'+i).value||'').trim();
  if(!g('pNom'))return say('Poné el nombre');
  busy(1,'Guardando…');
  try{await api('savePersona',{id:id||undefined,nombre:g('pNom'),rol:g('pRol'),organizacion:g('pOrg'),ciudad:g('pCiu'),telefono:g('pTel'),email:g('pMail'),prioridad:g('pPrio'),estado:g('pEst'),notas:$('#pNotas').value,proxima_accion:g('pProx'),proxima_fecha:g('pProxF')});$('#modal').close();say('Guardado');await cargarPersonas()}
  catch(e){say(e.message)}finally{busy(0)}
}
async function persNota(id){
  const g=i=>($('#'+i).value||'').trim();
  if(!g('nTxt'))return say('Contá qué pasó');
  if($('#nTarea').checked&&!g('nF'))return say('Poné la fecha del próximo paso para crear la tarea');
  busy(1,'Guardando…');
  try{await api('addPersonaNota',{persona_id:id,texto:g('nTxt'),estado:g('nEst'),proxima_accion:g('nProx'),proxima_fecha:g('nF'),proxima_hora:g('nH'),crear_tarea:$('#nTarea').checked,alerta:$('#nAlerta').checked});say('Contacto registrado');if($('#nTarea').checked)DB=await api('getAll');await cargarPersonas();await persAbrir(id)}
  catch(e){say(e.message)}finally{busy(0)}
}
async function persBorrar(id){if(!confirm('¿Eliminar a esta persona y su historial?'))return;try{await api('deletePersona',{id});$('#modal').close();say('Eliminada');await cargarPersonas()}catch(e){say(e.message)}}
