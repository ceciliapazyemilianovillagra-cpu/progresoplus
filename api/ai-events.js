import { neon } from '@neondatabase/serverless';

async function sqlClient(){
 if(!process.env.DATABASE_URL)return null;
 const sql=neon(process.env.DATABASE_URL);
 await sql`CREATE TABLE IF NOT EXISTS ai_eventos (id BIGSERIAL PRIMARY KEY, tipo TEXT NOT NULL, estado TEXT NOT NULL, detalle TEXT, creado TIMESTAMPTZ NOT NULL DEFAULT now())`;
 return sql;
}
export async function logAiEvent(tipo,estado,detalle=''){
 try{const sql=await sqlClient();if(sql)await sql`INSERT INTO ai_eventos(tipo,estado,detalle) VALUES (${tipo},${estado},${String(detalle).slice(0,500)})`;}catch(e){console.error('[ai-event-log]',e.message)}
}
export async function getAiMonitoring(){
 const sql=await sqlClient();if(!sql)return {today:0,errors:[],events:[],limit:20,warning:false};
 const limit=Math.max(1,Number(process.env.AI_DAILY_WARNING_LIMIT)||20);
 const [today,errors,events]=await Promise.all([
  sql`SELECT count(*)::int AS total FROM ai_eventos WHERE estado='ok' AND creado >= date_trunc('day',now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires'`,
  sql`SELECT id::text,tipo,estado,detalle,creado::text FROM ai_eventos WHERE estado='error' ORDER BY creado DESC LIMIT 10`,
  sql`SELECT id::text,tipo,estado,detalle,creado::text FROM ai_eventos ORDER BY creado DESC LIMIT 15`
 ]);
 return {today:today[0]?.total||0,limit,warning:(today[0]?.total||0)>=Math.ceil(limit*.8),errors,events};
}