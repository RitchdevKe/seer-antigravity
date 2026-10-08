const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\.system_generated\\logs\\transcript_full.jsonl'),
  crlfDelay: Infinity
});

let lineNo = 0;
rl.on('line', (line) => {
  lineNo++;
  if (line.includes('USER_INPUT') && line.includes('SEER OPW ALGO MASTER CODE UPDATE')) {
    console.log('Found USER_INPUT on line:', lineNo);
    const data = JSON.parse(line);
    fs.writeFileSync('scratch/user_code_prompt.txt', data.content || '', 'utf-8');
    console.log('Saved to scratch/user_code_prompt.txt, size:', (data.content || '').length);
  }
});
