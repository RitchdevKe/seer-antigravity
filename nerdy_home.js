/* Timezone sync — runs before render so any correction reload is invisible.
   Keeps the Tz::COOKIE offset cookie in step with the device, and if the server
   rendered a different offset than the device reports (first visit / IP≠device),
   reloads ONCE so match times are right. A manual choice (My Account) freezes
   the ZONE, not the offset: the server only ever reads Tz::COOKIE, which
   My Account wrote once from the zone's offset on the day it was saved — so
   across a DST change inside the cookie's 30-day life every board would keep
   the old offset while the match page, which prints its dates from the IANA
   zone in the browser, moved with the clocks. The manual branch therefore
   re-derives the offset from the saved zone on every load and corrects the
   cookie (and reloads once) exactly like the device branch does. */
(function(){try{var c=document.cookie,cur,m,z;
if(/(?:^|;\s*)timezone_manual=1/.test(c)){z=c.match(/(?:^|;\s*)timezone=([^;]+)/);if(!z)return;
try{var p=new Intl.DateTimeFormat('en-US',{timeZone:decodeURIComponent(z[1]),timeZoneName:'longOffset'}).formatToParts(new Date()),o=null,i;
for(i=0;i<p.length;i++)if(p[i].type==='timeZoneName')o=p[i].value;
var g=o&&/^GMT([+-])(\d{2}):(\d{2})$/.exec(o);cur=o==='GMT'?0:(g?(g[1]==='-'?-1:1)*(parseInt(g[2],10)*60+parseInt(g[3],10)):null);}catch(e){cur=null}
if(cur===null)return;}else{cur=-new Date().getTimezoneOffset();}
m=c.match(/(?:^|;\s*)tz_offset_v2=(-?\d+)/);
if(!m||parseInt(m[1],10)!==cur){document.cookie='tz_offset_v2='+cur+';path=/;max-age=31536000;SameSite=Lax';}
var s=document.documentElement.getAttribute('data-server-tz');s=(s===null||s==='')?null:parseInt(s,10);
/* reload once per DISTINCT offset: a new timezone (traveller) always corrects on
   this refresh, but a persistent server↔device mismatch can't loop. */
if(s!==cur&&sessionStorage.getItem('tz_r')!==String(cur)){sessionStorage.setItem('tz_r',String(cur));location.reload();}
}catch(e){}})();(function(){try{var c=navigator.connection||{};
if(c.saveData===true||['slow-2g','2g','3g'].indexOf(c.effectiveType)>-1||(typeof navigator.deviceMemory==='number'&&navigator.deviceMemory<=2)){
document.documentElement.className+=' nt-frugal';}}catch(e){}})();(function(){var d=document.documentElement;d.className+=' nt-noanim';
addEventListener('load',function(){requestAnimationFrame(function(){
requestAnimationFrame(function(){d.classList.remove('nt-noanim')})})})})();document.documentElement.className+=' nt-tabs';{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://nerdytips.com/#organization","name":"NerdyTips","alternateName":"Nerdytips","legalName":"KickOff Ventures LLC","url":"https://nerdytips.com/","logo":{"@type":"ImageObject","url":"https://cdn.nerdytips.com/public/img/logo.png"},"description":"Get the best football predictions powered by AI! NerdyTips analyzes 160+ leagues to deliver accurate betting tips and insights. Win smarter with AI-driven forecasts!","address":{"@type":"PostalAddress","streetAddress":"16192 Coastal Highway","addressLocality":"Lewes","addressRegion":"DE","postalCode":"19958","addressCountry":"US"},"foundingDate":"2021-05-19","contactPoint":{"@type":"ContactPoint","email":"support@nerdytips.com","contactType":"customer support"},"founder":{"@type":"Person","name":"Daniel Ionescu","jobTitle":"Co-Founder & Technical Lead","sameAs":["https://www.linkedin.com/in/daniel-ionescu-65aa62140"]},"sameAs":["https://x.com/nerdytips","https://facebook.com/nerdytips","https://instagram.com/wearenerdytips","https://www.youtube.com/channel/UCWXkhOpbCH4vZHaBXaAeGrA","https://www.linkedin.com/company/nerdytips2020/"]},{"@type":"WebSite","@id":"https://nerdytips.com/#website","url":"https://nerdytips.com/","name":"NerdyTips","publisher":{"@id":"https://nerdytips.com/#organization"},"inLanguage":["en","ro","bg","tr","es","fr","de","pt","it","sv","el","ru","pl","pt-br","id","nl","fi","no","zh","cs","hu","ms","sr","hr","ja","th","vi","ko","ca","da","et","sk","ar"]},{"@type":"WebPage","@id":"https://nerdytips.com/all-matches#webpage","url":"https://nerdytips.com/all-matches","name":"Today's Football Predictions - August 26, 2026 | NerdyTips","description":"Get today's expert football predictions from NerdyTips. We cover all matches and leagues. Browse daily football tips, match previews, and stats for every game.","isPartOf":{"@id":"https://nerdytips.com/#website"},"about":{"@id":"https://nerdytips.com/#organization"},"inLanguage":"en","breadcrumb":{"@id":"https://nerdytips.com/all-matches#breadcrumb"}},{"@type":"BreadcrumbList","@id":"https://nerdytips.com/all-matches#breadcrumb","itemListElement":[{"@type":"ListItem","position":1,"name":"Football Predictions","item":"https://nerdytips.com"},{"@type":"ListItem","position":2,"name":"All Matches"}]}]}
(function () {
  var bar = document.querySelector('[data-botnav]');
  if (!bar) return;

  /* ---- Favourites badge -------------------------------------------------
     Slot 4 IS Favorites now (server-rendered above; the legacy Hit&Win swap is
     retired) — the only thing the server cannot know is the COUNT, because
     favorites live in localStorage. Parse-blocking on purpose, directly after
     the nav: the bar streams early so it paints immediately, and a badge that
     pops in from the deferred bundle would flash. window.ntFavMenu keeps its
     name and contract — app.js's ntFav calls it on every add/remove — but it
     only writes the badge, never rebuilds the anchor. */
  var favIco = bar.querySelector('[data-fav-badge]');
  if (favIco) {
    function favCount() {
      if (window.ntFav) { return window.ntFav.count(); }
      try {
        var f = JSON.parse(localStorage.getItem('nt_favorites') || '{}'), now = Date.now(), n = 0;
        for (var k in f) { var v = Number(f[k]); if (v && v > now) { n++; } }
        return n;
      } catch (e) { return 0; }
    }
    window.ntFavMenu = function () {
      var n = favCount();
      var b = favIco.querySelector('.nt-botnav__badge');
      if (n > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'nt-botnav__badge num';
          favIco.appendChild(b);
        }
        b.textContent = String(n);
      } else if (b) { b.remove(); }
    };
    window.ntFavMenu();
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { window.ntFavMenu(); } });
    window.addEventListener('pageshow', function (e) { if (e.persisted) { window.ntFavMenu(); } });
  }

  // Optimistic active state: the moment an item is tapped, move the highlight pill
  // onto it and keep it through the (server-rendered) navigation — so a tap no
  // longer flashes a hover background that then vanishes before the next page
  // paints. Reverts only if the touch turns into a scroll (pointercancel), not a tap.
  // DELEGATED to the bar (not bound per item) so the favorites swap — which
  // rebuilds slot 4's anchor via innerHTML — keeps the behavior on the new node.
  var pressedItem, restoreItem;
  bar.addEventListener('pointerdown', function (e) {
    var item = e.target && e.target.closest ? e.target.closest('.nt-botnav__item') : null;
    if (!item || item.classList.contains('is-active')) { pressedItem = undefined; restoreItem = undefined; return; }
    restoreItem = bar.querySelector('.nt-botnav__item.is-active'); // prior active (or null)
    if (restoreItem) restoreItem.classList.remove('is-active');
    item.classList.add('is-active');
    pressedItem = item;
  });
  bar.addEventListener('pointercancel', function () {
    if (pressedItem === undefined) return;
    pressedItem.classList.remove('is-active');
    if (restoreItem) restoreItem.classList.add('is-active');
    pressedItem = undefined;
    restoreItem = undefined;
  });
  // The optimistic swap assumed the next thing to happen is a fresh server
  // render. Back/forward breaks that assumption: bfcache restores THIS page's
  // mutated DOM, so after all-matches → Premium → back, the bar reappeared with
  // the pill still on Premium (owner report, 2026-08-26). aria-current="page"
  // is the server's own answer and the optimistic code never touches it, so a
  // restore resets the pill from it — robust even if the tap-and-leave happened
  // on an item the server never highlights (Premium's page hides the bar).
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    pressedItem = undefined;
    restoreItem = undefined;
    bar.querySelectorAll('.nt-botnav__item.is-active').forEach(function (el) { el.classList.remove('is-active'); });
    var truth = bar.querySelector('.nt-botnav__item[aria-current="page"]');
    if (truth) truth.classList.add('is-active');
  });

  // No entrance animation — the bar is simply present on every page; only the
  // scroll-hide toggles it. Prevents the "slides in on every navigation" effect.

  var lastY = window.pageYOffset, lastDir = 0, accum = 0, THRESH = 10, ticking = false, settled = false;
  // Mirror the state onto <html> so other page-level fixed chrome (e.g. the subscribe
  // buy bar, which sits 8px above this one) can leave and return with the nav instead
  // of hovering over the gap it leaves behind.
  function setHidden(on) {
    bar.classList.toggle('is-hidden', on);
    document.documentElement.classList.toggle('nt-nav-hidden', on);
  }
  function settle() { lastY = window.pageYOffset; lastDir = 0; accum = 0; ticking = false; settled = true; }
  window.addEventListener('load', function () { setHidden(false); setTimeout(settle, 300); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { ticking = false; lastY = window.pageYOffset; lastDir = 0; accum = 0; } });
  // window.__ntQuiet (global gesture-anchored quiet signal, app.js): while it
  // holds — from a bfcache restore until the first real human gesture — only
  // TRACK, never toggle: the browser re-applies the scroll position
  // programmatically after Back (momentary top, then a jump back down, at
  // whatever moment Chrome's deferred restoration picks), and reacting to that
  // dance made this bar flash in and out.
  window.addEventListener('scroll', function () {
    if (!settled || window.__ntQuiet) { lastY = window.pageYOffset; return; }
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset, delta = y - lastY;
      if (y <= 5) { setHidden(false); accum = 0; }
      else if (delta > 0) { accum = (lastDir >= 0) ? accum + delta : delta; lastDir = 1; if (accum >= THRESH) setHidden(true); }
      else if (delta < 0) { accum = (lastDir <= 0) ? accum + delta : delta; lastDir = -1; if (accum <= -THRESH) setHidden(false); }
      lastY = y; ticking = false;
    });
  }, { passive: true });
})();

