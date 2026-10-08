// VidaPlus - modulo carga masiva: pegar desde Excel o subir CSV, revisar y confirmar
let IMP_TIPO='gastos',IMP_FILAS=null,IMP_RES=null,IMP_ERR='';
const IMP_CFG={
  gastos:{titulo:'Gastos e ingresos',accion:'importGastos',cols:['fecha','monto','categoria','descripcion','tipo'],ejemplo:['08/10/2026','12500','Supermercado','Verdulería','gasto'],ayuda:'En "tipo" poné gasto o ingreso (si lo dejás vacío es gasto). La fecha puede ser 08/10/2026 o 2026-10-08.',alias:{fecha:['fecha','dia'],monto:['monto','importe','valor','total','precio'],categoria:['categoria','rubro'],descripcion:['descripcion','detalle','concepto','nota'],tipo:['tipo']}},
  tareas:{titulo:'Tareas y recordatorios',accion:'importTareas',cols:['fecha','hora','texto','categoria','monto','detalle','alerta'],ejemplo:['09/10/2026','13:00','Pedir presupuesto de pintura','presupuesto','','Llamar a Rodríguez','si'],ayuda:'Categorías: personal, familia, compras, presupuesto o trabajo. En "alerta" poné si para que te avise por WhatsApp a la hora indicada.',alias:{fecha:['fecha','dia'],hora:['hora','horario'],texto:['texto','tarea','titulo','actividad'],categoria:['categoria'],monto:['monto','importe','estimado'],detalle:['detalle','nota','notas','proveedor'],alerta:['alerta','aviso','whatsapp']}},
  personas:{titulo:'Personas (contactos)',accion:'importPersonas',cols:['nombre','rol','organizacion','ciudad','telefono','email','prioridad','estado','notas','proxima_accion','proxima_fecha'],ejemplo:['Ana Pérez','Productora','Radio Norte','Tucumán','5493815550000','ana@correo.com','A','nuevo','La conocí en la peña','Mandar el dossier','12/10/2026'],ayuda:'Solo el nombre es obligatorio. Prioridad: A, B o C. Estado: nuevo, contactado, respondió, reunión, propuesta o pausa.',alias:{nombre:['nombre','contacto','persona'],rol:['rol','cargo','puesto'],organizacion:['organizacion','empresa','medio','lugar'],ciudad:['ciudad','localidad'],telefono:['telefono','celular','whatsapp','tel'],email:['email','mail','correo'],prioridad:['prioridad','nivel'],estado:['estado'],notas:['notas','nota','observaciones'],proxima_accion:['proxima_accion','proximo_paso','proxima accion','proximo paso'],proxima_fecha:['proxima_fecha','fecha_proximo_paso','proxima fecha']}}
};
const impNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();

