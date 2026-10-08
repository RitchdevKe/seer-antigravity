const axios = require('axios');
async function run() {
  try {
     const res = await axios.get('https://nerdytips.com/all-matches/rows?d=0', { 
       headers: { 
         'User-Agent': 'Mozilla/5.0',
         'X-Requested-With': 'XMLHttpRequest'
       } 
     });
     console.log("Groups length:", res.data.groups.length);
     for (let i = 0; i < Math.min(2, res.data.groups.length); i++) {
         const group = res.data.groups[i];
         console.log(`Group ${i}: `, Object.keys(group));
         if (group.html) {
             console.log(`HTML size for group ${i}:`, group.html.length);
         }
     }
  } catch(e) { console.log(e.message); }
}
run();