(function () {
  // ONLY the pre-paint centring lives inline (so the first frame is already
  // centred, no visible slide). Everything re-queries the LIVE nodes on every
  // call: the day swap replaces this whole wrap, and closures over the initial
  // elements would keep centring a detached rail after the first day change.
  //
  // The collapse-on-scroll behaviour that used to sit here moved to app.js
  // (ntRailTuck): an inline script only executes on the INITIAL page, so its
  // scroll listener kept tucking the ORIGINAL wrap — after any day swap the
  // live rail simply stopped hiding. A module bound once, resolving the wrap
  // fresh each tick, survives every swap.
  function centre() {
    var rail = document.querySelector('[data-date-rail]');
    var a = rail && rail.querySelector('[data-date-active]');
    if (!a) return;
    var p = rail.style.scrollBehavior; rail.style.scrollBehavior = 'auto';
    rail.scrollLeft = a.offsetLeft - (rail.clientWidth - a.offsetWidth) / 2;
    rail.style.scrollBehavior = p;
  }
  centre();
  window.addEventListener('resize', centre);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(centre);
})();

(function () {
  var els = document.querySelectorAll('.nt-bc');
  if (!els.length) return;
  function snap(el) {
    if (el.dataset.bcTouched) return;
    var end = el.scrollWidth - el.clientWidth;
    var last = el.lastElementChild;
    if (end <= 0 || !last) return;
    var box = el.getBoundingClientRect();
    for (var i = 0, tries = [end, -end]; i < tries.length; i++) {
      el.scrollLeft = tries[i];
      var r = last.getBoundingClientRect();
      if (r.left >= box.left - 1 && r.right <= box.right + 1) return;
    }
  }
  function snapAll() { for (var i = 0; i < els.length; i++) snap(els[i]); }
  for (var i = 0; i < els.length; i++) {
    (function (el) {
      ['pointerdown', 'wheel', 'keydown'].forEach(function (ev) {
        el.addEventListener(ev, function () { el.dataset.bcTouched = '1'; }, { passive: true });
      });
    })(els[i]);
  }
  snapAll();
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(snapAll); }
  window.addEventListener('load', snapAll);
})();
window.__ntSearch = {"endpoint":"/search/suggest","minChars":2,"debounce":160,"recentKey":"nt_recent_v1","pages":[{"label":"All Matches","url":"/all-matches","icon":"matches","kw":"all matches fixtures today games"},{"label":"Bet of the day","url":"/bet-of-the-day","icon":"star","kw":"bet of the day banker slip"},{"label":"Bet Builder","url":"/bet-builder","icon":"builder","kw":"bet builder accumulator acca"},{"label":"Leagues","url":"/football-leagues","icon":"trophy","kw":"leagues competitions"},{"label":"Progress","url":"/progress","icon":"chart","kw":"progress track record stats results"},{"label":"Hit&Win","url":"/hitandwin","icon":"gift","kw":"hit and win game predict"},{"label":"Correct Score Predictions Today","url":"/correct-score-predictions-today","icon":"target","kw":"correct score exact result"},{"label":"Over 2.5 Predictions Today","url":"/over-2-5-goals-predictions-today","icon":"goals","kw":"over 2.5 goals"},{"label":"How it works","url":"/tutorial","icon":"help","kw":"how it works tutorial guide faq"}],"i18n":{"placeholder":"Search teams, leagues, pages…","recent":"Recent","popular":"Popular","matches":"Matches","teams":"Teams","leagues":"Leagues","pages":"Pages","noResults":"No results for","noResultsHint":"Try a team, league, or page name.","error":"Something went wrong — try again.","searching":"Searching…","clear":"Clear","team":"Teams","league":"Leagues","page":"Pages"}};