const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = `https://nerdytips.com/all-matches?d=1`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  const m = res.data.match(/"matches":\[\{.*?\}\]/g);
  if (m) console.log("Found matches JSON in HTML!", m.length, m[0].substring(0, 100));
  
  const h = res.data.match(/page/gi);
  console.log("Occurrences of 'page':", h ? h.length : 0);
  
  // Find any URL that looks like an endpoint
  const urls = res.data.match(/https?:\/\/[^\s"'><]+/g);
  const internalUrls = urls.filter(u => u.includes('nerdytips.com') && !u.includes('.css') && !u.includes('.js') && !u.includes('.png'));
  console.log("Internal URLs:", new Set(internalUrls));
}
run();
