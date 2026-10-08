const fs = require('fs');

const updates = `G3r13= Prim 1 fin 12
G2m13= Prim 1 fin 1X
G2g3= Prim 2 fin 12
G2ee1= Prim 1 fin 12
G1a2= Prim 2 fin 12
G1N1= Prim 1 fin 1X
G1o1= Prim 1 fin 1X
G3m3= Prim 1 fin 12
G1b7= Prim 2 fin 12
G3p5= Prim 2 fin 12
G1s15= Prim 1 fin 1X
G3g4= Prim 2 fin 12
G1o2= Prim 1 fin 12
G1f29= Prim 1 fin 1X
G2dd4= Prim 1 fin 12
G2ff34= Prim 2 fin 12
G1ff51= Prim 1 fin 1X
G2oo2= Prim 2 fin 12
G1j3= Prim X fin X2
G2s19= Prim 1 fin 12
G3s15= Prim 1 fin 12
G3s4= Prim X fin X2
G1aa5= Prim 1 fin 12
G3ll2= Prim 1 fin 1X
G2m5= Prim 1 fin 12
G3h1= Prim 1 fin 1X`.split('\n').filter(Boolean);

const updatesMap = {};
for (const line of updates) {
    const [id, rest] = line.split('=');
    const primMatch = rest.match(/Prim\s+([1X2])/i);
    const finMatch = rest.match(/fin\s+([1X2]{2})/i);
    if (id && primMatch && finMatch) {
        updatesMap[id.trim()] = {
            primary: primMatch[1].toUpperCase(),
            final: finMatch[1].toUpperCase()
        };
    } else {
        console.warn("Could not parse:", line);
    }
}

const filePath = 'src/components/Patterns.tsx';
let content = fs.readFileSync(filePath, 'utf8');

for (const [id, data] of Object.entries(updatesMap)) {
    const blockRegex = new RegExp('(id:\\s*"' + id + '"[\\s\\S]*?\\})', 'g');
    
    content = content.replace(blockRegex, (match) => {
        let updatedMatch = match.replace(/prediction:\s*"[^"]*"/, 'prediction: "' + data.final + '"');
        updatedMatch = updatedMatch.replace(/primaryPrediction:\s*"[^"]*"/, 'primaryPrediction: "' + data.primary + '"');
        console.log("Updated " + id + ": primary=" + data.primary + ", final=" + data.final);
        return updatedMatch;
    });
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done updating Patterns.tsx.");
