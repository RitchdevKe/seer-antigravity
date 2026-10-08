const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  const res = await axios.get('https://nerdytips.com/all-matches?d=2026-08-27', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const $ = cheerio.load(res.data);
  
  // The old selector
  const oldRows = $('tr[class*="match"], tr.match-row, .tb-match').toArray();
  console.log("Old selector count:", oldRows.length);
  
  // Check what tag .tb-match is
  const tbMatch = $('.tb-match');
  console.log(".tb-match count:", tbMatch.length);
  console.log(".tb-match first tag:", tbMatch.first().prop('tagName'));
  
  // Check if team extraction works from .tb-match
  const firstRow = tbMatch.first();
  const teamNodes = firstRow.find('.am-tl, .tb-teamline').toArray();
  console.log("Team nodes (old selector):", teamNodes.length);
  
  const tbTname = firstRow.find('.tb-tname');
  console.log(".tb-tname count:", tbTname.length);
  tbTname.each((i, el) => console.log("  Team:", $(el).text().trim()));
  
  const amTn = firstRow.find('.am-tn');
  console.log(".am-tn count:", amTn.length);
  amTn.each((i, el) => console.log("  Team:", $(el).text().trim()));
  
  // Check time extraction
  const time = firstRow.find('.score-time, .time, .score-date, .am-mt, [data-time]').text().trim();
  console.log("Time (old):", time);
  
  // Check if data-kick is on the parent <a>
  const parentA = firstRow.closest('a[data-kick]');
  console.log("Parent a data-kick:", parentA.attr('data-kick'));
  
  // Check match URL extraction
  const matchUrl = firstRow.find('a.score-board, a[href*="/match-details/"], a[href*="/match/"]').attr('href');
  console.log("matchUrl from inner:", matchUrl);
  
  // The <a> is the PARENT, not inside
  const parentUrl = firstRow.closest('a[href*="/match-details/"]').attr('href');
  console.log("matchUrl from parent:", parentUrl);
}

run().catch(e => console.error(e.message));
