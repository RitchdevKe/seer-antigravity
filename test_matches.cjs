const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = `https://nerdytips.com/all-matches?d=0`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  
  const matches = $('.tb-match, [class*="match-card"], .am-drow, .am-mrow');
  console.log("Found matches by class:", matches.length);
  
  const allLinks = $('a');
  let matchLinks = 0;
  allLinks.each((i, el) => {
     if ($(el).attr('href') && $(el).attr('href').includes('/match')) matchLinks++;
  });
  console.log("All links with /match:", matchLinks);
}
run();
