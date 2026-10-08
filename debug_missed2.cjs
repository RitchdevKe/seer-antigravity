const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const target = `        updatedMatches.push({
          ...match,
          result: foundResult
        });
      }`;

const replacement = `        updatedMatches.push({
          ...match,
          result: foundResult
        });
        if (!foundResult) missedNames.push(match.teams);
      }
      
      console.log("Total missed matches:", missedNames.length);
      if (missedNames.length > 0) {
        console.log("Missed matches snippet:");
        missedNames.slice(0, 30).forEach(name => console.log(" - " + name));
      }`;

serverCode = serverCode.replace(target, replacement);
fs.writeFileSync('server.ts', serverCode);
