const axios = require('axios');
async function run() {
  try {
     const res = await axios.get('https://nerdytips.com/all-matches?d=0&page=2', { headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 0 });
     console.log("Found matches in html with page=2:", res.data.split('href="/match-details/').length - 1);
     
     // let's try POST to /all-matches/get-matches just in case it still works for pagination?
  } catch (e) {
     console.log(e.message);
  }
}
run();
