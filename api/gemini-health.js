export default async function handler(req,res){
 try{
  if(!process.env.GEMINI_API_KEY)throw Error('GEMINI_API_KEY no está disponible en este despliegue');
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:'Respondé solamente OK'}]}]})});
  const j=await r.json();
  if(!r.ok)throw Error('Gemini '+r.status+': '+(j?.error?.message||'sin detalle'));
  res.status(200).json({ok:true,message:'Gemini responde correctamente'});
 }catch(e){console.error('[gemini-health]',e.message);res.status(500).json({ok:false,error:e.message})}
}