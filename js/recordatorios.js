// VidaPlus - modulo Agenda (tareas con fecha, categoria y aviso por WhatsApp). Es el unico lugar de tareas.
let REC_CAT='todas';
function recCat(c){REC_CAT=c;render()}

VIEWS.recordatorios=function(kind){
  const s=AUTH?.settings||{};
  if(!s.recordatorios_premium)return `<div class="module-head"><button class="link" onclick="go('hub')">‹ Inicio</button><h1>Agenda</h1><p>Tareas con fecha y aviso por WhatsApp.</p></div><div class="card" style="text-align:center;padding:30px 20px"><div style="width:56px;height:56px;border-radius:50%;background:#12121A;display:grid;place-items:center;margin:0 auto 14px"><svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:#fff;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg></div><h2 style="margin:0 0 8px">Plan Pro</h2><p class="sub" style="margin:0 0 18px">Con el plan Pro tenés la Agenda con calendario y avisos automáticos por WhatsApp antes de que venza cada tarea. Es una suscripción aparte, con costo aparte.</p><a href="${LINK_SUSCRIPCION_PRO}" target="_blank" rel="noopener" style="display:block;background:var(--violet);color:#fff;text-decoration:none;font-weight:800;padding:13px;border-radius:10px;font-size:14px">Suscribirme al plan Pro</a></div>`;
  const fechaDe=x=>x.vencimiento?x.vencimiento.slice(0,10):x.fecha;
  const filtro=x=>REC_CAT==='todas'||x.categoria===REC_CAT;
  const pend=DB.tareas.filter(x=>!x.hecha&&filtro(x)).sort((a,b)=>(a.vencimiento||a.fecha).localeCompare(b.vencimiento||b.fecha));
  const hechas=DB.tareas.filter(x=>x.hecha&&filtro(x)).sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,60);
  const chips=[['todas','Todas'],...Object.entries(TASK_CATS)].map(([k,l])=>`<button class="chip ${REC_CAT===k?'on':''}" onclick="recCat('${k}')">${l}</button>`).join('');
  const tot=pend.reduce((a,x)=>a+(Number(x.monto)||0),0);
  return `<div class="module-head rec-head"><div><button class="link" onclick="go('hub')">‹ Inicio</button><h1>Agenda</h1><p>Tus tareas con fecha. Si les ponés hora y activás el aviso, te llegan por WhatsApp.</p></div><button class="btn-b" onclick="openForm('tareas')">+ Nueva tarea</button></div>
${waUsageHtml()}
<div class="agenda"><div class="agenda-month">${calendarWidget()}</div><div class="agenda-week">${weekStripHtml()}${agendaDelDia()}</div></div>
<div class="chip-group rec-chips">${chips}</div>
<div class="fin-box"><h2>Pendientes (${pend.length})${tot?` <small class="sub">· ${money(tot)} estimado</small>`:''}</h2>${pend.map(taskItem).join('')||'<div class="empty">No hay tareas pendientes en esta categoría.</div>'}</div>
${hechas.length?`<details class="card done-list"><summary>Hechas (${hechas.length})</summary>${hechas.map(taskItem).join('')}</details>`:''}
<details class="mod-sec"><summary><h2>Avisos por WhatsApp</h2></summary><div class="mod-sec-body"><form onsubmit="saveSettings(event)"><input type="hidden" name="canal_recordatorio" value="whatsapp"><input type="hidden" name="webhook_url" value="${esc(s.webhook_url||'')}"><label class="form-field">Tu número de WhatsApp (con código de país, solo números)<input name="whatsapp_phone" inputmode="numeric" placeholder="5493811234567" value="${esc(s.whatsapp_phone||'')}"></label><label class="inline-check"><input name="recordatorios_activos" type="checkbox" ${s.recordatorios_activos?'checked':''}>Quiero recibir los avisos</label><button class="save" style="width:100%;margin-top:14px;border-radius:10px;padding:13px;font-weight:800">Guardar</button>${AUTH?.user?.rol==='admin'?`<button type="button" class="link" style="margin-top:10px;width:100%;text-align:center" onclick="testWhatsapp()">Enviar WhatsApp de prueba</button>`:''}</form></div></details>`;
};
