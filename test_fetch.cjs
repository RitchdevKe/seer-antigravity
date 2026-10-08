const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('http://localhost:5000/api/nerdy/fetch?date=' + new Date().toISOString().split('T')[0]);
    console.log(`Fetched ${res.data.matches.length} matches!`);
    
    let unknownCount = 0;
    for (const m of res.data.matches) {
      if (m.pred1x2 === 'Unknown') {
        unknownCount++;
      }
    }
    console.log(`${unknownCount} matches have Unknown 1x2 prediction.`);
  } catch(e) {
    console.error(e.message);
  }
}
test();
