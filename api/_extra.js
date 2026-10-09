// Acciones de Personas (CRM), Bandeja, Presupuestos, Busqueda global e Importacion masiva.
// data.js las llama desde su "default:". Cada accion recibe (p, user, sql) y devuelve los datos.

const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const text = (v, n) => { v = String(v ?? '').trim(); if (!v) throw Error(n + ' es obligatorio'); return v; };
const opt = (v, max = 200) => { v = String(v ?? '').trim(); return v ? v.slice(0, max) : null; };
const row = a => a[0];
const CATS_TAREA = ['personal', 'familia', 'compras', 'presupuesto', 'trabajo'];
const ESTADOS = ['nuevo', 'contactado', 'respondio', 'reunion', 'propuesta', 'pausa'];
const MAX_FILAS = 500;

export const categoriaTarea = v => (CATS_TAREA.includes(String(v)) ? String(v) : 'personal');

// acepta 2026-10-08, 08/10/2026, 8-10-26
export function parseFecha(v) {
  v = String(v ?? '').trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function parseMonto(v) {
  let s = String(v ?? '').trim().replace(/\s|\$/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
}
const parseHora = v => { const m = String(v ?? '').trim().match(/^(\d{1,2})[:.h](\d{2})?/); if (!m) return null; const h = +m[1], mi = +(m[2] || 0); return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : null; };
const siNo = v => /^(si|sí|s|1|true|x|yes)$/i.test(String(v ?? '').trim());

// Aviso cuando un gasto deja la categoria cerca o por encima del presupuesto del mes
export async function avisoPresupuesto(sql, userId, categoria, fecha) {
  const lim = row(await sql`SELECT monto::float AS monto FROM presupuestos WHERE usuario_id=${userId} AND categoria=${categoria}`);
  if (!lim) return null;
  const mes = String(fecha).slice(0, 7);
  const g = row(await sql`SELECT coalesce(sum(monto),0)::float AS total FROM gastos WHERE usuario_id=${userId} AND tipo='gasto' AND categoria=${categoria} AND to_char(fecha,'YYYY-MM')=${mes}`);
  const pct = Math.round(g.total / lim.monto * 100);
  if (pct < 80) return null;
  return { categoria, limite: lim.monto, gastado: g.total, pct, nivel: pct >= 100 ? 'excedido' : 'cerca' };
}

export async function manejarExtra(action, p, user, sql) {
  switch (action) {
    // ---------- RESUMEN DEL INICIO
    case 'resumenInicio': {
      const hoy = hoyAR(), mes = hoy.slice(0, 7);
      const [tot, porCategoria, gastoDias, kcalDias, ban] = await Promise.all([
        sql`SELECT coalesce(sum(monto) FILTER (WHERE tipo='gasto'),0)::float AS gasto, coalesce(sum(monto) FILTER (WHERE tipo='ingreso'),0)::float AS ingreso FROM gastos WHERE usuario_id=${user.id} AND to_char(fecha,'YYYY-MM')=${mes}`,
        sql`SELECT categoria, sum(monto)::float AS total FROM gastos WHERE usuario_id=${user.id} AND tipo='gasto' AND to_char(fecha,'YYYY-MM')=${mes} GROUP BY categoria ORDER BY total DESC LIMIT 8`,
        sql`SELECT fecha::text AS fecha, sum(monto)::float AS total FROM gastos WHERE usuario_id=${user.id} AND tipo='gasto' AND fecha > (${hoy}::date - 14) GROUP BY fecha ORDER BY fecha`,
        sql`SELECT fecha::text AS fecha, sum(kcal)::int AS kcal FROM comidas_dia WHERE usuario_id=${user.id} AND fecha > (${hoy}::date - 7) GROUP BY fecha ORDER BY fecha`,
        sql`SELECT count(*)::int AS n FROM bandeja WHERE usuario_id=${user.id} AND procesado=false`,
      ]);
      const t = tot[0] || { gasto: 0, ingreso: 0 };
      const kcalHoy = (kcalDias.find(x => x.fecha === hoy) || { kcal: 0 }).kcal;
      return { handled: true, data: { mes, gastoMes: t.gasto, ingresoMes: t.ingreso, porCategoria, gastoDias, kcalDias, kcalHoy, bandeja: ban[0].n } };
    }

    // ---------- PRESUPUESTOS
    case 'listPresupuestos':
      return { handled: true, data: await sql`SELECT categoria,monto::float AS monto FROM presupuestos WHERE usuario_id=${user.id} ORDER BY categoria` };
    case 'setPresupuesto': {
      const categoria = text(p.categoria, 'Categoría').slice(0, 40);
      const monto = parseMonto(p.monto);
      if (!Number.isFinite(monto) || monto <= 0) {
        await sql`DELETE FROM presupuestos WHERE usuario_id=${user.id} AND categoria=${categoria}`;
        return { handled: true, data: { categoria, monto: 0 } };
      }
      await sql`INSERT INTO presupuestos(usuario_id,categoria,monto) VALUES (${user.id},${categoria},${monto}) ON CONFLICT (usuario_id,categoria) DO UPDATE SET monto=EXCLUDED.monto, actualizado=now()`;
      return { handled: true, data: { categoria, monto } };
    }

    // ---------- PERSONAS (CRM)
    case 'listPersonas':
      return { handled: true, data: await sql`SELECT id::text,nombre,rol,organizacion,prioridad,estado,telefono,email,ciudad,notas,ultima_accion::text,proxima_accion,proxima_fecha::text FROM personas WHERE usuario_id=${user.id} ORDER BY (proxima_fecha IS NULL),proxima_fecha,lower(nombre) LIMIT 2000` };
    case 'getPersona': {
      const per = row(await sql`SELECT id::text,nombre,rol,organizacion,prioridad,estado,telefono,email,ciudad,notas,ultima_accion::text,proxima_accion,proxima_fecha::text FROM personas WHERE id=${p.id} AND usuario_id=${user.id}`);
      if (!per) throw Error('Persona no encontrada');
      per.historial = await sql`SELECT id::text,fecha::text,texto FROM persona_notas WHERE persona_id=${p.id} AND usuario_id=${user.id} ORDER BY fecha DESC,creado DESC LIMIT 100`;
      return { handled: true, data: per };
    }
    case 'savePersona': {
      const estado = ESTADOS.includes(p.estado) ? p.estado : 'nuevo';
      const prio = ['A', 'B', 'C'].includes(p.prioridad) ? p.prioridad : null;
      const f = parseFecha(p.proxima_fecha);
      const vals = { nombre: text(p.nombre, 'Nombre').slice(0, 120), rol: opt(p.rol, 120), organizacion: opt(p.organizacion, 120), prioridad: prio, estado, telefono: opt(p.telefono, 40), email: opt(p.email, 120), ciudad: opt(p.ciudad, 80), notas: opt(p.notas, 2000), proxima_accion: opt(p.proxima_accion, 300), proxima_fecha: f };
      if (p.id) {
        const r = row(await sql`UPDATE personas SET nombre=${vals.nombre},rol=${vals.rol},organizacion=${vals.organizacion},prioridad=${vals.prioridad},estado=${vals.estado},telefono=${vals.telefono},email=${vals.email},ciudad=${vals.ciudad},notas=${vals.notas},proxima_accion=${vals.proxima_accion},proxima_fecha=${vals.proxima_fecha},actualizado=now() WHERE id=${p.id} AND usuario_id=${user.id} RETURNING id::text`);
        if (!r) throw Error('Persona no encontrada');
        return { handled: true, data: r };
      }
      return { handled: true, data: row(await sql`INSERT INTO personas(usuario_id,nombre,rol,organizacion,prioridad,estado,telefono,email,ciudad,notas,proxima_accion,proxima_fecha) VALUES (${user.id},${vals.nombre},${vals.rol},${vals.organizacion},${vals.prioridad},${vals.estado},${vals.telefono},${vals.email},${vals.ciudad},${vals.notas},${vals.proxima_accion},${vals.proxima_fecha}) RETURNING id::text`) };
    }
    case 'deletePersona':
      await sql`DELETE FROM personas WHERE id=${p.id} AND usuario_id=${user.id}`;
      return { handled: true, data: { id: p.id, deleted: true } };
    case 'addPersonaNota': {
      const per = row(await sql`SELECT id::text,nombre FROM personas WHERE id=${p.persona_id} AND usuario_id=${user.id}`);
      if (!per) throw Error('Persona no encontrada');
      const fecha = parseFecha(p.fecha) || hoyAR();
      const t = text(p.texto, 'Nota').slice(0, 1000);
      await sql`INSERT INTO persona_notas(persona_id,usuario_id,fecha,texto) VALUES (${per.id},${user.id},${fecha},${t})`;
      const estado = ESTADOS.includes(p.estado) ? p.estado : null;
      const pf = parseFecha(p.proxima_fecha), pa = opt(p.proxima_accion, 300);
      await sql`UPDATE personas SET ultima_accion=${fecha},estado=coalesce(${estado},estado),proxima_accion=${pf || pa ? pa : null},proxima_fecha=${pf || pa ? pf : null},actualizado=now() WHERE id=${per.id} AND usuario_id=${user.id}`;
      let tarea = null;
      if ((p.crear_tarea === true || p.crear_tarea === 'true') && pf) {
        const hora = parseHora(p.proxima_hora);
        const alerta = !!hora && (p.alerta === true || p.alerta === 'true');
        tarea = row(await sql`INSERT INTO tareas(usuario_id,fecha,texto,vencimiento,alerta,categoria) VALUES (${user.id},${pf},${('Seguimiento con ' + per.nombre + (pa ? ': ' + pa : '')).slice(0, 500)},${hora ? `${pf}T${hora}:00-03:00` : null},${alerta},'trabajo') RETURNING id::text`);
      }
      return { handled: true, data: { ok: true, tarea } };
    }
    case 'importPersonas': {
      const filas = Array.isArray(p.filas) ? p.filas.slice(0, MAX_FILAS) : [];
      const ok = [], errores = [];
      filas.forEach((f, i) => {
        const nombre = String(f.nombre ?? '').trim();
        if (!nombre) return errores.push({ fila: i + 1, motivo: 'Falta el nombre' });
        const est = String(f.estado ?? '').trim().toLowerCase().replace('respondió', 'respondio').replace('reunión', 'reunion');
        ok.push({ usuario_id: user.id, nombre: nombre.slice(0, 120), rol: opt(f.rol, 120), organizacion: opt(f.organizacion, 120), prioridad: ['A', 'B', 'C'].includes(String(f.prioridad).toUpperCase()) ? String(f.prioridad).toUpperCase() : null, estado: ESTADOS.includes(est) ? est : 'nuevo', telefono: opt(f.telefono, 40), email: opt(f.email, 120), ciudad: opt(f.ciudad, 80), notas: opt(f.notas, 2000), proxima_accion: opt(f.proxima_accion, 300), proxima_fecha: parseFecha(f.proxima_fecha) });
      });
      if (ok.length) await sql`INSERT INTO personas ${sql(ok, 'usuario_id', 'nombre', 'rol', 'organizacion', 'prioridad', 'estado', 'telefono', 'email', 'ciudad', 'notas', 'proxima_accion', 'proxima_fecha')}`;
      return { handled: true, data: { insertados: ok.length, errores } };
    }

    // ---------- IMPORTACION MASIVA
    case 'importGastos': {
      const filas = Array.isArray(p.filas) ? p.filas.slice(0, MAX_FILAS) : [];
      const ok = [], errores = [];
      filas.forEach((f, i) => {
        const monto = parseMonto(f.monto);
        if (!Number.isFinite(monto) || monto <= 0) return errores.push({ fila: i + 1, motivo: 'Monto inválido' });
        const fecha = f.fecha ? parseFecha(f.fecha) : hoyAR();
        if (!fecha) return errores.push({ fila: i + 1, motivo: 'Fecha inválida' });
        ok.push({ usuario_id: user.id, fecha, monto, tipo: /ingreso|cobr/i.test(String(f.tipo ?? '')) ? 'ingreso' : 'gasto', categoria: opt(f.categoria, 40) || 'Otros', descripcion: opt(f.descripcion, 200) || '', medio: opt(f.medio, 40) || '', origen: 'importacion' });
      });
      if (ok.length) await sql`INSERT INTO gastos ${sql(ok, 'usuario_id', 'fecha', 'monto', 'tipo', 'categoria', 'descripcion', 'medio', 'origen')}`;
      return { handled: true, data: { insertados: ok.length, errores } };
    }
    case 'importTareas': {
      const filas = Array.isArray(p.filas) ? p.filas.slice(0, MAX_FILAS) : [];
      const ok = [], errores = [];
      filas.forEach((f, i) => {
        const t = String(f.texto ?? '').trim();
        if (!t) return errores.push({ fila: i + 1, motivo: 'Falta el texto' });
        const fecha = f.fecha ? parseFecha(f.fecha) : hoyAR();
        if (!fecha) return errores.push({ fila: i + 1, motivo: 'Fecha inválida' });
        const hora = parseHora(f.hora);
        const monto = parseMonto(f.monto);
        ok.push({ usuario_id: user.id, fecha, texto: t.slice(0, 500), vencimiento: hora ? `${fecha}T${hora}:00-03:00` : null, alerta: !!hora && siNo(f.alerta), categoria: categoriaTarea(String(f.categoria ?? '').toLowerCase()), monto: Number.isFinite(monto) && monto > 0 ? monto : null, detalle: opt(f.detalle, 500) });
      });
      if (ok.length) await sql`INSERT INTO tareas ${sql(ok, 'usuario_id', 'fecha', 'texto', 'vencimiento', 'alerta', 'categoria', 'monto', 'detalle')}`;
      return { handled: true, data: { insertados: ok.length, errores } };
    }

    // ---------- BANDEJA
    case 'listBandeja':
      return { handled: true, data: await sql`SELECT id::text,texto,origen,creado::text FROM bandeja WHERE usuario_id=${user.id} AND procesado=false ORDER BY creado DESC LIMIT 200` };
    case 'addBandeja':
      return { handled: true, data: row(await sql`INSERT INTO bandeja(usuario_id,texto,origen) VALUES (${user.id},${text(p.texto, 'Texto').slice(0, 1000)},${opt(p.origen, 20) || 'app'}) RETURNING id::text,texto,origen,creado::text`) };
    case 'procesarBandeja': {
      const b = row(await sql`SELECT id::text,texto FROM bandeja WHERE id=${p.id} AND usuario_id=${user.id} AND procesado=false`);
      if (!b) throw Error('Ya no está en la bandeja');
      if (p.destino === 'tarea') {
        const fecha = parseFecha(p.fecha) || hoyAR();
        await sql`INSERT INTO tareas(usuario_id,fecha,texto,categoria) VALUES (${user.id},${fecha},${b.texto.slice(0, 500)},${categoriaTarea(p.categoria)})`;
      } else if (p.destino === 'diario') {
        await sql`INSERT INTO diario(usuario_id,fecha,texto) VALUES (${user.id},${hoyAR()},${b.texto})`;
      } else if (p.destino === 'persona') {
        await sql`INSERT INTO personas(usuario_id,nombre) VALUES (${user.id},${b.texto.slice(0, 120)})`;
      } else if (p.destino !== 'descartar') throw Error('Destino inválido');
      await sql`UPDATE bandeja SET procesado=true WHERE id=${b.id}`;
      return { handled: true, data: { id: b.id, procesado: true } };
    }

    // ---------- BUSCADOR GLOBAL
    case 'buscarTodo': {
      const q = String(p.q ?? '').trim();
      if (q.length < 2) return { handled: true, data: { tareas: [], gastos: [], personas: [], diario: [], bandeja: [] } };
      const l = '%' + q.replace(/[%_\\]/g, '') + '%';
      const [tareas, gastos, diario, bandeja] = await Promise.all([
        sql`SELECT id::text,fecha::text,texto,hecha,categoria FROM tareas WHERE usuario_id=${user.id} AND (texto ILIKE ${l} OR detalle ILIKE ${l}) ORDER BY fecha DESC LIMIT 10`,
        sql`SELECT id::text,fecha::text,monto::float,tipo,categoria,descripcion FROM gastos WHERE usuario_id=${user.id} AND (descripcion ILIKE ${l} OR categoria ILIKE ${l}) ORDER BY fecha DESC LIMIT 10`,
        sql`SELECT id::text,fecha::text,texto FROM diario WHERE usuario_id=${user.id} AND texto ILIKE ${l} ORDER BY fecha DESC LIMIT 10`,
        sql`SELECT id::text,texto FROM bandeja WHERE usuario_id=${user.id} AND procesado=false AND texto ILIKE ${l} ORDER BY creado DESC LIMIT 10`,
      ]);
      return { handled: true, data: { tareas, gastos, personas: [], diario, bandeja } };
    }
    default:
      return { handled: false };
  }
}
