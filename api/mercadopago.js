import postgres from 'postgres';
import { randomBytes, scryptSync } from 'node:crypto';

const hash = p => { const s = randomBytes(16).toString('hex'); return s + ':' + scryptSync(p, s, 64).toString('hex') };

const PASS_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomPassword(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) out += PASS_CHARS[randomBytes(1)[0] % PASS_CHARS.length];
  return out;
}

function slugFromEmail(email) {
  return String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'usuario';
}

function siteUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

async function fetchPayment(paymentId) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw Error('Falta configurar MP_ACCESS_TOKEN en Vercel');
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw Error('No se pudo verificar el pago con MercadoPago');
  return r.json();
}

// Da de alta la cuenta (si hace falta) para un pago aprobado. Idempotente: si el
// email ya tiene cuenta, no la vuelve a crear ni cambia la clave (evita que un
// segundo pago del mismo cliente le resetee el acceso sin querer).
async function ensureAccountForPayment(sql, payment) {
  const paymentId = String(payment.id);
  const estado = payment.status;
  const email = String(payment.payer?.email || '').toLowerCase().trim();
  const monto = payment.transaction_amount ?? null;

  const yaProcesado = await sql`SELECT payment_id,email,cuenta_creada FROM pagos_mercadopago WHERE payment_id=${paymentId}`;
  if (yaProcesado.length) {
    const prev = yaProcesado[0];
    return { estado, email: prev.email, created: false, existed: true };
  }

  if (estado !== 'approved') {
    await sql`INSERT INTO pagos_mercadopago(payment_id,email,monto,estado,cuenta_creada) VALUES (${paymentId},${email||'desconocido'},${monto},${estado},false)`;
    return { estado, email, created: false, existed: false };
  }

  if (!email) throw Error('El pago no trae un email de comprador');

  const existente = (await sql`SELECT id::text FROM usuarios WHERE email=${email}`)[0];
  if (existente) {
    await sql`INSERT INTO pagos_mercadopago(payment_id,email,usuario_id,monto,estado,cuenta_creada) VALUES (${paymentId},${email},${existente.id},${monto},'approved',false)`;
    return { estado: 'approved', email, created: false, existed: true };
  }

  const password = randomPassword();
  let usuario = slugFromEmail(email);
  const choque = (await sql`SELECT id FROM usuarios WHERE lower(usuario)=${usuario}`)[0];
  if (choque) usuario = usuario + randomBytes(2).toString('hex');

  let nuevo;
  try {
    nuevo = (await sql`INSERT INTO usuarios(email,usuario,nombre,password_hash,rol) VALUES (${email},${usuario},${email.split('@')[0]},${hash(password)},'user') RETURNING id::text`)[0];
  } catch (e) {
    // Carrera: otro request ya creó la cuenta para este email justo antes. La tratamos como "ya existía".
    const carrera = (await sql`SELECT id::text FROM usuarios WHERE email=${email}`)[0];
    if (!carrera) throw e;
    await sql`INSERT INTO pagos_mercadopago(payment_id,email,usuario_id,monto,estado,cuenta_creada) VALUES (${paymentId},${email},${carrera.id},${monto},'approved',false)`;
    return { estado: 'approved', email, created: false, existed: true };
  }
  await sql`INSERT INTO configuracion_usuario(usuario_id) VALUES (${nuevo.id})`;
  await sql`INSERT INTO pagos_mercadopago(payment_id,email,usuario_id,monto,estado,cuenta_creada) VALUES (${paymentId},${email},${nuevo.id},${monto},'approved',true)`;

  return { estado: 'approved', email, created: true, existed: false, password };
}

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) throw Error('Falta configurar DATABASE_URL en Vercel');
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', prepare: false, max: 1, idle_timeout: 5 });


    // 1) Crear el link de pago (lo llama el botón "Comprar" de comprar.html)
    if (req.method === 'GET' && req.query.crear === '1') {
      const token = process.env.MP_ACCESS_TOKEN;
      if (!token) throw Error('Falta configurar MP_ACCESS_TOKEN en Vercel');
      const precio = Number(process.env.MP_PRECIO_ACCESO || 0);
      if (!precio) throw Error('Falta configurar MP_PRECIO_ACCESO en Vercel (precio en ARS)');
      const base = siteUrl(req);
      const sinVuelta = req.query.sinvuelta === '1';
      const prefBody = {
        items: [{ title: 'Acceso a VidaPlus', quantity: 1, unit_price: precio, currency_id: 'ARS' }],
      };
      if (!sinVuelta) {
        prefBody.back_urls = { success: `${base}/gracias.html`, failure: `${base}/pago-fallido.html`, pending: `${base}/pago-fallido.html` };
        prefBody.notification_url = `${base}/api/mercadopago`;
      }
      const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(prefBody),
      });
      const j = await r.json();
      if (!r.ok) throw Error((j.message || 'No se pudo crear el link de pago') + (j.cause ? ' — ' + JSON.stringify(j.cause) : ''));
      return res.status(200).json({ ok: true, init_point: j.init_point });
    }

    // 2) La pantalla de "gracias" consulta acá el resultado con el payment_id que le pasa MercadoPago
    if (req.method === 'GET' && req.query.payment_id) {
      const payment = await fetchPayment(req.query.payment_id);
      const r = await ensureAccountForPayment(sql, payment);
      return res.status(200).json({ ok: true, ...r });
    }

    // 3) Webhook: MercadoPago avisa acá cuando cambia el estado de un pago
    if (req.method === 'POST') {
      const body = typeof req.body === 'object' && req.body ? req.body : {};
      const paymentId = body?.data?.id || req.query['data.id'] || req.query.id;
      if (!paymentId || (body.type && body.type !== 'payment')) return res.status(200).json({ ok: true, ignorado: true });
      const payment = await fetchPayment(paymentId);
      await ensureAccountForPayment(sql, payment);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Solicitud inválida' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
