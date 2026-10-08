const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
if (code.includes('.num.tb-stwrap')) {
   console.log("Replaced successfully!");
} else {
   console.log("NOT FOUND in server.ts");
}
