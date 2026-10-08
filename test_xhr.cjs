const axios = require('axios');
async function run() {
  try {
     const res = await axios.get('https://nerdytips.com/all-matches?d=0', { 
       headers: { 
         'User-Agent': 'Mozilla/5.0',
         'X-Requested-With': 'XMLHttpRequest',
         'Accept': 'application/json'
       } 
     });
     console.log("Response type:", typeof res.data);
     if (typeof res.data === 'object') {
        console.log(Object.keys(res.data));
     } else {
        console.log("Returned HTML of length", res.data.length);
     }
  } catch(e) {}
}
run();
