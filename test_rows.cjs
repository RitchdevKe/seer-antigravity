const axios = require('axios');
async function run() {
  const url = `https://nerdytips.com/build/assets/app-IEuaQJVI.js`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const idx = res.data.indexOf('"/rows?"');
  console.log(res.data.substring(idx - 200, idx + 200));
}
run();
