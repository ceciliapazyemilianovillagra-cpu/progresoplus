// Actualiza el ?v=... de cada <script> y <link> local de index.html segun el contenido del archivo.
// Uso: node sellos.js   (correrlo antes de subir cambios a js/ o css/)
const fs = require('fs'), crypto = require('crypto');
let html = fs.readFileSync('index.html', 'utf8');
let n = 0;
html = html.replace(/(src|href)="\/((?:js|css)\/[\w.-]+)(?:\?v=\w*)?"/g, (m, attr, ruta) => {
  if (!fs.existsSync(ruta)) return m;
  const v = crypto.createHash('md5').update(fs.readFileSync(ruta)).digest('hex').slice(0, 8);
  n++;
  return `${attr}="/${ruta}?v=${v}"`;
});
fs.writeFileSync('index.html', html);
console.log('sellos actualizados:', n);
