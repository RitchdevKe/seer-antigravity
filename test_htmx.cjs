const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const url = `https://nerdytips.com/all-matches?d=1`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);
  
  console.log("Looking for htmx or ajax triggers...");
  $('*').each((i, el) => {
     const attribs = el.attribs;
     if (!attribs) return;
     const keys = Object.keys(attribs);
     for(const k of keys) {
         if (k.startsWith('hx-') || k.includes('ajax') || k.includes('load') || k === 'data-url' || k === 'data-endpoint') {
             if (k === 'preload') continue;
             console.log(`Found attribute ${k} = ${attribs[k]} on tag ${el.tagName}`);
         }
     }
  });
}
run();
