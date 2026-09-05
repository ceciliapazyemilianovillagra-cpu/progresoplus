import postgres from 'postgres';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getAiMonitoring } from './ai-events.js';

const text=(v,n)=>{v=String(v??'').trim();if(!v)throw Error(n+' es obligatorio');return v};
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v??''))?String(v):new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
const positive=(v,n)=>{v=Number(String(v).replace(',','.'));if(!Number.isFinite(v)||v<=0)throw Error(n+' debe ser mayor a cero');return v};
const row=a=>a[0];
const hash=p=>{const s=randomBytes(16).toString('hex');return s+':'+scryptSync(p,s,64).toString('hex')};
const matches=(p,stored)=>{const [s,h]=String(stored).split(':');const a=Buffer.from(h,'hex'),b=scryptSync(p,s,64);return a.length===b.length&&timingSafeEqual(a,b)};
const secret=()=>process.env.SESSION_SECRET||process.env.DATABASE_URL;
const token=u=>{const p=Buffer.from(JSON.stringify({id:u.id,email:u.email,exp:Date.now()+1000*60*60*24*30})).toString('base64url');return p+'.'+createHmac('sha256',secret()).update(p).digest('base64url')};
const userFrom=req=>{const c=req.headers.cookie||'',m=c.match(/(?:^|;\\s*)progreso_session=([^;]+)/);if(!m)return null;const [p,s]=decodeURIComponent(m[1]).split('.'),sig=createHmac('sha256',secret()).update(p).digest('base64url');if(!p||!s||sig!==s)return null;try{const u=JSON.parse(Buffer.from(p,'base64url'));return u.exp>Date.now()?u:null}catch{return null}};
const cookie=v=>`progreso_session=${encodeURIComponent(v)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
const clear='progreso_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

export default async function handler(req,res){
 try{
  if(!process.env.DATABASE_URL)throw Error('Falta configurar DATABASE_URL en Vercel');
  const p={...req.query,...(typeof req.body==='object'&&req.body?req.body:{})},sql=postgres(process.env.DATABASE_URL,{ssl:'require',prepare:false,max:1,idle_timeout:5});
  if(p.action==='register'){
   const email=text(p.email,'Email').toLowerCase(),password=text(p.password,'Contraseña'),usuario=text(p.usuario||email.split('@')[0],'Usuario').toLowerCase();
   if(password.length<8)throw Error('La contraseña debe tener al menos 8 caracteres');
   const prior=row(await sql`SELECT count(*)::int AS total FROM usuarios`),isBootstrap=prior.total===0&&email==='emilianovillagra@gmail.com';
   if(!isBootstrap)throw Error('Las cuentas las crea el administrador');
   const u=row(await sql`INSERT INTO usuarios(email,usuario,nombre,password_hash,rol) VALUES (${email},${usuario},${text(p.nombre||'Emiliano Villagra','Nombre')},${hash(password)},'admin') RETURNING id::text,email,usuario,nombre,rol`);
   await sql`INSERT INTO configuracion_usuario(usuario_id) VALUES (${u.id})`;
   await Promise.all([sql`UPDATE tareas SET usuario_id=${u.id} WHERE usuario_id IS NULL`,sql`UPDATE pesos SET usuario_id=${u.id} WHERE usuario_id IS NULL`,sql`UPDATE entrenamientos SET usuario_id=${u.id} WHERE usuario_id IS NULL`,sql`UPDATE habitos SET usuario_id=${u.id} WHERE usuario_id IS NULL`,sql`UPDATE diario SET usuario_id=${u.id} WHERE usuario_id IS NULL`]);
   res.setHeader('Set-Cookie',cookie(token(u)));return res.status(201).json({ok:true,data:{user:u}});
  }
  if(p.action==='login'){
   const login=text(p.usuario||p.email,'Usuario').toLowerCase(),u=row(await sql`SELECT id::text,email,usuario,nombre,rol,password_hash FROM usuarios WHERE lower(usuario)=${login} OR email=${login}`);
   if(!u||!matches(text(p.password,'Contraseña'),u.password_hash))throw Error('Usuario o contraseña incorrectos');
   const clean={id:u.id,email:u.email,usuario:u.usuario,nombre:u.nombre,rol:u.rol};res.setHeader('Set-Cookie',cookie(token(clean)));return res.status(200).json({ok:true,data:{user:clean}});
  }
  if(p.action==='logout'){res.setHeader('Set-Cookie',clear);return res.status(200).json({ok:true,data:{}})}
  const user=userFrom(req);if(!user)throw Error('Sesión requerida');
  const account=row(await sql`SELECT id::text,email,usuario,nombre,rol FROM usuarios WHERE id=${user.id}`);if(!account){res.setHeader('Set-Cookie',clear);throw Error('Sesión requerida')}
  if(p.action==='session'){const settings=row(await sql`SELECT recordatorios_activos,canal_recordatorio,webhook_url,whatsapp_phone,zona_horaria FROM configuracion_usuario WHERE usuario_id=${user.id}`);return res.status(200).json({ok:true,data:{user:account,settings}})}
  if(['listUsers','createUser','updateUser','resetPassword','deleteUser','getAiMonitoring','testWhatsapp'].includes(p.action)&&account.rol!=='admin')throw Error('Solo el administrador puede gestionar usuarios');
  let data;
  switch(p.action){
   case 'getAiMonitoring':data=await getAiMonitoring();break;
   case 'listUsers':data=await sql`SELECT id::text,email,usuario,nombre,rol,creado::text FROM usuarios ORDER BY creado`;break;
   case 'createUser':{const email=text(p.email,'Email').toLowerCase(),usuario=text(p.usuario,'Usuario').toLowerCase(),password=text(p.password,'Contraseña');if(password.length<8)throw Error('La contraseña debe tener al menos 8 caracteres');data=row(await sql`INSERT INTO usuarios(email,usuario,nombre,password_hash,rol) VALUES (${email},${usuario},${text(p.nombre,'Nombre')},${hash(password)},${p.rol==='admin'?'admin':'user'}) RETURNING id::text,email,usuario,nombre,rol,creado::text`);await sql`INSERT INTO configuracion_usuario(usuario_id) VALUES (${data.id})`;break;}
   case 'updateUser':data=row(await sql`UPDATE usuarios SET email=${text(p.email,'Email').toLowerCase()},usuario=${text(p.usuario,'Usuario').toLowerCase()},nombre=${text(p.nombre,'Nombre')},rol=${p.rol==='admin'?'admin':'user'} WHERE id=${p.id} RETURNING id::text,email,usuario,nombre,rol,creado::text`);break;
   case 'resetPassword':{const password=text(p.password,'Contraseña');if(password.length<8)throw Error('La contraseña debe tener al menos 8 caracteres');await sql`UPDATE usuarios SET password_hash=${hash(password)} WHERE id=${p.id}`;data={id:p.id,reset:true};break;}
   case 'deleteUser':if(p.id===account.id)throw Error('No podés eliminar tu propia cuenta');await sql`DELETE FROM usuarios WHERE id=${p.id}`;data={id:p.id,deleted:true};break;
   
   case 'getAll':{const [tareas,pesos,entrenamientos,habitos,habitoLogs,diario,comidas]=await Promise.all([
    sql`SELECT id::text,fecha::text,texto,hecha,creado::text,vencimiento::text,alerta FROM tareas WHERE usuario_id=${user.id} ORDER BY fecha,creado`,
    sql`SELECT id::text,fecha::text,kg::float8 AS kg,nota FROM pesos WHERE usuario_id=${user.id} ORDER BY fecha`,
    sql`SELECT id::text,fecha::text,fecha_hasta::text,tipo,detalle,duracion_min,nota FROM entrenamientos WHERE usuario_id=${user.id} ORDER BY fecha`,
    sql`SELECT id::text,nombre,activo,frecuencia,dia_semana,dia_mes,creado::text FROM habitos WHERE usuario_id=${user.id} ORDER BY creado`,
    sql`SELECT l.id::text,l.habito_id::text,l.fecha::text FROM habito_logs l JOIN habitos h ON h.id=l.habito_id WHERE h.usuario_id=${user.id} ORDER BY l.fecha`,
    sql`SELECT id::text,fecha::text,texto,creado::text FROM diario WHERE usuario_id=${user.id} ORDER BY fecha`,
    sql`SELECT id::text,fecha::text,tipo,alimentos,calorias,proteinas::float8 AS proteinas,carbohidratos::float8 AS carbohidratos,grasas::float8 AS grasas,nota,creado::text FROM comidas WHERE usuario_id=${user.id} ORDER BY fecha DESC,creado DESC`
   ]);data={tareas,pesos,entrenamientos,habitos,habitoLogs,diario,comidas};break}
   case 'saveSettings':data=row(await sql`UPDATE configuracion_usuario SET recordatorios_activos=${p.recordatorios_activos===true||p.recordatorios_activos==='true'},canal_recordatorio=${['ninguno','zapier','telegram','whatsapp'].includes(p.canal_recordatorio)?p.canal_recordatorio:'ninguno'},webhook_url=${String(p.webhook_url||'')},whatsapp_phone=${String(p.whatsapp_phone||'').replace(/[^0-9]/g,'')},zona_horaria=${String(p.zona_horaria||'America/Argentina/Buenos_Aires')},actualizado=now() WHERE usuario_id=${user.id} RETURNING recordatorios_activos,canal_recordatorio,webhook_url,whatsapp_phone,zona_horaria`);break;
   case 'testWhatsapp':{const phone=String(p.phone||'').replace(/[^0-9]/g,'');if(phone.length<8)throw Error('Teléfono inválido');if(!process.env.SUPABASE_FUNCTIONS_URL||!process.env.WA_CRON_SECRET)throw Error('Falta configurar la integración de WhatsApp en Vercel');const r=await fetch(`${process.env.SUPABASE_FUNCTIONS_URL}/tareas-whatsapp`,{method:'POST',headers:{'Content-Type':'application/json','x-cron-secret':process.env.WA_CRON_SECRET},body:JSON.stringify({action:'test',phone})});const j=await r.json();if(!r.ok||j.error)throw Error(j.error||'No se pudo enviar el mensaje de prueba');data={sent:true,result:j};break}
   case 'addTarea':data=row(await sql`INSERT INTO tareas(usuario_id,fecha,texto,vencimiento,alerta) VALUES (${user.id},${day(p.fecha)},${text(p.texto,'Tarea')},${p.vencimiento||null},${p.alerta===true||p.alerta==='true'}) RETURNING id::text,fecha::text,texto,hecha,creado::text,vencimiento::text,alerta`);break;
   case 'addPeso':data=row(await sql`INSERT INTO pesos(usuario_id,fecha,kg,nota) VALUES (${user.id},${day(p.fecha)},${positive(p.kg,'Peso')},${String(p.nota||'')}) RETURNING id::text,fecha::text,kg::float8 AS kg,nota`);break;
   case 'addEntrenamiento':data=row(await sql`INSERT INTO entrenamientos(usuario_id,fecha,fecha_hasta,tipo,detalle,duracion_min,nota) VALUES (${user.id},${day(p.fecha)},${p.fecha_hasta?day(p.fecha_hasta):null},${text(p.tipo,'Tipo')},${String(p.detalle||'')},${positive(p.duracion_min||1,'Duración')},${String(p.nota||'')}) RETURNING id::text,fecha::text,fecha_hasta::text,tipo,detalle,duracion_min,nota`);break;
   case 'addDiario':data=row(await sql`INSERT INTO diario(usuario_id,fecha,texto) VALUES (${user.id},${day(p.fecha)},${text(p.texto,'Nota')}) RETURNING id::text,fecha::text,texto,creado::text`);break;
   case 'addComida':{const alimentos=Array.isArray(p.alimentos)?p.alimentos:[];data=row(await sql`INSERT INTO comidas(usuario_id,fecha,tipo,alimentos,calorias,proteinas,carbohidratos,grasas,nota) VALUES (${user.id},${day(p.fecha)},${String(p.tipo||'comida')},${JSON.stringify(alimentos)}::jsonb,${Math.max(0,Number(p.calorias)||0)},${Math.max(0,Number(p.proteinas)||0)},${Math.max(0,Number(p.carbohidratos)||0)},${Math.max(0,Number(p.grasas)||0)},${String(p.nota||'')}) RETURNING id::text,fecha::text,tipo,alimentos,calorias,proteinas::float8 AS proteinas,carbohidratos::float8 AS carbohidratos,grasas::float8 AS grasas,nota,creado::text`);break;}
   case 'deleteComida':await sql`DELETE FROM comidas WHERE id=${p.id} AND usuario_id=${user.id}`;data={id:p.id,deleted:true};break;
   case 'addHabito':data=row(await sql`INSERT INTO habitos(usuario_id,nombre,frecuencia,dia_semana,dia_mes) VALUES (${user.id},${text(p.nombre,'Hábito')},${['diario','semanal','mensual'].includes(p.frecuencia)?p.frecuencia:'diario'},${p.dia_semana===''||p.dia_semana==null?null:Number(p.dia_semana)},${p.dia_mes===''||p.dia_mes==null?null:Number(p.dia_mes)}) RETURNING id::text,nombre,activo,frecuencia,dia_semana,dia_mes,creado::text`);break;
   case 'updateTarea':data=row(await sql`UPDATE tareas SET texto=${text(p.texto,'Tarea')},fecha=${day(p.fecha)},vencimiento=${p.vencimiento||null},alerta=${p.alerta===true||p.alerta==='true'} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,texto,hecha,creado::text,vencimiento::text,alerta`);break;
   case 'updatePeso':data=row(await sql`UPDATE pesos SET kg=${positive(p.kg,'Peso')},fecha=${day(p.fecha)},nota=${String(p.nota||'')} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,kg::float8 AS kg,nota`);break;
   case 'updateEntrenamiento':data=row(await sql`UPDATE entrenamientos SET tipo=${text(p.tipo,'Tipo')},detalle=${String(p.detalle||'')},duracion_min=${positive(p.duracion_min||1,'Duración')},fecha=${day(p.fecha)},fecha_hasta=${p.fecha_hasta?day(p.fecha_hasta):null},nota=${String(p.nota||'')} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,fecha_hasta::text,tipo,detalle,duracion_min,nota`);break;
   case 'updateDiario':data=row(await sql`UPDATE diario SET texto=${text(p.texto,'Nota')},fecha=${day(p.fecha)} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,fecha::text,texto,creado::text`);break;
   case 'updateHabito':data=p.nombre!==undefined?row(await sql`UPDATE habitos SET nombre=${text(p.nombre,'Hábito')},frecuencia=${['diario','semanal','mensual'].includes(p.frecuencia)?p.frecuencia:'diario'},dia_semana=${p.dia_semana===''||p.dia_semana==null?null:Number(p.dia_semana)},dia_mes=${p.dia_mes===''||p.dia_mes==null?null:Number(p.dia_mes)} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,nombre,activo,frecuencia,dia_semana,dia_mes,creado::text`):row(await sql`UPDATE habitos SET activo=${(p.activo===true||p.activo==='true')} WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text,nombre,activo,frecuencia,dia_semana,dia_mes,creado::text`);break;
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