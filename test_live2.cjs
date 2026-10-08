const axios = require('axios');
async function run() {
  try {
     const res = await axios.get('https://nerdytips.com/all-matches/live?d=0', { 
       headers: { 
         'User-Agent': 'Mozilla/5.0',
         'X-Requested-With': 'XMLHttpRequest'
       } 
     });
     console.log("Keys:", Object.keys(res.data));
     if (res.data.matches) console.log("Matches:", res.data.matches.length);
     if (res.data.html) console.log("HTML length:", res.data.html.length);
     console.log(JSON.stringify(res.data).substring(0, 300));
  } catch(e) { console.log(e.message); }
}
run();
