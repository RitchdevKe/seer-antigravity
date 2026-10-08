const axios = require('axios');
async function run() {
  const url = `https://nerdytips.com/build/assets/app-IEuaQJVI.js`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  const ctx = res.data.match(/.{0,50}all-matches\/live.{0,50}/gi);
  console.log("Context:", ctx);
}
run();
