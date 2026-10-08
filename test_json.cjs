const fs = require('fs');
const html = fs.readFileSync('nt_d0.html', 'utf8');
const match = html.match(/<script[^>]*>(.*?)<\/script>/gs);
if (match) {
    match.forEach((m, i) => {
        if (m.length > 500) {
            console.log(`Script ${i} length: ${m.length}`);
            console.log(m.substring(0, 200));
        }
    });
}
