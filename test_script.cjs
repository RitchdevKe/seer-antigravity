const fs = require("fs");
const html = fs.readFileSync("test_all_matches.html", "utf8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
console.log("Matches with link:", $("a[href*='/match-details/']").length);
console.log("Matches with row class:", $(".tb-mrow").length);
console.log("Groups:", $("[data-lg-k]").length);
