const axios = require('axios');
async function run() {
  const url = `https://nerdytips.com/all-matches?d=0`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const fs = require('fs');
  fs.writeFileSync('nt_d0.html', res.data);
  console.log("Saved to nt_d0.html, size:", res.data.length);
}
run();