function impParse(texto){
  texto=String(texto||'').replace(/^﻿/,'');
  const first=texto.split(/\r?\n/)[0]||'';
  const delim=[['\t',(first.match(/\t/g)||[]).length],[';',(first.match(/;/g)||[]).length],[',',(first.match(/,/g)||[]).length]].sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<texto.length;i++){
    const c=texto[i];
    if(q){if(c==='"'){if(texto[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
    else if(c==='"')q=true;
    else if(c===delim){row.push(cell);cell=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&texto[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>String(x).trim()!==''))rows.push(row);row=[]}
    else cell+=c;
  }
  row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);
  return rows;
}
function impFilas(rows){
  const cfg=IMP_CFG[IMP_TIPO];
  if(!rows.length)return [];
  const mapa=rows[0].map(h=>{const n=impNorm(h);return Object.keys(cfg.alias).find(k=>cfg.alias[k].map(impNorm).includes(n)||impNorm(k)===n)||null});
  const hayCabecera=mapa.some(Boolean);
  const cols=hayCabecera?mapa:cfg.cols;
  return (hayCabecera?rows.slice(1):rows).map(r=>{const o={};cols.forEach((k,i)=>{if(k)o[k]=String(r[i]??'').trim()});return o});
}
function impRevisar(texto){
  IMP_RES=null;IMP_ERR='';
  try{IMP_FILAS=impFilas(impParse(texto))}catch(e){IMP_FILAS=null;IMP_ERR='No pude leer el contenido. Revisá que tenga columnas separadas por tabulación, punto y coma o coma.'}
  if(IMP_FILAS&&!IMP_FILAS.length)IMP_ERR='No encontré filas para importar.';
  render();
}
function impArchivo(f){
  if(!f)return;
  if(/\.xlsx?$/i.test(f.name)){IMP_FILAS=null;IMP_ERR='Los archivos de Excel no se leen directo. En Excel elegí Archivo > Guardar como > CSV, o copiá las celdas y pegalas en el cuadro de abajo.';IMP_RES=null;return render()}
  const r=new FileReader();r.onload=()=>impRevisar(r.result);r.onerror=()=>{IMP_ERR='No pude abrir el archivo.';render()};r.readAsText(f,'utf-8');
}
function impTipo(t){IMP_TIPO=t;IMP_FILAS=null;IMP_RES=null;IMP_ERR='';render()}
function impPlantilla(){
  const cfg=IMP_CFG[IMP_TIPO],q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const csv='﻿'+[cfg.cols,cfg.ejemplo].map(r=>r.map(q).join(';')).join('\r\n')+'\r\n';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='plantilla_'+IMP_TIPO+'.csv';document.body.appendChild(a);a.click();a.remove();
}
async function impConfirmar(){
  if(!IMP_FILAS||!IMP_FILAS.length)return;
  const cfg=IMP_CFG[IMP_TIPO];
  busy(1,'Importando '+IMP_FILAS.length+' filas…');
  let ins=0,errs=[];
  try{
    for(let i=0;i<IMP_FILAS.length;i+=500){
      const r=await api(cfg.accion,{filas:IMP_FILAS.slice(i,i+500)});
      ins+=r.insertados;errs=errs.concat(r.errores.map(e=>({fila:e.fila+i,motivo:e.motivo})));
    }
    IMP_RES={insertados:ins,errores:errs};IMP_FILAS=null;
    if(IMP_TIPO==='tareas')DB=await api('getAll');
    if(IMP_TIPO==='personas')PERS=null;
    if(IMP_TIPO==='gastos')FIN=null;
  }catch(e){IMP_ERR=e.message}
  finally{busy(0);render()}
}

VIEWS.importar=function(){
  const cfg=IMP_CFG[IMP_TIPO];
  const tabs=Object.entries(IMP_CFG).map(([k,c])=>`<button class="chip ${IMP_TIPO===k?'on':''}" onclick="impTipo('${k}')">${c.titulo}</button>`).join('');
  let prev='';
  if(IMP_FILAS&&IMP_FILAS.length){
    const cols=cfg.cols.filter(c=>IMP_FILAS.some(f=>f[c]!==undefined));
    prev=`<div class="fin-box" style="margin-top:14px"><h2>Revisá antes de importar: ${IMP_FILAS.length} fila${IMP_FILAS.length===1?'':'s'}</h2><div class="imp-scroll"><table class="imp-tabla"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${IMP_FILAS.slice(0,8).map(f=>`<tr>${cols.map(c=>`<td>${esc(f[c]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${IMP_FILAS.length>8?`<div class="sub" style="margin:8px 0">Se muestran las primeras 8 de ${IMP_FILAS.length}.</div>`:''}<button class="fin-go" style="margin-top:10px" onclick="impConfirmar()">Importar ${IMP_FILAS.length} fila${IMP_FILAS.length===1?'':'s'}</button></div>`;
  }
  const res=IMP_RES?`<div class="fin-box imp-ok" style="margin-top:14px"><h2>Listo: se importaron ${IMP_RES.insertados} fila${IMP_RES.insertados===1?'':'s'}</h2>${IMP_RES.errores.length?`<div class="sub">No se pudieron importar ${IMP_RES.errores.length}:</div>${IMP_RES.errores.slice(0,15).map(e=>`<div class="imp-err">Fila ${e.fila}: ${esc(e.motivo)}</div>`).join('')}`:'<div class="sub">Sin errores.</div>'}</div>`:'';
  return `<div class="module-head"><button class="link" onclick="go('hub')">‹ Menú principal</button><h1>Carga masiva</h1><p>Pasá muchas filas de una sola vez desde Excel, Google Sheets o un archivo CSV.</p></div><div class="chip-group" style="margin-bottom:14px">${tabs}</div><div class="fin-box"><h2>${cfg.titulo}</h2><p class="sub" style="margin-bottom:10px">Columnas: <b>${cfg.cols.join(', ')}</b>. ${cfg.ayuda}</p><div class="imp-acc"><button class="cancel" onclick="impPlantilla()">Descargar plantilla</button><label class="cancel imp-file">Subir archivo CSV<input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" onchange="impArchivo(this.files[0])" hidden></label></div><label class="form-field" style="margin-top:12px">O copiá las celdas desde Excel y pegalas acá<textarea id="impTxt" class="imp-txt" placeholder="Pegá aquí. La primera fila puede ser la de los títulos de columna."></textarea></label><button class="save" style="width:100%" onclick="impRevisar($('#impTxt').value)">Revisar</button>${IMP_ERR?`<div class="imp-err" style="margin-top:10px">${esc(IMP_ERR)}</div>`:''}</div>${prev}${res}`;
};
