import axios from 'axios';
import * as fs from 'fs';
async function run() {
  const res = await axios.get('https://nerdytips.com/build/assets/app-IEuaQJVI.js', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  fs.writeFileSync('nerdy_app.js', res.data);
  console.log('Done, size:', res.data.length);
}
run().catch(console.error);
