import fs from 'fs';

const filePath = 'c:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY\\src\\utils\\optimizedweights.ts';
let code = fs.readFileSync(filePath, 'utf8');

const bjEvalBlock = fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\bj_eval_block.txt', 'utf8');

const target = "        } else if (['bankers_jackpot', 'value_picks'].includes(evalCategoryId || categoryId)) {\r\n            const isVP = (evalCategoryId || categoryId) === 'value_picks';";
const targetLF = "        } else if (['bankers_jackpot', 'value_picks'].includes(evalCategoryId || categoryId)) {\n            const isVP = (evalCategoryId || categoryId) === 'value_picks';";

const isCRLF = code.includes('\r\n');
const activeTarget = code.includes(target) ? target : (code.includes(targetLF) ? targetLF : null);

if (!activeTarget) {
    console.error("Target string not found in optimizedweights.ts!");
    process.exit(1);
}

const newline = isCRLF ? '\r\n' : '\n';
const replacement = bjEvalBlock.split('\n').map(l => l.replace(/\r?$/, '')).join(newline) + 
    newline + 
    "        } else if ((evalCategoryId || categoryId) === 'value_picks') {" + 
    newline + 
    "            const isVP = true;";

code = code.replace(activeTarget, replacement);
fs.writeFileSync(filePath, code, 'utf8');
console.log("Successfully injected dedicated bankers_jackpot eval block and decoupled value_picks!");
