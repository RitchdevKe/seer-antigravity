const axios = require('axios');
async function run() {
  const url = `https://nerdytips.com/football-leagues`;
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const fs = require('fs');
  fs.writeFileSync('nt_leagues.html', res.data);
  console.log("Saved nt_leagues.html", res.data.length);
}
run();
