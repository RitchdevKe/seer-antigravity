const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const today = new Date().toISOString().split('T')[0];
  const resp = await axios.post('https://nerdytips.com/all-matches/get-matches', new URLSearchParams({
      date: today, type: 'all', page: '1', country: '', all_remaining: '0'
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' } });
  
  const $ = cheerio.load(resp.data);
  $('tr[class*="match"], tr.match-row').each((_, el) => {
      const teamA = $(el).find('.home-team-name, .home-team').text().trim();
      let pred1x2 = $(el).find('.prediction-1x2, .td-tip p, .tips-table-1x2, td:nth-child(5)').text().trim().replace(/\s+/g, '');
      console.log(`${teamA}: raw pred: "${pred1x2}"`);
      const td5 = $(el).find('td:nth-child(5)').text().trim();
      const td6 = $(el).find('td:nth-child(6)').text().trim();
      const tdtip = $(el).find('.td-tip').text().trim();
      console.log(`  td5: ${td5} | td6: ${td6} | tdtip: ${tdtip}`);
  });
}
test();
