const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=2026-08-27', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  
  const firstRow = $('.tb-match').eq(5);
  
  // Test old selectors for odds, pred, gs, trust
  const odd1 = firstRow.find('.td-1').text().trim();
  const oddX = firstRow.find('.td-x').text().trim();
  const odd2 = firstRow.find('.td-2').text().trim();
  console.log("Odds (old .td-*):", odd1, oddX, odd2);
  
  // New odds structure
  const odds = [];
  firstRow.find('.num.tb-odd__pill').each((i, el) => {
    odds.push($(el).text().trim());
  });
  console.log("Odds (new .tb-odd__pill):", odds);
  
  // Prediction 
  const pred1x2 = firstRow.find('.td-tip p, .prediction-1x2, td:nth-child(6)').text().trim();
  console.log("Pred1x2 (old):", pred1x2);
  
  // New prediction
  const newPred = firstRow.find('.tb-mcell__pick').first().text().trim();
  console.log("Pred1x2 (new .tb-mcell__pick):", newPred);
  
  // GS
  const gs = firstRow.find('.td-goals p, .goals-prediction').text().trim();
  console.log("GS (old):", gs);
  
  // Trust
  const trust = firstRow.find('.td-trust, .trust-level').text().trim();
  console.log("Trust (old):", trust);
  
  // New trust
  const newTrust = firstRow.find('.tb-trust__val, .am-meta__conf').first().text().trim();
  console.log("Trust (new .tb-trust__val):", newTrust);
  
  // Result
  const scoreResult = firstRow.find('.td-result, .score-result');
  console.log("Score result (old):", scoreResult.text().trim());
}

run().catch(e => console.error(e.message));
