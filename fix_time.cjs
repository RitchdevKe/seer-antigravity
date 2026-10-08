const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  "let time = $(el).find('.score-time, .time, .score-date, .am-mt, [data-time]').text().trim();",
  "let time = $(el).find('.score-time, .time, .score-date, .am-mt, [data-time], .num.tb-stwrap').text().trim();"
);
fs.writeFileSync('server.ts', code);
console.log("Updated server.ts with time fix");
