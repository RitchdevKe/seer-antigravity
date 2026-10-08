const cheerio = require('cheerio');

function extractTeam(html) {
  const $ = cheerio.load(html);
  let name = $('.tb-tname, .nt-nm-l, .nt-nm-x').first().text().trim();
  if (!name) name = $('.nt-nm').first().text().trim();
  return name;
}

const htmlFree = `<div class="nt-tl"><span class="nt-nm"><span class="nt-nm-l">Municipal Grecia</span><span class="nt-nm-s">Grecia</span></span></div>`;
const htmlVip = `<div class="nt-tl"><span class="nt-nm"><span class="nt-nm-x">Gandzasar</span></span></div>`;
const htmlOld = `<div class="tb-teamline"><span class="tb-tname">Arsenal</span></div>`;

console.log("Free:", extractTeam(htmlFree));
console.log("VIP:", extractTeam(htmlVip));
console.log("Old:", extractTeam(htmlOld));
