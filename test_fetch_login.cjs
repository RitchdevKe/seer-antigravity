const axios = require('axios');
const fs = require('fs');

async function run() {
  const lp = await axios.get("https://nerdytips.com/login", { headers: { 'User-Agent': 'Mozilla/5.0' } });
  fs.writeFileSync('nt_login.html', lp.data);
  console.log("Saved nt_login.html");
}
run();
