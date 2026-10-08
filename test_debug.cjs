const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=-1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  
  // Check both selectors
  const tbMatch = $('.tb-match').toArray();
  const amMrow = $('.am-mrow').toArray();
  const trMatch = $('tr[class*="match"]').toArray();
  
  console.log('.tb-match:', tbMatch.length);
  console.log('.am-mrow:', amMrow.length);
  console.log('tr[class*=match]:', trMatch.length);
  
  // Check what the combined selector picks up
  const combined = $('tr, .match-row, .score-board, .tb-match').toArray();
  console.log('Combined (tr, .match-row, .score-board, .tb-match):', combined.length);
  
  // Check what tr[class*="match"], tr.match-row, .tb-match picks up  
  const serverSelector = $('tr[class*="match"], tr.match-row, .tb-match').toArray();
  console.log('Server selector (tr[class*=match], tr.match-row, .tb-match):', serverSelector.length);
  
  // Lets see the first few rows from the RESULTS endpoint selector
  let withTeams = 0;
  let withScores = 0;
  for (const el of serverSelector.slice(0, 5)) {
    const teamNodes = $(el).find('.am-tl, .tb-teamline').toArray();
    const scoreH = $(el).find('[data-score-h]').first().text().trim();
    const scoreA = $(el).find('[data-score-a]').first().text().trim();
    let tA = "", tB = "";
    if (teamNodes.length >= 2) {
       const t1 = $(teamNodes[0]).find('.tnm').length ? $(teamNodes[0]).find('.tnm').text() : $(teamNodes[0]).find('.am-tn, .tb-tname').text();
       const t2 = $(teamNodes[1]).find('.tnm').length ? $(teamNodes[1]).find('.tnm').text() : $(teamNodes[1]).find('.am-tn, .tb-tname').text();
       tA = t1.trim();
       tB = t2.trim();
    }
    console.log(`  Team: "${tA}" vs "${tB}" | Score: ${scoreH}:${scoreA} | teamNodes: ${teamNodes.length}`);
    if (tA && tB) withTeams++;
    if (scoreH && scoreA) withScores++;
  }
  console.log(`First 5: withTeams=${withTeams}, withScores=${withScores}`);
}
run().catch(console.error);
