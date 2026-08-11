import { neon } from '@neondatabase/serverless';

const text=(v,n)=>{v=String(v??'').trim();if(!v)throw Error(n+' es obligatorio');return v};
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v??''))?String(v):new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
const positive=(v,n)=>{v=Number(String(v).replace(',','.'));if(!Number.isFinite(v)||v<=0)throw Error(n+' debe ser mayor a cero');return v};
const result=rows=>rows[0];

export default async function handler(req,res){
 try{
  if(!process.env.DATABASE_URL)throw Error('Falta configurar DATABASE_URL en Vercel');
  const p={...req.query,...(typeof req.body==='object'&&req.body?req.body:{})},sql=neon(process.env.DATABASE_URL);
  let data;
  switch(p.action){
   case 'getAll':{
    const [tareas,pesos,entrenamientos,habitos,habitoLogs,diario]=await Promise.all([
     sql\`SELECT id::text,fecha::text,texto,hecha,creado::text FROM tareas ORDER BY fecha,creado\`,
     sql\`SELECT id::text,fecha::text,kg::float8 AS kg,nota FROM pesos ORDER BY fecha\`,
     sql\`SELECT id::text,fecha::text,tipo,duracion_min,nota FROM entrenamientos ORDER BY fecha\`,
     sql\`SELECT id::text,nombre,activo,creado::text FROM habitos ORDER BY creado\`,
     sql\`SELECT id::text,habito_id::text,fecha::text FROM habito_logs ORDER BY fecha\`,
     sql\`SELECT id::text,fecha::text,texto,creado::text FROM diario ORDER BY fecha\`
    ]);data={tareas,pesos,entrenamientos,habitos,habitoLogs,diario};break}
   case 'addTarea':data=result(await sql\`INSERT INTO tareas(fecha,texto) VALUES (${day(p.fecha)},${text(p.texto,'Tarea')}) RETURNING id::text,fecha::text,texto,hecha,creado::text\`);break;
   case 'addPeso':data=result(await sql\`INSERT INTO pesos(fecha,kg,nota) VALUES (${day(p.fecha)},${positive(p.kg,'Peso')},${String(p.nota??'')}) RETURNING id::text,fecha::text,kg::float8 AS kg,nota\`);break;
   case 'addEntrenamiento':data=result(await sql\`INSERT INTO entrenamientos(fecha,tipo,duracion_min,nota) VALUES (${day(p.fecha)},${text(p.tipo,'Tipo')},${positive(p.duracion_min||1,'Duración')},${String(p.nota??'')}) RETURNING id::text,fecha::text,tipo,duracion_min,nota\`);break;
   case 'addDiario':data=result(await sql\`INSERT INTO diario(fecha,texto) VALUES (${day(p.fecha)},${text(p.texto,'Nota')}) RETURNING id::text,fecha::text,texto,creado::text\`);break;
   case 'addHabito':data=result(await sql\`INSERT INTO habitos(nombre) VALUES (${text(p.nombre,'Hábito')}) RETURNING id::text,nombre,activo,creado::text\`);break;
   case 'updateTarea':data=result(await sql\`UPDATE tareas SET texto=${text(p.texto,'Tarea')},fecha=${day(p.fecha)} WHERE id=${p.id} RETURNING id::text,fecha::text,texto,hecha,creado::text\`);break;
   case 'updatePeso':data=result(await sql\`UPDATE pesos SET kg=${positive(p.kg,'Peso')},fecha=${day(p.fecha)},nota=${String(p.nota??'')} WHERE id=${p.id} RETURNING id::text,fecha::text,kg::float8 AS kg,nota\`);break;
   case 'updateEntrenamiento':data=result(await sql\`UPDATE entrenamientos SET tipo=${text(p.tipo,'Tipo')},duracion_min=${positive(p.duracion_min||1,'Duración')},fecha=${day(p.fecha)},nota=${String(p.nota??'')} WHERE id=${p.id} RETURNING id::text,fecha::text,tipo,duracion_min,nota\`);break;
   case 'updateDiario':data=result(await sql\`UPDATE diario SET texto=${text(p.texto,'Nota')},fecha=${day(p.fecha)} WHERE id=${p.id} RETURNING id::text,fecha::text,texto,creado::text\`);break;
   case 'updateHabito':data=p.nombre!==undefined?result(await sql\`UPDATE habitos SET nombre=${text(p.nombre,'Hábito')} WHERE id=${p.id} RETURNING id::text,nombre,activo,creado::text\`):result(await sql\`UPDATE habitos SET activo=${(p.activo===true||p.activo==='true')} WHERE id=${p.id} RETURNING id::text,nombre,activo,creado::text\`);break;
   case 'toggleTarea':data=result(await sql\`UPDATE tareas SET hecha=${(p.hecha===true||p.hecha==='true')} WHERE id=${p.id} RETURNING id::text,fecha::text,texto,hecha,creado::text\`);break;
   case 'toggleHabitoLog':{const d=day(p.fecha),deleted=await sql\`DELETE FROM habito_logs WHERE habito_id=${p.habito_id} AND fecha=${d} RETURNING id\`;if(deleted.length)data={marcado:false};else{await sql\`INSERT INTO habito_logs(habito_id,fecha) VALUES (${p.habito_id},${d})\`;data={marcado:true}}break;
   case 'deleteTarea':await sql\`DELETE FROM tareas WHERE id=${p.id}\`;data={id:p.id,deleted:true};break;
   case 'deletePeso':await sql\`DELETE FROM pesos WHERE id=${p.id}\`;data={id:p.id,deleted:true};break;
   case 'deleteEntrenamiento':await sql\`DELETE FROM entrenamientos WHERE id=${p.id}\`;data={id:p.id,deleted:true};break;
   case 'deleteDiario':await sql\`DELETE FROM diario WHERE id=${p.id}\`;data={id:p.id,deleted:true};break;
   case 'deleteHabito':await sql\`DELETE FROM habitos WHERE id=${p.id}\`;data={id:p.id,deleted:true};break;
   default:throw Error('Acción desconocida')
  }
  if(!data)throw Error('Registro no encontrado');res.status(200).json({ok:true,data});
 }catch(e){res.status(400).json({ok:false,error:e.message||'Error inesperado'})}
}