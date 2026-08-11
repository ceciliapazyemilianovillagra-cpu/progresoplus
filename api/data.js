import { neon } from '@neondatabase/serverless';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const text=(v,n)=>{v=String(v??'').trim();if(!v)throw Error(n+' es obligatorio');return v};
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v??''))?String(v):new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
const positive=(v,n)=>{v=Number(String(v).replace(',','.'));if(!Number.isFinite(v)||v<=0)throw Error(n+' debe ser mayor a cero');return v};
const row=a=>a[0];
const hash=p=>{const s=randomBytes(16).toString('hex');return s+':'+scryptSync(p,s,64).toString('hex')};
const matches=(p,stored)=>{const [s,h]=String(stored).split(':');const a=Buffer.from(h,'hex'),b=scryptSync(p,s,64);return a.length===b.length&&timingSafeEqual(a,b)};
const secret=()=>process.env.SESSION_SECRET||process.env.DATABASE_URL;
const token=u=>{const p=Buffer.from(JSON.stringify({id:u.id,email:u.email,exp:Date.now()+1000*60*60*24*30})).toString('base64url');return p+'.'+createHmac('sha256',secret()).update(p).digest('base64url')};
const userFrom=req=>{const c=req.headers.cookie||'',m=c.match(/(?:^|;\\s*)progreso_session=([^;]+)/);if(!m)return null;const [p,s]=decodeURIComponent(m[1]).split('.'),sig=createHmac('sha256',secret()).update(p).digest('base64url');if(!p||!s||sig!==s)return null;try{const u=JSON.parse(Buffer.from(p,'base64url'));return u.exp>Date.now()?u:null}catch{return null}};
const cookie=v=>\`progreso_session=\${encodeURIComponent(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000\`;
const clear='progreso_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

export default async function handler(req,res){
 try{
  if(!process.env.DATABASE_URL)throw Error('Falta configurar DATABASE_URL en Vercel');
  const p={...req.query,...(typeof req.body==='object'&&req.body?req.body:{})},sql=neon(process.env.DATABASE_URL);
  if(p.action==='register'){
   const email=text(p.email,'Email').toLowerCase(),password=text(p.password,'Contraseña');
   if(password.length<8)throw Error('La contraseña debe tener al menos 8 caracteres');
   const u=row(await sql\`INSERT INTO usuarios(email,nombre,password_hash) VALUES (\${email},\${text(p.nombre,'Nombre')},\${hash(password)}) RETURNING id::text,email,nombre\`);
   await sql\`INSERT INTO configuracion_usuario(usuario_id) VALUES (\${u.id})\`;
   const prior=await sql`SELECT count(*)::int AS total FROM usuarios`;
   if(prior[0].total===1){await Promise.all([sql`UPDATE tareas SET usuario_id=${u.id} WHERE usuario_id IS NULL`,sql`UPDATE pesos SET usuario_id=${u.id} WHERE usuario_id IS NULL`,sql`UPDATE entrenamientos SET usuario_id=${u.id} WHERE usuario_id IS NULL`,sql`UPDATE habitos SET usuario_id=${u.id} WHERE usuario_id IS NULL`,sql`UPDATE diario SET usuario_id=${u.id} WHERE usuario_id IS NULL`])}
   res.setHeader('Set-Cookie',cookie(token(u)));return res.status(201).json({ok:true,data:{user:u}});
  }
  if(p.action==='login'){
   const u=row(await sql\`SELECT id::text,email,nombre,password_hash FROM usuarios WHERE email=\${text(p.email,'Email').toLowerCase()}\`);
   if(!u||!matches(text(p.password,'Contraseña'),u.password_hash))throw Error('Email o contraseña incorrectos');
   const clean={id:u.id,email:u.email,nombre:u.nombre};res.setHeader('Set-Cookie',cookie(token(clean)));return res.status(200).json({ok:true,data:{user:clean}});
  }
  if(p.action==='logout'){res.setHeader('Set-Cookie',clear);return res.status(200).json({ok:true,data:{}})}
  const user=userFrom(req);if(!user)throw Error('Sesión requerida');
  if(p.action==='session'){const settings=row(await sql\`SELECT recordatorios_activos,canal_recordatorio,webhook_url,zona_horaria FROM configuracion_usuario WHERE usuario_id=\${user.id}\`);return res.status(200).json({ok:true,data:{user,settings}})}
  let data;
  switch(p.action){
   case 'getAll':{const [tareas,pesos,entrenamientos,habitos,habitoLogs,diario]=await Promise.all([
    sql\`SELECT id::text,fecha::text,texto,hecha,creado::text,vencimiento::text FROM tareas WHERE usuario_id=\${user.id} ORDER BY fecha,creado\`,
    sql\`SELECT id::text,fecha::text,kg::float8 AS kg,nota FROM pesos WHERE usuario_id=\${user.id} ORDER BY fecha\`,
    sql\`SELECT id::text,fecha::text,tipo,duracion_min,nota FROM entrenamientos WHERE usuario_id=\${user.id} ORDER BY fecha\`,
    sql\`SELECT id::text,nombre,activo,creado::text FROM habitos WHERE usuario_id=\${user.id} ORDER BY creado\`,
    sql\`SELECT l.id::text,l.habito_id::text,l.fecha::text FROM habito_logs l JOIN habitos h ON h.id=l.habito_id WHERE h.usuario_id=\${user.id} ORDER BY l.fecha\`,
    sql\`SELECT id::text,fecha::text,texto,creado::text FROM diario WHERE usuario_id=\${user.id} ORDER BY fecha\`
   ]);data={tareas,pesos,entrenamientos,habitos,habitoLogs,diario};break}
   case 'saveSettings':data=row(await sql\`UPDATE configuracion_usuario SET recordatorios_activos=\${p.recordatorios_activos===true||p.recordatorios_activos==='true'},canal_recordatorio=\${['ninguno','zapier','telegram','whatsapp'].includes(p.canal_recordatorio)?p.canal_recordatorio:'ninguno'},webhook_url=\${String(p.webhook_url||'')},zona_horaria=\${String(p.zona_horaria||'America/Argentina/Buenos_Aires')},actualizado=now() WHERE usuario_id=\${user.id} RETURNING recordatorios_activos,canal_recordatorio,webhook_url,zona_horaria\`);break;
   case 'addTarea':data=row(await sql\`INSERT INTO tareas(usuario_id,fecha,texto,vencimiento) VALUES (\${user.id},\${day(p.fecha)},\${text(p.texto,'Tarea')},\${p.vencimiento||null}) RETURNING id::text,fecha::text,texto,hecha,creado::text,vencimiento::text\`);break;
   case 'addPeso':data=row(await sql\`INSERT INTO pesos(usuario_id,fecha,kg,nota) VALUES (\${user.id},\${day(p.fecha)},\${positive(p.kg,'Peso')},\${String(p.nota||'')}) RETURNING id::text,fecha::text,kg::float8 AS kg,nota\`);break;
   case 'addEntrenamiento':data=row(await sql\`INSERT INTO entrenamientos(usuario_id,fecha,tipo,duracion_min,nota) VALUES (\${user.id},\${day(p.fecha)},\${text(p.tipo,'Tipo')},\${positive(p.duracion_min||1,'Duración')},\${String(p.nota||'')}) RETURNING id::text,fecha::text,tipo,duracion_min,nota\`);break;
   case 'addDiario':data=row(await sql\`INSERT INTO diario(usuario_id,fecha,texto) VALUES (\${user.id},\${day(p.fecha)},\${text(p.texto,'Nota')}) RETURNING id::text,fecha::text,texto,creado::text\`);break;
   case 'addHabito':data=row(await sql\`INSERT INTO habitos(usuario_id,nombre) VALUES (\${user.id},\${text(p.nombre,'Hábito')}) RETURNING id::text,nombre,activo,creado::text\`);break;
   case 'updateTarea':data=row(await sql`UPDATE tareas SET texto=${text(p.texto,'Tarea')},fecha=${day(p.fecha)},vencimiento=${p.vencimiento||null} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,texto,hecha,creado::text,vencimiento::text`);break;
   case 'updatePeso':data=row(await sql`UPDATE pesos SET kg=${positive(p.kg,'Peso')},fecha=${day(p.fecha)},nota=${String(p.nota||'')} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,kg::float8 AS kg,nota`);break;
   case 'updateEntrenamiento':data=row(await sql`UPDATE entrenamientos SET tipo=${text(p.tipo,'Tipo')},duracion_min=${positive(p.duracion_min||1,'Duración')},fecha=${day(p.fecha)},nota=${String(p.nota||'')} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,tipo,duracion_min,nota`);break;
   case 'updateDiario':data=row(await sql`UPDATE diario SET texto=${text(p.texto,'Nota')},fecha=${day(p.fecha)} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,texto,creado::text`);break;
   case 'updateHabito':data=p.nombre!==undefined?row(await sql`UPDATE habitos SET nombre=${text(p.nombre,'Hábito')} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,nombre,activo,creado::text`):row(await sql`UPDATE habitos SET activo=${(p.activo===true||p.activo==='true')} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,nombre,activo,creado::text`);break;
   case 'toggleTarea':data=row(await sql`UPDATE tareas SET hecha=${(p.hecha===true||p.hecha==='true')} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,texto,hecha,creado::text,vencimiento::text`);break;
   case 'toggleHabitoLog':{const d=day(p.fecha),deleted=await sql`DELETE FROM habito_logs l USING habitos h WHERE l.habito_id=h.id AND l.habito_id=${p.habito_id} AND l.fecha=${d} AND h.usuario_id=${user.id} RETURNING l.id`;if(deleted.length)data={marcado:false};else{const h=row(await sql`SELECT id FROM habitos WHERE id=${p.habito_id} AND usuario_id=${user.id}`);if(!h)throw Error('Registro no encontrado');await sql`INSERT INTO habito_logs(habito_id,fecha) VALUES (${p.habito_id},${d})`;data={marcado:true}}}break;
   case 'deleteTarea':await sql`DELETE FROM tareas WHERE id=${p.id} AND usuario_id=${user.id}`;data={id:p.id,deleted:true};break;
   case 'deletePeso':await sql`DELETE FROM pesos WHERE id=${p.id} AND usuario_id=${user.id}`;data={id:p.id,deleted:true};break;
   case 'deleteEntrenamiento':await sql`DELETE FROM entrenamientos WHERE id=${p.id} AND usuario_id=${user.id}`;data={id:p.id,deleted:true};break;
   case 'deleteDiario':await sql`DELETE FROM diario WHERE id=${p.id} AND usuario_id=${user.id}`;data={id:p.id,deleted:true};break;
   case 'deleteHabito':await sql`DELETE FROM habitos WHERE id=${p.id} AND usuario_id=${user.id}`;data={id:p.id,deleted:true};break;
   default:throw Error('Acción no disponible todavía')
  }
  if(!data)throw Error('Registro no encontrado');res.status(200).json({ok:true,data});
 }catch(e){res.status(400).json({ok:false,error:e.message||'Error inesperado'})}
}