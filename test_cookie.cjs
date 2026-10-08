const { CookieJar } = require('tough-cookie');
const jar = new CookieJar();
jar.setCookieSync('a=b; Domain=example.com', 'http://example.com');
const json = jar.toJSON();
const jar2 = CookieJar.fromJSON(json);
console.log(jar2.getCookiesSync('http://example.com')[0].key);
