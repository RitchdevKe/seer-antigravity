const fs = require('fs');
const html = fs.readFileSync('nt_d0.html', 'utf8');
const idx = html.indexOf('Predicted');
console.log(html.substring(idx - 100, idx + 20));
