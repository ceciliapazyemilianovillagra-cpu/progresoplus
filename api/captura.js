import postgres from 'postgres';
import { createHmac } from 'node:crypto';
import { asegurarCategoria, parseMonto } from './_extra.js';

// Punto de entrada para los atajos del iPhone. Cada atajo dice EXACTAMENTE que es (tipo), asi que no se adivina nada.
// POST /api/captura
//   { token, tipo:'tarea',  texto, fecha?, hora? }
//   { token, tipo:'gasto',  monto, descripcion?, categoria? }      (tambien tipo:'ingreso')
//   { token, tipo:'idea',   texto }                                 (va a la Bandeja)
// Responde { ok, mensaje } con una frase corta para que Siri la lea en voz alta.

const secret = () => process.env.SESSION_SECRET || process.env.DATABASE_URL;
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const dia = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : hoyAR());
const peso = n => '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, mensaje: 'Usá POST' });
  let sql;
  try {
    if (!process.env.DATABASE_URL) throw Error('Falta configurar DATABASE_URL');
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const token = String(body.token || bearer || '').trim();
    if (!token || !token.includes('.')) return res.status(401).json({ ok: false, mensaje: 'Falta la clave del atajo' });
    const tipo = String(body.tipo || '').toLowerCase();
    if (!['tarea', 'gasto', 'ingreso', 'idea'].includes(tipo)) return res.status(400).json({ ok: false, mensaje: 'Falta indicar el tipo: tarea, gasto, ingreso o idea' });

    sql = postgres(process.env.DATABASE_URL, { ssl: 'require', prepare: false, max: 1, idle_timeout: 5 });
    await sql`SET timezone='America/Argentina/Buenos_Aires'`;
    const hash = createHmac('sha256', secret()).update(token).digest('hex');
    const [cfg] = await sql`SELECT usuario_id::text AS id FROM configuracion_usuario WHERE atajo_token_hash=${hash}`;
    if (!cfg) return res.status(401).json({ ok: false, mensaje: 'Clave del atajo inválida' });
    const userId = cfg.id;

    if (tipo === 'gasto' || tipo === 'ingreso') {
      const monto = parseMonto(body.monto);
      if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ ok: false, mensaje: 'Falta el monto' });
      const categoria = String(body.categoria || '').trim().slice(0, 40) || 'Sin categoría';
      const fecha = dia(body.fecha);
      await sql`INSERT INTO gastos(usuario_id,fecha,monto,tipo,categoria,descripcion,origen) VALUES (${userId},${fecha},${monto},${tipo},${categoria},${String(body.descripcion || '').trim().slice(0, 200)},'atajo')`;
      await asegurarCategoria(sql, userId, categoria, tipo);
      return res.json({ ok: true, mensaje: `${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} de ${peso(monto)} anotado en ${categoria}` });
    }

    const texto = String(body.texto || '').trim();
    if (!texto) return res.status(400).json({ ok: false, mensaje: 'No escuché qué anotar' });

    if (tipo === 'idea') {
      await sql`INSERT INTO bandeja(usuario_id,texto,origen) VALUES (${userId},${texto.slice(0, 1000)},'atajo')`;
      return res.json({ ok: true, mensaje: 'Idea guardada en tu bandeja' });
    }

    const fecha = dia(body.fecha);
    const hora = /^\d{1,2}:\d{2}$/.test(String(body.hora || '')) ? String(body.hora).padStart(5, '0') : null;
    const vencimiento = hora ? `${fecha}T${hora}:00-03:00` : null;
    await sql`INSERT INTO tareas(usuario_id,fecha,texto,vencimiento,alerta,categoria) VALUES (${userId},${fecha},${texto.slice(0, 500)},${vencimiento},${!!hora},'personal')`;
    return res.json({ ok: true, mensaje: hora ? `Tarea anotada para las ${hora}, con aviso por WhatsApp` : 'Tarea anotada' });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: e.message || 'Error inesperado' });
  } finally {
    if (sql) sql.end({ timeout: 1 }).catch(() => {});
  }
}
