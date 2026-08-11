const json=(res,status,data)=>res.status(status).json(data);
export default async function handler(req,res){
 try{
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Método no permitido'});
  if(!process.env.GEMINI_API_KEY)throw Error('Falta configurar Gemini');
  const {image,mimeType}=req.body||{};
  if(!image||!mimeType?.startsWith('image/'))throw Error('Seleccioná una foto válida');
  if(String(image).length>5_500_000)throw Error('La foto es muy grande; elegí una de menos de 4 MB');
  const prompt='Analizá esta foto de comida. Estimá los alimentos y porciones visibles. Respondé ÚNICAMENTE JSON válido con esta forma: {"alimentos":[{"nombre":"texto","porcion":"texto","calorias":0,"proteinas":0,"carbohidratos":0,"grasas":0}],"calorias":0,"proteinas":0,"carbohidratos":0,"grasas":0,"nota":"estimación breve en español"}. No inventes precisión: si hay incertidumbre, indicala en nota. Los valores son estimaciones nutricionales.';
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
   body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:mimeType,data:image}}]}],generationConfig:{responseMimeType:'application/json',temperature:0.2}})
  });
  const payload=await response.json();
  if(!response.ok)throw Error(payload?.error?.message||'Gemini no pudo analizar la foto');
  const raw=payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  const result=JSON.parse(raw.replace(/^\s*```json?\s*/i,'').replace(/\s*```\s*$/,''));
  result.alimentos=Array.isArray(result.alimentos)?result.alimentos:[];
  return json(res,200,{ok:true,data:result});
 }catch(error){return json(res,400,{ok:false,error:error.message||'No se pudo analizar la foto'})}
}