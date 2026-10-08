const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const target = '      console.log(`Total rows collected across all dates: ${allRows.length}. Matching against ${stillNeeded.length} requested matches.`);\n\n      for (const match of stillNeeded) {\n        let foundResult = match.result;';

const replacement = '      console.log(`Total rows collected across all dates: ${allRows.length}. Matching against ${stillNeeded.length} requested matches.`);\n\n      let missedNames = [];\n      for (const match of stillNeeded) {\n        let foundResult = match.result;';

const target2 = '        if (foundResult && foundResult !== match.result) {\n          updatedCount++;\n        }\n      }';

const replacement2 = '        if (foundResult && foundResult !== match.result) {\n          updatedCount++;\n        } else if (!foundResult) {\n          missedNames.push(match.teams);\n        }\n      }\n      if (missedNames.length > 0) {\n          console.log("Missed matches snippet:", missedNames.slice(0, 10));\n      }';

serverCode = serverCode.replace(target, replacement);
serverCode = serverCode.replace(target2, replacement2);
fs.writeFileSync('server.ts', serverCode);
console.log('patched');
