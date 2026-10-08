import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  const scripts = $('script').text();
  fs.writeFileSync('nerdy_home.html', res.data);
  fs.writeFileSync('nerdy_home.js', scripts);
  console.log('Done');
}
run().catch(console.error);
