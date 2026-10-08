import * as fs from 'fs';
import * as path from 'path';

const changesStr = `
G1ee8= Prim 2 fin 12
G1g2= Prim 1 fin 1X
G1g6= Prim 1 fin 12
G3q2= Prim 1 fin 1X
G2ff44= Prim 2 fin X2
G2q14= Prim 1 fin 12
G1g21= Prim 2 fin 12
G1q16= Prim X fin 1X
G2bb2= Prim 2 fin 12
G2s25= Prim X fin 1X
G1j4= Prim 2 fin 12
G1g4= Prim 1 fin 12
G2cc1= Prim 1 fin 12
G3ff51= Prim 2 fin X2
G2t8= Prim 1 fin 12
G3ff57= Prim 1 fin 12
G2o10= Prim 1 fin 12
G2y2= Prim 2 fin 12
G2bb1= Prim X fin X2
G2bb3= Prim 2 fin 12
G2t3= Prim 2 fin 12
G1ff51= Prim 2 fin X2
G2c3= Prim 1 fin 12
G3jj1= Prim 2 fin 12
G3ff48= Prim 1 fin 1X
G1nn1= Prim 1 fin 1X
G1h2= Prim 2 fin 12
G2N1= Prim 1 fin 1X
G3i5= Prim 1 fin 1X
G2o14= Prim X fin X2
G3a3= Prim 1 fin 1X
G1aa5= Prim 1 fin 12
G1s13= Prim 1 fin 12
G2f17= Prim 2 fin X2
G1g13= Prim 2 fin 12
G3pp2= Prim 1 fin 12
G3ff39= Prim 2 fin X2
G1i11= Prim 1 fin 12
G1f1= Prim 2 fin X2
G1i14= Prim 1 fin 1X
G2m5= Prim 1 fin 1X
`;

const changes = changesStr.trim().split('\n').map(line => {
    const [idPart, valPart] = line.split('=');
    const id = idPart.trim();
    // format is " Prim X fin 1X"
    const primMatch = valPart.match(/Prim\s+([\dX])/);
    const finMatch = valPart.match(/fin\s+([\dX]{2})/);
    return {
        id,
        prim: primMatch ? primMatch[1] : '',
        fin: finMatch ? finMatch[1] : ''
    };
});

const targetFile = path.resolve('src/components/Patterns.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

let updatedCount = 0;
let notFoundCount = 0;

changes.forEach(({ id, prim, fin }) => {
    // We want to match an object with id: "id" and replace its prediction and primaryPrediction.
    // The properties might be in any order, but usually they are group, riders, prediction, primaryPrediction.
    // Let's use a regex to find the object start and its properties.
    const regexStr = 'id:\\s*["\']' + id + '["\']';
    const idRegex = new RegExp(regexStr);
    
    const match = idRegex.exec(content);
    if (!match) {
        console.log('[!] Not found: ' + id);
        notFoundCount++;
        return;
    }
    
    // Find the bounds of the object
    const startIdx = content.lastIndexOf('{', match.index);
    const endIdx = content.indexOf('}', match.index);
    
    if (startIdx === -1 || endIdx === -1) {
        console.log('[!] Could not find bounds for: ' + id);
        notFoundCount++;
        return;
    }
    
    let objectContent = content.substring(startIdx, endIdx + 1);
    
    // Replace prediction
    objectContent = objectContent.replace(/prediction:\s*["'][^"']+["']/, 'prediction: "' + fin + '"');
    // Replace primaryPrediction
    objectContent = objectContent.replace(/primaryPrediction:\s*["'][^"']+["']/, 'primaryPrediction: "' + prim + '"');
    
    content = content.substring(0, startIdx) + objectContent + content.substring(endIdx + 1);
    console.log('[+] Updated ' + id + ' -> prim: ' + prim + ', fin: ' + fin);
    updatedCount++;
});

fs.writeFileSync(targetFile, content);
console.log('\\nDone! Updated ' + updatedCount + ' patterns. Not found: ' + notFoundCount);
