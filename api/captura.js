import postgres from 'postgres';
import { createHmac } from 'node:crypto';

// Punto de entrada para el atajo del iPhone (Siri / Atajos) y cualquier captura rapida.
// POST /api/captura  { token, texto, tipo?, monto?, categoria?, fecha?, hora? }
// Responde { ok, mensaje } con una frase corta para que Siri la lea en voz alta.

const secret = () => process.env.SESSION_SECRET || process.env.DATABASE_URL;
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const dia = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : hoyAR());
const peso = n => '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });

const CATEGORIAS = {
  Supermercado: /super|almac[eé]n|verdule|carnicer|fiambr|panader/i,
  Comida: /comida|restaur|resto|caf[eé]|delivery|pedidos|pizza|helado|kiosco/i,
  Transporte: /nafta|combustible|uber|taxi|colectivo|peaje|estacion|sube/i,
  Servicios: /luz|gas|agua|internet|celular|tel[eé]fono|netflix|spotify|expensas|alquiler/i,
  Salud: /farmacia|m[eé]dic|doctor|obra social|an[aá]lisis|kinesi|psic/i,
  Familia: /colegio|escuela|ni[nñ]os|hijo|hija|cumple|regalo|ropa/i,
  Hogar: /ferreter|hogar|mueble|reparaci|plomer|electricista/i,
};
const adivinarCategoria = t => Object.entries(CATEGORIAS).find(([, re]) => re.test(t))?.[0] || 'Otros';

// "gasto 5000 supermercado" / "gaste 1200 en nafta" / "cobre 300000 sueldo" / cualquier otra cosa = tarea
function interpretar(texto) {
  const t = String(texto || '').trim();
  const m = t.match(/^(gast[oeé]|compr[eé]|pagu[eé]|pag[oó]|ingreso|cobr[eé])\s+\$?\s*([\d.,]+)\s*(?:en|de|por)?\s*(.*)$/i);
  if (!m) return { tipo: 'tarea', texto: t };
  const monto = Number(m[2].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(monto) || monto <= 0) return { tipo: 'tarea', texto: t };
  const esIngreso = /^(ingreso|cobr)/i.test(m[1]);
  const descripcion = m[3].trim();
  return { tipo: esIngreso ? 'ingreso' : 'gasto', monto, descripcion, categoria: adivinarCategoria(descripcion) };
}

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

    sql = postgres(process.env.DATABASE_URL, { ssl: 'require', prepare: false, max: 1, idle_timeout: 5 });
    await sql`SET timezone='America/Argentina/Buenos_Aires'`;
    const hash = createHmac('sha256', secret()).update(token).digest('hex');
    const [cfg] = await sql`SELECT usuario_id::text AS id FROM configuracion_usuario WHERE atajo_token_hash=${hash}`;
    if (!cfg) return res.status(401).json({ ok: false, mensaje: 'Clave del atajo inválida' });
    const userId = cfg.id;

    const pedido = body.tipo && body.tipo !== 'auto'
      ? { tipo: body.tipo, texto: body.texto, monto: Number(body.monto), descripcion: body.descripcion || body.texto, categoria: body.categoria }
      : interpretar(body.texto);

    if (pedido.tipo === 'gasto' || pedido.tipo === 'ingreso') {
      const monto = Number(pedido.monto);
      if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ ok: false, mensaje: 'Falta el monto' });
      const categoria = String(pedido.categoria || adivinarCategoria(pedido.descripcion || '')).slice(0, 40);
      await sql`INSERT INTO gastos(usuario_id,fecha,monto,tipo,categoria,descripcion,origen) VALUES (${userId},${dia(body.fecha)},${monto},${pedido.tipo},${categoria},${String(pedido.descripcion || '').slice(0, 200)},'atajo')`;
      return res.json({ ok: true, mensaje: `${pedido.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} de ${peso(monto)} anotado en ${categoria}` });
    }

    const texto = String(pedido.texto || '').trim();
    if (!texto) return res.status(400).json({ ok: false, mensaje: 'No escuché qué anotar' });
    const fecha = dia(body.fecha);
    const hora = /^\d{1,2}:\d{2}$/.test(String(body.hora || '')) ? String(body.hora).padStart(5, '0') : null;
    const vencimiento = hora ? `${fecha}T${hora}:00-03:00` : null;
    await sql`INSERT INTO tareas(usuario_id,fecha,texto,vencimiento,alerta) VALUES (${userId},${fecha},${texto.slice(0, 500)},${vencimiento},${!!hora})`;
    return res.json({ ok: true, mensaje: hora ? `Recordatorio anotado para las ${hora}` : 'Tarea anotada' });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: e.message || 'Error inesperado' });
  } finally {
    if (sql) sql.end({ timeout: 1 }).catch(() => {});
  }
}
