const axios = require('axios');
const cheerio = require('cheerio');

const html = `<div class="num nt-time" data-time=""><span class="tb-hh">01</span><span class="sr-only">:</span><span class="tb-mm">00</span></div><div class="nt-teams"><div class="nt-tl"><img src="https://cdn.nerdytips.com/public/img/logos/442.webp?width=48" alt="" width="20" height="20" loading="lazy" class="nt-crest" onerror="this.style.visibility='hidden'"><span class="nt-nm"><span class="nt-nm-l">Defensa Y Justicia</span><span class="nt-nm-s">Defensa J</span></span><span class="num nt-sc" data-score-h=""></span></div><div class="nt-tl"><img src="https://cdn.nerdytips.com/public/img/logos/1064.webp?width=48" alt="" width="20" height="20" loading="lazy" class="nt-crest" onerror="this.style.visibility='hidden'"><span class="nt-nm"><span class="nt-nm-x">Platense</span></span><span class="num nt-sc" data-score-a=""></span></div></div><div class="tb-cellgroup nt-d"><div class="num tb-odd is-fav nt-tt" data-tt="Odd for Home Win"><span class="tb-arrow is-down">▾</span>2.45</div><div class="num tb-odd nt-tt" data-tt="Odd for Draw"><span class="tb-arrow is-up">▴</span>2.92</div><div class="num tb-odd nt-tt" data-tt="Odd for Away Win"><span class="tb-arrow is-up">▴</span>3.50</div></div><div class="tb-cellgroup tb-cg-gap nt-d"><div class="tb-mcell w60 tbm-pickscore nt-tt" data-tt="The trust for 1 is 4.8/10 and the odd is 2.45" style="--pct:48%"><span class="disp tb-mcell__pick">1</span><div class="tb-mcell__bar"><span class="num tb-mcell__odd"><span class="tb-arrow is-down">▾</span>2.45</span></div></div><div class="tb-mcell w60 tbm-goals nt-tt" data-tt="The trust for U2.5 is 3.7/10 and the odd is 1.47" style="--pct:37%"><span class="disp tb-mcell__pick">U2.5</span><div class="tb-mcell__bar"><span class="num tb-mcell__odd"><span class="tb-arrow is-down">▾</span>1.47</span></div></div><div class="tb-mcell w54 nt-tt" data-tt="The trust for No is 1.2/10 and the odd is 1.65" style="--pct:12%"><span class="disp tb-mcell__pick">No</span><div class="tb-mcell__bar"><span class="num tb-mcell__odd"><span class="tb-arrow is-down">▾</span>1.65</span></div></div></div><div class="tb-cellgroup tb-cg-gap nt-d nt-cg-last"><div class="tb-mcell w66 tbm-besttip nt-tt" data-tt="The best tip is 1X with a trust of 5.7/10 and the odd is 1.33" style="--pct:57%"><span class="disp tb-mcell__pick">1X</span><div class="tb-mcell__bar"><span class="num tb-mcell__odd"><span class="tb-arrow is-down">▾</span>1.33</span></div></div><div class="num tb-trust">5.7</div></div><div class="am-pred nt-m"><span class="am-pill">1X</span><div class="am-meta"><span class="num am-meta__odd"><span class="tb-arrow is-down">▾</span>1.33</span><span class="num am-meta__conf" data-rating="">5.7</span></div></div>`;

const $ = cheerio.load(html);
const el = $('body');

const time = $(el).find('.score-time, .time, .score-date, .am-mt, [data-time], .num.tb-stwrap, .nt-time').text().trim();
let teamA = "";
let teamB = "";
const teamNodes = $(el).find('.am-tl, .tb-teamline, .nt-tl').toArray();
if (teamNodes.length >= 2) {
    const getTeamText = (node) => {
        if ($(node).find('.nt-nm-l').length) return $(node).find('.nt-nm-l').first().text();
        if ($(node).find('.nt-nm-x').length) return $(node).find('.nt-nm-x').first().text();
        return $(node).find('.tnm, .am-tn, .tb-tname, .nt-nm').first().text();
    };
    teamA = getTeamText(teamNodes[0]).trim();
    teamB = getTeamText(teamNodes[1]).trim();
}

let odd1 = $(el).find('.td-1').text().trim();
let oddX = $(el).find('.td-x').text().trim();
let odd2 = $(el).find('.td-2').text().trim();
if (!odd1 && !oddX && !odd2) {
  const pills = $(el).find('.tb-odd__pill, .tb-odd');
  if (pills.length >= 3) {
    odd1 = pills.eq(0).text().replace(/[^0-9.]/g, '').trim();
    oddX = pills.eq(1).text().replace(/[^0-9.]/g, '').trim();
    odd2 = pills.eq(2).text().replace(/[^0-9.]/g, '').trim();
  }
}
const mo = [odd1, oddX, odd2].filter(Boolean).join(',') || "Unknown";

let pred1x2 = $(el).find('.td-tip p, .prediction-1x2, td:nth-child(6)').text().trim().replace('?', 'Unknown').trim() 
    || $(el).find('.tbm-pickscore .tb-mcell__pick, .tb-mcell__pick, .am-pill').first().text().trim() 
    || "Unknown";
    
let gs = $(el).find('.td-goals p, .goals-prediction').text().trim().replace('?', '').trim() 
    || $(el).find('.tbm-goals .tb-mcell__pick').text().trim() 
    || "Unknown";

console.log({ time, teamA, teamB, mo, pred1x2, gs });
