const fs = require('fs');
const path = require('path');

const updatesStr = `
G3r13= Prim 1 fin 12
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
G3h1= Prim 1 fin 1X
`;

const updates = updatesStr.trim().split('\n');

const filePath = path.join(__dirname, 'src', 'components', 'Patterns.tsx');
let content = fs.readFileSync(filePath, 'utf-8');
let modifications = 0;

updates.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Parse the instruction
    const [idPart, valPart] = trimmed.split('=');
    const id = idPart.trim();
    
    const primMatch = valPart.match(/Prim\s+([1X2]+)/i);
    const finMatch = valPart.match(/fin\s+([1X2]+)/i);
    
    if (!primMatch || !finMatch) {
        console.log(`Failed to parse: ${line}`);
        return;
    }
    
    const newPrim = primMatch[1];
    const newFin = finMatch[1];
    
    // Find the block for this ID
    const blockRegex = new RegExp(`(id:\\s*["']${id}["'][\\s\\S]*?)(},|})`);
    const match = content.match(blockRegex);
    
    if (match) {
        let blockContent = match[1];
        const blockEnd = match[2];
        
        // Update prediction (fin)
        if (blockContent.match(/prediction:\s*["'][1X2]+["']/)) {
            blockContent = blockContent.replace(/prediction:\s*["'][1X2]+["']/, `prediction: "${newFin}"`);
        } else {
            blockContent = blockContent + `\n    prediction: "${newFin}",`;
        }
        
        // Update primaryPrediction (Prim)
        if (blockContent.match(/primaryPrediction:\s*["'][1X2]+["']/)) {
            blockContent = blockContent.replace(/primaryPrediction:\s*["'][1X2]+["']/, `primaryPrediction: "${newPrim}"`);
        } else {
            blockContent = blockContent + `\n    primaryPrediction: "${newPrim}",`;
        }
        
        content = content.replace(match[0], blockContent + blockEnd);
        modifications++;
        console.log(`Updated ${id}: Primary -> ${newPrim}, Final -> ${newFin}`);
    } else {
        console.log(`ID not found: ${id}`);
    }
});

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`Successfully applied ${modifications} updates.`);
