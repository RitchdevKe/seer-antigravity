const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\.system_generated\\logs\\transcript_full.jsonl'),
  crlfDelay: Infinity
});

let lineNo = 0;
rl.on('line', (line) => {
  lineNo++;
  if (lineNo === 63753) {
    try {
      const data = JSON.parse(line);
      const content = data.content || '';
      fs.writeFileSync('scratch/user_master_code_update.txt', content, 'utf-8');
      console.log('Successfully wrote user_master_code_update.txt, length:', content.length);
    } catch (e) {
      console.error('Error parsing line:', e);
    }
  }
});
