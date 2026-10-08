import fs from 'fs';

const filePath = 'c:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY\\src\\utils\\optimizedweights.ts';
const code = fs.readFileSync(filePath, 'utf8');

// Find start and end of bankers_jackpot block
const bjStart = code.indexOf("} else if ((evalCategoryId || categoryId) === 'bankers_jackpot') {");
const bjEnd = code.indexOf("} else if ((evalCategoryId || categoryId) === 'value_picks') {");

if (bjStart === -1 || bjEnd === -1) {
    console.error("Could not locate BJ block bounds");
    process.exit(1);
}

const beforeBlock = code.substring(0, bjStart);
const bjBlock = code.substring(bjStart, bjEnd);

console.log(`BJ block spans from char ${bjStart} to ${bjEnd}`);

// Let's test compiling a dummy function with TypeScript compiler API or tsx!
import ts from 'typescript';

const testFile = `
function testScope() {
    ${beforeBlock}
    ${bjBlock}
    }
}
`;

fs.writeFileSync('c:\\Users\\USER\\OneDrive\\Desktop\\SEER ANTIGRAVITY\\scratch\\test_bj_scope_eval.ts', testFile);
console.log("Wrote test_bj_scope_eval.ts");
