const axios = require('axios');
const cheerio = require('cheerio');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function run() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));
  
  const res = await client.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
    date: 'tommorow',
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
  console.log('Matches length:', res.data.length);
}
run().catch(console.error);
