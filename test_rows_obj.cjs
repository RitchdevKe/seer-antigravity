const axios = require('axios');
async function run() {
  try {
     const res = await axios.get('https://nerdytips.com/all-matches/rows?d=0', { 
       headers: { 
         'User-Agent': 'Mozilla/5.0',
         'X-Requested-With': 'XMLHttpRequest'
       } 
     });
     console.log(typeof res.data.groups);
     console.log(Object.keys(res.data.groups));
     const firstKey = Object.keys(res.data.groups)[0];
     console.log(typeof res.data.groups[firstKey]);
     console.log(res.data.groups[firstKey].substring(0, 200));
  } catch(e) { console.log(e.message); }
}
run();
