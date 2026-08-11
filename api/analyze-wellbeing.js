import { logAiEvent } from './ai-events.js';
const json=(res,status,data)=>res.status(status).json(data);
export default async function handler(req,res){
 try{
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método no permitido'});
  if(!process.env.GEMINI_API_KEY)throw Error('Falta configurar Gemini');
  const texto=String(req.body?.texto||'').trim();
  if(texto.length<3)throw Error('Contanos un poco más para poder reflexionar.');
  if(texto.length>6000)throw Error('El texto es demasiado largo. Probá con hasta 6.000 caracteres.');
  const prompt=`Respondé en español rioplatense con una reflexión de bienestar cálida, clara y breve sobre este texto personal:
"${texto}"

Reglas fundamentales:
- Esto es solamente orientación reflexiva, no terapia, diagnóstico ni consejo médico.
- No atribuyas dolores físicos, emociones, traumas o problemas a causas verificadas como familia, ancestros, constelaciones familiares, biodecodificación, energía, carta astral, registros akáshicos, metafísica u otras prácticas simbólicas.
- Incluí una mirada holística opcional que pueda nombrar, si resulta pertinente, cuerpo-emoción, historia familiar, constelaciones, biodecodificación, energía, carta astral, ancestros, metafísica o registros akáshicos únicamente como símbolos o preguntas personales. Aclarà que no demuestra causas, no valida creencias como hechos y no reemplaza atención profesional.
- Ante dolor físico persistente, intenso o nuevo, recomendá una consulta profesional. Si aparecen riesgo de autolesión, suicidio, violencia o urgencia, indicá buscar ayuda de emergencia local y una persona de confianza ahora.
- No uses afirmaciones absolutas ni inventes datos sobre la vida de la persona.
- Incluí secciones con estos títulos: "Lo que aparece", "Mirada holística simbólica opcional", "Un paso amable para hoy" y "Cuándo pedir apoyo". Usá lenguaje directo y cuidadoso.`;
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',{
   method:'POST',
   headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
   body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.6}})
  });
  const payload=await response.json();
  if(!response.ok)throw Error(payload?.error?.message||'Gemini no pudo generar la reflexión');
  const textoRespuesta=payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
  if(!textoRespuesta)throw Error('No se recibió una reflexión. Intentá nuevamente.');
  await logAiEvent('bienestar','ok');
  return json(res,200,{ok:true,data:{texto:textoRespuesta}});
 }catch(error){
  console.error('[wellbeing-analysis]',error.message);
  await logAiEvent('bienestar','error',error.message);
  return json(res,400,{ok:false,error:error.message||'No se pudo generar la reflexión'});
 }
}