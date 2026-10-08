const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('nt_login.html', 'utf8');
const $ = cheerio.load(html);

$('form').each((i, el) => {
    console.log(`Form ${i}: Action=${$(el).attr('action')}, Method=${$(el).attr('method')}`);
    $(el).find('input').each((j, inp) => {
        console.log(`  Input: type=${$(inp).attr('type')} name=${$(inp).attr('name')} value=${$(inp).attr('value')}`);
    });
});
