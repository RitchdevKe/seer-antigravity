const fs = require('fs');
let target = fs.readFileSync('target2.txt', 'utf8');
let replacement = fs.readFileSync('replacement2.txt', 'utf8');
let serverCode = fs.readFileSync('server.ts', 'utf8');
target = target.replace(/\r\n/g, '\n');
replacement = replacement.replace(/\r\n/g, '\n');
serverCode = serverCode.replace(/\r\n/g, '\n');
if (serverCode.includes(target)) {
    serverCode = serverCode.replace(target, replacement);
    fs.writeFileSync('server.ts', serverCode);
    console.log("Success! GET replacement applied for results.");
} else {
    console.log("Target block not found in server.ts!");
}
