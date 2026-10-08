import axios from 'axios';
import * as fs from 'fs';
async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=-1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  fs.writeFileSync('nerdy_get_d.html', res.data);
  console.log('Done, size:', res.data.length);
}
run().catch(console.error);
