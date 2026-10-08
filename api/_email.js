const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

export function emailsHabilitados() {
  return !!process.env.RESEND_API_KEY;
}

export async function enviarEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw Error('Falta configurar RESEND_API_KEY en Vercel');
  const from = process.env.RESEND_FROM || 'VidaPlus <no-responder@soypulsocreativo.com.ar>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text, reply_to: process.env.RESEND_REPLY_TO || 'info@soypulsocreativo.com.ar' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(j.message || 'No se pudo enviar el email');
  return j;
}

function plantilla({ titulo, cuerpoHtml, boton, pie }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#E9F1FB;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E9F1FB;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E8EBF2;">
<tr><td style="background:#14161C;padding:28px 32px;text-align:center;">
<div style="display:inline-block;width:44px;height:44px;background:#F8EFCB;border-radius:12px;line-height:44px;font-weight:800;font-size:16px;color:#14161C;">V+</div>
<div style="color:#FFFFFF;font-weight:800;font-size:20px;margin-top:10px;">VidaPlus</div></td></tr>
<tr><td style="padding:36px 32px 12px 32px;"><h1 style="margin:0 0 14px 0;font-size:21px;color:#14161C;">${titulo}</h1>${cuerpoHtml}</td></tr>
${boton ? `<tr><td style="padding:8px 32px 28px 32px;" align="center"><a href="${boton.url}" style="display:inline-block;background:#14161C;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:13px;">${boton.texto}</a></td></tr>` : ''}
<tr><td style="padding:0 32px 28px 32px;"><div style="background:#E9F1FB;border:1px solid #E8EBF2;border-radius:13px;padding:14px 16px;"><p style="margin:0;font-size:12px;line-height:1.5;color:#8B90A0;">${pie}</p></div></td></tr>
<tr><td style="padding:20px 32px;background:#E9F1FB;text-align:center;border-top:1px solid #E8EBF2;"><p style="margin:0;font-size:11px;color:#8B90A0;">VidaPlus · Comida saludable, cuerpo saludable y recordatorios</p></td></tr>
</table></td></tr></table></body></html>`;
}

export function emailReseteo({ nombre, link }) {
  const saludo = nombre ? `Hola ${esc(nombre)},` : 'Hola,';
  return {
    subject: 'Recuperá tu contraseña de VidaPlus',
    text: `${nombre ? 'Hola ' + nombre : 'Hola'},\n\nPediste recuperar tu contraseña de VidaPlus. Entrá a este link para elegir una nueva (vale 30 minutos):\n\n${link}\n\nSi no fuiste vos, ignorá este mensaje.\n\nVidaPlus`,
    html: plantilla({
      titulo: 'Recuperá tu contraseña',
      cuerpoHtml: `<p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#14161C;">${saludo}</p><p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#8B90A0;">Pediste recuperar tu contraseña. Tocá el botón para elegir una nueva. El link vale por <b style="color:#14161C;">30 minutos</b>.</p>`,
      boton: { url: link, texto: 'Elegir nueva contraseña' },
      pie: 'Si no fuiste vos quien pidió este cambio, podés ignorar este mensaje: tu contraseña actual sigue funcionando.',
    }),
  };
}

export function emailBienvenida({ email, password, urlApp }) {
  return {
    subject: '¡Tu acceso a VidaPlus fue habilitado!',
    text: `¡Bienvenido/a a VidaPlus!\n\nUsuario: ${email}\nContraseña: ${password}\n\nEntrá acá: ${urlApp}\n\nTe recomendamos cambiar la contraseña después de entrar. Si tenés problemas, respondé este mail.`,
    html: plantilla({
      titulo: '¡Tu acceso fue habilitado!',
      cuerpoHtml: `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#8B90A0;">Ya sos parte de VidaPlus. Estos son tus datos para entrar:</p>
<div style="background:#E9F1FB;border:1px solid #E8EBF2;border-radius:14px;padding:16px 18px;margin-bottom:8px;">
<div style="font-size:10.5px;font-weight:700;color:#8B90A0;letter-spacing:.05em;text-transform:uppercase;">Usuario</div>
<div style="font-size:15px;font-weight:700;color:#14161C;margin-bottom:12px;word-break:break-all;">${esc(email)}</div>
<div style="font-size:10.5px;font-weight:700;color:#8B90A0;letter-spacing:.05em;text-transform:uppercase;">Contraseña</div>
<div style="font-size:15px;font-weight:700;color:#14161C;">${esc(password)}</div></div>`,
      boton: { url: urlApp, texto: 'Entrar a VidaPlus' },
      pie: 'Guardá este mail. Una vez adentro te recomendamos cambiar la contraseña. Si tenés problemas para entrar, respondé este mensaje y te ayudamos.',
    }),
  };
}
