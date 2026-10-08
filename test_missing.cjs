const axios = require('axios');
const cheerio = require('cheerio');
async function run() {
  const dates = [-2, -1, 0, 1];
  let allText = "";
  for(let d of dates) {
    const res = await axios.get(`https://nerdytips.com/all-matches?d=${d}`, {headers: {'User-Agent': 'Mozilla/5.0'}});
    const $ = cheerio.load(res.data);
    $('.tb-match').each((i, el) => {
        allText += $(el).text() + "\n";
    });
  }
  
  const toCheck = ["Leon", "Santa Fe", "Cucuta", "Bucaramanga", "Juventude", "Nottingham"];
  for(let team of toCheck) {
     const found = allText.toLowerCase().includes(team.toLowerCase());
     console.log(`${team}: ${found ? "FOUND" : "NOT FOUND"}`);
  }
}
run().catch(console.error);
