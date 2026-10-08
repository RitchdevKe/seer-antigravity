const axios = require('axios');
async function run() {
  try {
     const res = await axios.get('https://nerdytips.com/all-matches/live?d=0', { 
       headers: { 
         'User-Agent': 'Mozilla/5.0',
         'X-Requested-With': 'XMLHttpRequest'
       } 
     });
     console.log("Length:", res.data.length);
     console.log("Type:", typeof res.data);
     if (typeof res.data === 'string') {
        console.log(res.data.substring(0, 300));
     }
  } catch(e) { console.log(e.message); }
}
run();
