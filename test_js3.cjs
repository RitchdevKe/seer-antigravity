const axios = require('axios');
async function run() {
  const url = `https://nerdytips.com/build/assets/app-IEuaQJVI.js`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  const m = res.data.match(/["'](\/[a-z0-9\-_\/]+\?.*?)["']/gi);
  if (m) console.log(new Set(m));
}
run();
