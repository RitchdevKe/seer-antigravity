const axios = require('axios');
async function run() {
  const url = `https://nerdytips.com/build/assets/app-IEuaQJVI.js`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  const matches = res.data.match(/fetch\(['"`](.*?)['"`]/gi);
  if (matches) console.log("Fetch calls:", new Set(matches));
  
  const axiosMatches = res.data.match(/axios\.[a-z]+\(['"`](.*?)['"`]/gi);
  if (axiosMatches) console.log("Axios calls:", new Set(axiosMatches));
}
run();
