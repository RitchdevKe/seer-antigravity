const axios = require('axios');
const cheerio = require('cheerio');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function run() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));
  
  const res = await client.get('https://nerdytips.com/all-matches?d=-2', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  const rows = $('.tb-match').toArray();
  console.log('Matches found for d=-2:', rows.length);
}
run().catch(console.error);
