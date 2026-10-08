const axios = require('axios');
const fs = require('fs');
async function test() {
  const { data } = await axios.get('https://nerdytips.com/match-details/gandzasar-vs-bkma-prediction-1296108', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  fs.writeFileSync('test_vip_details.html', data);
  console.log('Saved test_vip_details.html');
}
test();
