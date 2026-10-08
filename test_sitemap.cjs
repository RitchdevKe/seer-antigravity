const axios = require('axios');
async function run() {
  try {
     const res = await axios.get('https://nerdytips.com/sitemap.xml', { headers: { 'User-Agent': 'Mozilla/5.0' } });
     console.log("Sitemap length:", res.data.length);
     console.log(res.data.substring(0, 500));
  } catch(e) { console.log(e.message); }
}
run();
