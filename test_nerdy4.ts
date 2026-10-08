import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as fs from 'fs';

async function run() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));
  
  const matchesPage = await client.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
    date: '2026-08-25',
    type: 'all',
    page: '1',
    country: '',
    all_remaining: '0'
  }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  console.log('Matches length:', matchesPage.data.length);
  fs.writeFileSync('nerdy_response_iso.html', matchesPage.data);
  console.log('Done');
}
run().catch(console.error);
