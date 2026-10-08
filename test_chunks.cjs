const fs = require("fs");
const html = fs.readFileSync("test_all_matches.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
const keys = [];
$("[data-lg-k]").each((i, el) => {
  keys.push($(el).attr("data-lg-k"));
});
console.log(keys.slice(0, 5));
