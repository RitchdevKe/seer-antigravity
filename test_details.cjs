const axios = require('axios');
const cheerio = require('cheerio');
async function test() {
  const { data } = await axios.get('https://nerdytips.com/match-details/gandzasar-vs-bkma-prediction-1296108', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(data);
  console.log('md-ps__row:', $('.md-ps__row').length);
}
test();
