const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_d0.html', 'utf8');
const $ = cheerio.load(html);

$('.am-drow, .tb-match').each((i, el) => {
   const htmlContent = $.html(el);
   if (htmlContent.includes(':')) {
       console.log("Found match with colon:");
       console.log($(el).find('[data-time], .am-mt, .tb-time').text());
       console.log(htmlContent.substring(0, 300));
       return false;
   }
});
