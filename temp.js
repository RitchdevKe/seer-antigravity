"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPTIMIZED_CATEGORY_SETTINGS = void 0;
exports.updateOptimizedCategorySettings = updateOptimizedCategorySettings;
exports.replaceAllOptimizedCategorySettings = replaceAllOptimizedCategorySettings;
exports.getMarketFavorite = getMarketFavorite;
exports.getOptimizedBaseWeight = getOptimizedBaseWeight;
exports.getOptimizedScoreDetailed = getOptimizedScoreDetailed;
exports.getOptimizedScore = getOptimizedScore;
exports.applyHedgingProtocol = applyHedgingProtocol;
var seerLogic_1 = require("./seerLogic");
var matchEvaluator_1 = require("./matchEvaluator");
// Initial placeholder categories since the user said "No" to porting existing ones.
// We will build these out later with the user.
exports.OPTIMIZED_CATEGORY_SETTINGS = {
    top_10_value: {
        name: "Top 12 Value",
        description: "Statistically sound value picks with high consensus.",
        baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
        baseWeightIntervals: [
            { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
            { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
            { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
            { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
            { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
            { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: [
            { description: "Seer score on underdog >= 45%", points: -5 },
            { description: "Seer score on draw >= 35%", points: -5 },
            { description: "Seer score on draw <= 20%", points: 5 },
            { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -10 },
            { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 },
            { description: "Seer primary predicts on underdog", points: -5 },
            { description: "Underdog has >= 5 more points on point system", points: -5 },
            { description: "Algo final prediction is 1X/X2", points: 0 },
            { description: "Team A and Team B GS >= 2.0 and GA >= 1.0", points: -5 },
            { description: "Both teams GA > GS", points: -10 },
            { description: "Both teams GA >= 1.1 (volatile match)", points: -5 },
            { description: "Both teams GS < 1.0", points: -15 },
            { description: "ML (AI Consensus Lock)", points: 5 },
            { description: "Mfav TS >= 2.0 and Underdog TS < 0.7", points: -5 },
            { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: -5 },
            { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: -5 },
            { description: "Mfav TS 1.0-1.49 and Ud TS < 0.5", points: -5 },
            { description: "PAA and Seer is 1X/X2 but Algo is 12", points: 0 },
            { description: "Odds for underdog < 3.0", points: -5 },
            { description: "Odds for underdog <= odds for draw", points: -10 },
            { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 10 },
            { description: "1X2 supports the underdog", points: 0 },
            { description: "Underdog GS < 1.0 And M.fav GS > 1.8", points: 10 },
            { description: "Algo support for Mfav > 50%", points: 10 },
            { description: "Algo support for Mfav is 45-50%", points: 5 },
            { description: "Underdog has hidden strength", points: -5 },
            { description: "M.fav has hidden strength", points: 5 },
            { description: "Underdog GA >= 2.0", points: 10 },
            { description: "M.fav and Underdog TS difference <= 0.1", points: -10 },
            { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 10 },
            { description: "PAA, Seer, and ML agree on 1X/X2", points: 5 },
            { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 5 },
            { description: "Algo and Seer is 1X/X2 but PAA and SubPattern is 12", points: -5 },
            { description: "Point system has >= 60 points on M.fav", points: 5 },
            { description: "Banned: Upset risk and Banned: Draw risk tags", points: -5 }
        ]
    },
    upsets: {
        name: "Upsets",
        description: "High value underdogs based on pattern support.",
        baseLogic: "Points based on Underdog's Primary Pattern PHA %.",
        baseWeightIntervals: [
            { id: '1', min: 60, max: 100, points: 35, metric: 'pha_underdog' },
            { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_underdog' },
            { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_underdog' },
            { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_underdog' },
            { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_underdog' },
            { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_underdog' }
        ],
        rules: [
            { description: "1X2 supports the underdog", points: 5 },
            { description: "Seer primary predicts on underdog", points: 5 },
            { description: "Underdog has >= 5 more points on point system", points: 5 }
        ]
    },
    best_bet: {
        name: "Best Bets",
        description: "The highest conviction selections across all algorithms.",
        baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
        baseWeightIntervals: [
            { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
            { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
            { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
            { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
            { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
            { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: [
            { description: "Seer score on underdog >= 45%", points: -5 },
            { description: "Seer score on draw >= 35%", points: -5 },
            { description: "Seer score on draw <= 20%", points: 5 },
            { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -10 },
            { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 },
            { description: "Seer primary predicts on underdog", points: -5 },
            { description: "Underdog has >= 5 more points on point system", points: -5 },
            { description: "Algo final prediction is 1X/X2", points: 0 },
            { description: "Team A and Team B GS >= 2.0 and GA >= 1.0", points: -5 },
            { description: "Both teams GA > GS", points: -10 },
            { description: "Both teams GA >= 1.1 (volatile match)", points: -5 },
            { description: "Both teams GS < 1.0", points: -15 },
            { description: "ML (AI Consensus Lock)", points: 5 },
            { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: -5 },
            { description: "Mfav TS >= 2.0 and Underdog TS < 0.7", points: -5 },
            { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: -5 },
            { description: "Mfav TS 1.0-1.49 and Ud TS < 0.5", points: -5 },
            { description: "PAA and Seer is 1X/X2 but Algo is 12", points: 0 },
            { description: "Odds for underdog < 3.0", points: -5 },
            { description: "Odds for underdog <= odds for draw", points: -10 },
            { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 10 },
            { description: "1X2 supports the underdog", points: 0 },
            { description: "Underdog GS < 1.0 And M.fav GS > 1.8", points: 10 },
            { description: "Algo support for Mfav > 50%", points: 10 },
            { description: "Algo support for Mfav is 45-50%", points: 5 },
            { description: "Underdog has hidden strength", points: -5 },
            { description: "M.fav has hidden strength", points: 5 },
            { description: "Underdog GA >= 2.0", points: 10 },
            { description: "M.fav and Underdog TS difference <= 0.1", points: -10 },
            { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 10 },
            { description: "PAA, Seer, and ML agree on 1X/X2", points: 5 },
            { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 5 },
            { description: "Algo and Seer is 1X/X2 but PAA and SubPattern is 12", points: -5 },
            { description: "Point system has >= 60 points on M.fav", points: 5 },
            { description: "Banned: Upset risk and Banned: Draw risk tags", points: -5 }
        ]
    },
    bankers_dlive: {
        name: "Bankers D.live",
        description: "Optimized weights for Bankers D.live selections.",
        baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
        baseWeightIntervals: [
            { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
            { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
            { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
            { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
            { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
            { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: [
            { description: "Seer score on underdog >= 45%", points: -5 },
            { description: "Seer score on draw >= 35%", points: -5 },
            { description: "Seer score on draw <= 20%", points: 5 },
            { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -10 },
            { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 },
            { description: "Seer primary predicts on underdog", points: -5 },
            { description: "Underdog has >= 5 more points on point system", points: -5 },
            { description: "Algo final prediction is 1X/X2", points: 0 },
            { description: "Team A and Team B GS >= 2.0 and GA >= 1.0", points: -5 },
            { description: "Both teams GA > GS", points: -10 },
            { description: "Both teams GA >= 1.1 (volatile match)", points: -5 },
            { description: "Both teams GS < 1.0", points: -15 },
            { description: "ML (AI Consensus Lock)", points: 5 },
            { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: -5 },
            { description: "Mfav TS >= 2.0 and Underdog TS < 0.7", points: -5 },
            { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: -5 },
            { description: "Mfav TS 1.0-1.49 and Ud TS < 0.5", points: -5 },
            { description: "PAA and Seer is 1X/X2 but Algo is 12", points: 0 },
            { description: "Odds for underdog < 3.0", points: -5 },
            { description: "Odds for underdog <= odds for draw", points: -10 },
            { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 10 },
            { description: "1X2 supports the underdog", points: 0 },
            { description: "Underdog GS < 1.0 And M.fav GS > 1.8", points: 10 },
            { description: "Algo support for Mfav > 50%", points: 10 },
            { description: "Algo support for Mfav is 45-50%", points: 5 },
            { description: "Underdog has hidden strength", points: -5 },
            { description: "M.fav has hidden strength", points: 5 },
            { description: "Underdog GA >= 2.0", points: 10 },
            { description: "M.fav and Underdog TS difference <= 0.1", points: -10 },
            { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 10 },
            { description: "PAA, Seer, and ML agree on 1X/X2", points: 5 },
            { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 5 },
            { description: "Algo and Seer is 1X/X2 but PAA and SubPattern is 12", points: -5 },
            { description: "Point system has >= 60 points on M.fav", points: 5 },
            { description: "Banned: Upset risk and Banned: Draw risk tags", points: -5 }
        ]
    },
    botb_best: {
        name: "BOTB (Best of the Best)",
        description: "Absolute premium tier selections with zero risk flags.",
        baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
        rules: []
    }
};
function updateOptimizedCategorySettings(categoryId, settings) {
    exports.OPTIMIZED_CATEGORY_SETTINGS[categoryId] = settings;
}
function replaceAllOptimizedCategorySettings(settings) {
    var _a;
    // Preserve hardcoded rules from code, overwrite intervals/metadata from saved settings
    var merged = __assign({}, exports.OPTIMIZED_CATEGORY_SETTINGS);
    for (var _i = 0, _b = Object.keys(settings); _i < _b.length; _i++) {
        var key = _b[_i];
        if (merged[key]) {
            merged[key] = __assign(__assign({}, merged[key]), { name: settings[key].name, description: settings[key].description, baseWeightIntervals: ((_a = settings[key].baseWeightIntervals) === null || _a === void 0 ? void 0 : _a.length) ? settings[key].baseWeightIntervals : merged[key].baseWeightIntervals, rules: merged[key].rules // Explicitly ensure code rules are authoritative and never wiped by saved empty arrays
             });
        }
        else {
            merged[key] = settings[key];
        }
    }
    exports.OPTIMIZED_CATEGORY_SETTINGS = merged;
}
/**
 * Determines the market favorite ('1' or '2') based on odds.
 * If odds are completely equal, defaults to '1'.
 */
function getMarketFavorite(match) {
    var moParts = (match.mo || '').split(',').map(function (s) { return parseFloat(s.trim()); });
    var homeOdds = moParts[0] || 0;
    var awayOdds = moParts[2] || 0;
    if (homeOdds > 0 && awayOdds > 0) {
        if (awayOdds < homeOdds)
            return '2';
    }
    return '1';
}
/**
 * Calculates the base weight points based on the Market Favorite's PHA percentage.
 *
 * Rules:
 * >= 60% : 35 points
 * >= 50% && < 60% : 30 points
 * >= 45% && < 50% : 25 points
 * >= 40% && < 45% : 20 points
 * >= 34% && < 40% : 15 points
 * < 34% : 10 points
 */
function getOptimizedBaseWeight(match, phaStatsMap, categoryId) {
    var _a, _b;
    var mFav = getMarketFavorite(match);
    var underdog = mFav === '1' ? '2' : '1';
    var isUnderdogBase = categoryId === 'upsets';
    var targetSide = isUnderdogBase ? underdog : mFav;
    var phaPercentage = 0;
    var primaryPattern = (_a = match.patternAnalysis) === null || _a === void 0 ? void 0 : _a.subPattern;
    if (primaryPattern && phaStatsMap[primaryPattern]) {
        var stats = phaStatsMap[primaryPattern];
        if (stats.total > 0) {
            phaPercentage = (stats.outcomes[targetSide] / stats.total) * 100;
        }
    }
    var points = 10; // Default fallback
    if (categoryId && ((_b = exports.OPTIMIZED_CATEGORY_SETTINGS[categoryId]) === null || _b === void 0 ? void 0 : _b.baseWeightIntervals)) {
        var intervals = exports.OPTIMIZED_CATEGORY_SETTINGS[categoryId].baseWeightIntervals;
        // Find matching interval
        for (var _i = 0, _c = intervals || []; _i < _c.length; _i++) {
            var interval = _c[_i];
            if (phaPercentage >= interval.min && phaPercentage <= interval.max) {
                points = interval.points;
                break;
            }
        }
    }
    else {
        // Fallback static logic if no dynamic config exists
        if (phaPercentage >= 60) {
            points = 35;
        }
        else if (phaPercentage >= 50) {
            points = 30;
        }
        else if (phaPercentage >= 45) {
            points = 25;
        }
        else if (phaPercentage >= 40) {
            points = 20;
        }
        else if (phaPercentage >= 34) {
            points = 15;
        }
    }
    return { points: points, mFav: mFav, phaPercentage: phaPercentage, isUnderdogBase: isUnderdogBase };
}
/**
 * Calculates the final optimized score for a match in a specific category, returning details.
 */
function getOptimizedScoreDetailed(match, categoryId, phaStatsMap) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    var baseInfo = getOptimizedBaseWeight(match, phaStatsMap, categoryId);
    var totalScore = baseInfo.points;
    var rulesHit = [];
    var optimizedPrediction = ((_a = match.mlInfo) === null || _a === void 0 ? void 0 : _a.mlPrediction) || match.finalPrediction || match.rawPrediction || "1";
    var activeHedgingProtocol = null;
    // Add category specific rules here once defined
    var catSettings = exports.OPTIMIZED_CATEGORY_SETTINGS[categoryId];
    // Dynamic rule evaluations
    if (['top_10_value', 'best_bet', 'bankers_dlive'].includes(categoryId)) {
        var mFav = baseInfo.mFav;
        var underdog = mFav === '1' ? '2' : '1';
        // Rule 1: Seer score on underdog >= 45 & Seer Score on Draw >= 35
        var seerScoreUd = 0;
        var seerScoreDraw = 0;
        if (match.seerPercentages && match.seerPercentages[underdog] !== undefined) {
            seerScoreUd = match.seerPercentages[underdog];
            seerScoreDraw = match.seerPercentages['X'] || 0;
        }
        else if (match.seerScores && match.seerScores[underdog] !== undefined) {
            seerScoreUd = match.seerScores[underdog];
            seerScoreDraw = match.seerScores['X'] || 0;
        }
        else {
            // Lazy load ONLY if absolutely necessary
            var baseSeer = (0, seerLogic_1.predictSeerDetailed)(match, seerLogic_1.DEFAULT_WEIGHTS, phaStatsMap, {});
            seerScoreUd = baseSeer.percentages[underdog] || 0;
            seerScoreDraw = baseSeer.percentages['X'] || 0;
        }
        if (seerScoreUd >= 45) {
            totalScore += -5; // Minus 5 points
            rulesHit.push({ description: "Seer score on underdog >= 45%", points: -5 });
        }
        if (seerScoreDraw >= 35) {
            totalScore += -5; // Minus 5 points
            rulesHit.push({ description: "Seer score on draw >= 35%", points: -5 });
        }
        else if (seerScoreDraw > 0 && seerScoreDraw <= 20) {
            totalScore += 5; // Plus 5 points
            rulesHit.push({ description: "Seer score on draw <= 20%", points: 5 });
        }
        // Rule 2: Seer primary predicts on underdog
        var seerPred = match.seerPrimaryPrediction || match.rawPrediction || '1';
        if (seerPred.includes(underdog)) {
            totalScore += -5; // Minus 5 points
            rulesHit.push({ description: "Seer primary predicts on underdog", points: -5 });
        }
        // Rule: Point system differential
        var mFavPoints = mFav === '1' ? (((_b = match.totalPoints) === null || _b === void 0 ? void 0 : _b.home) || 0) : (((_c = match.totalPoints) === null || _c === void 0 ? void 0 : _c.away) || 0);
        var udPoints = underdog === '1' ? (((_d = match.totalPoints) === null || _d === void 0 ? void 0 : _d.home) || 0) : (((_e = match.totalPoints) === null || _e === void 0 ? void 0 : _e.away) || 0);
        if (udPoints - mFavPoints >= 5) {
            totalScore += -10;
            rulesHit.push({ description: "Underdog has >= 5 more points on point system", points: -10 });
            if (!activeHedgingProtocol)
                activeHedgingProtocol = "Underdog has >= 5 more points (Hedge 12)";
        }
        if (mFavPoints >= 60) {
            totalScore += 5;
            rulesHit.push({ description: "Point system has >= 60 points on M.fav", points: 5 });
        }
        var matchTags = match.evaluatorTags || (0, matchEvaluator_1.getMatchEvaluatorTags)(match, phaStatsMap, false, true);
        if (matchTags.includes('BANNED:UPSET_RISK') && matchTags.includes('BANNED:DRAW_RISK')) {
            totalScore -= 5;
            rulesHit.push({ description: "Banned: Upset risk and Banned: Draw risk tags", points: -5 });
        }
        // Rule 3: Algo final prediction is 1X/X2
        var algoPred = (((_f = match.algoReport) === null || _f === void 0 ? void 0 : _f.prediction) || match.pred1x2 || match.rawPrediction || '').trim();
        if (algoPred === '1X' || algoPred === 'X2') {
            totalScore += 0; // Points to 0
            rulesHit.push({ description: "Algo final prediction is 1X/X2", points: 0 });
        }
        // Rule 4: Team A and Team B GS >= 2.0 and GA >= 1.0
        var gsHome = parseFloat(((_g = match.gsHome) === null || _g === void 0 ? void 0 : _g.toString()) || '0');
        var gaHome = parseFloat(((_h = match.gaHome) === null || _h === void 0 ? void 0 : _h.toString()) || '0');
        var gsAway = parseFloat(((_j = match.gsAway) === null || _j === void 0 ? void 0 : _j.toString()) || '0');
        var gaAway = parseFloat(((_k = match.gaAway) === null || _k === void 0 ? void 0 : _k.toString()) || '0');
        if (gsHome >= 2.0 && gsAway >= 2.0 && gaHome >= 1.0 && gaAway >= 1.0) {
            totalScore += -5; // Minus 5 points
            rulesHit.push({ description: "Team A and Team B GS >= 2.0 and GA >= 1.0", points: -5 });
        }
        // Rule: Both teams GA > GS
        if (gaHome > gsHome && gaAway > gsAway) {
            totalScore += -10; // Minus 10 points
            rulesHit.push({ description: "Both teams GA > GS", points: -10 });
        }
        // Rule: Both teams GA >= 1.1 (volatile match)
        if (gaHome >= 1.1 && gaAway >= 1.1) {
            totalScore += -10; // Minus 10 points
            rulesHit.push({ description: "Both teams GA >= 1.1 (volatile match)", points: -10 });
            if (!activeHedgingProtocol)
                activeHedgingProtocol = "Both teams GA >= 1.1 (Hedge 12)";
        }
        // Rule: Both teams GS < 1.0
        if (gsHome < 1.0 && gsAway < 1.0) {
            totalScore += -10; // Minus 10 points
            rulesHit.push({ description: "Both teams GS < 1.0", points: -15 });
        }
        // Rule: AI Consensus Lock
        if (((_l = match.mlInfo) === null || _l === void 0 ? void 0 : _l.mlPredictionSource) === 'AI Consensus Lock') {
            totalScore += 5; // Plus 5 points
            rulesHit.push({ description: "ML (AI Consensus Lock)", points: 5 });
        }
        // Rule: Mfav TS >= 2.0 and Underdog TS < 0.7
        var favTS = mFav === '1' ? ((_m = match.tsa) !== null && _m !== void 0 ? _m : 0) : ((_o = match.tsb) !== null && _o !== void 0 ? _o : 0);
        var udTS = underdog === '1' ? ((_p = match.tsa) !== null && _p !== void 0 ? _p : 0) : ((_q = match.tsb) !== null && _q !== void 0 ? _q : 0);
        if (favTS >= 2.0 && udTS < 0.7) {
            totalScore += -5; // Minus 5 points
            rulesHit.push({ description: "Mfav TS >= 2.0 and Underdog TS < 0.7", points: -5 });
        }
        if (favTS >= 3.0 && udTS < 0.8) {
            totalScore += -5;
            rulesHit.push({ description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: -5 });
        }
        if (favTS >= 1.5 && favTS < 2.0 && udTS < 0.5) {
            totalScore += -5;
            rulesHit.push({ description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: -5 });
        }
        if (favTS >= 1.0 && favTS < 1.5 && udTS < 0.5) {
            totalScore += -10;
            rulesHit.push({ description: "Mfav TS 1.0-1.49 and Ud TS < 0.5", points: -10 });
            activeHedgingProtocol = "Mfav TS 1.0-1.49 & Ud TS < 0.5 (Hedge 12)";
        }
        // Rule: M.fav and Underdog TS difference <= 0.1
        if (Math.abs(favTS - udTS) <= 0.1) {
            totalScore += -10;
            rulesHit.push({ description: "M.fav and Underdog TS difference <= 0.1", points: -10 });
        }
        // Rule: PAA and Seer final is 1X/X2 but Algo is 12
        var paaPred = match.paaPrediction || match.paaPrimaryPrediction || '';
        var is1XorX2 = function (pred) { return pred === '1X' || pred === 'X2'; };
        var subPred = ((_r = match.patternAnalysis) === null || _r === void 0 ? void 0 : _r.subPatternPrediction) || '';
        var mlPred = (((_s = match.mlInfo) === null || _s === void 0 ? void 0 : _s.mlPrediction) || match.finalPrediction || '').trim();
        if (is1XorX2(seerPred) && is1XorX2(paaPred) && algoPred === '12') {
            totalScore += -5; // Minus 5 points
            rulesHit.push({ description: "PAA and Seer is 1X/X2 but Algo is 12", points: 0 });
        }
        // Rule: PAA, SubPattern, and Algo agree on 12 hedge
        if (paaPred === '12' && subPred === '12' && algoPred === '12') {
            if (mlPred === '12') {
                totalScore += -10;
                rulesHit.push({ description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -10 });
            }
            else {
                totalScore += -5;
                rulesHit.push({ description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 });
            }
        }
        // Rule: All predictors agree on 1X/X2
        if (is1XorX2(algoPred) && is1XorX2(seerPred) && is1XorX2(paaPred) && is1XorX2(subPred)) {
            totalScore += 5;
            rulesHit.push({ description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 5 });
        }
        // Rule: PAA, Seer, and ML agree on 1X/X2
        if (is1XorX2(paaPred) && is1XorX2(seerPred) && is1XorX2(mlPred)) {
            if (is1XorX2(algoPred)) {
                totalScore += 10;
                rulesHit.push({ description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 10 });
            }
            else {
                totalScore += 5;
                rulesHit.push({ description: "PAA, Seer, and ML agree on 1X/X2", points: 5 });
            }
        }
        // Rule: Algo and Seer is 1X/X2 but PAA and SubPattern is 12
        if (is1XorX2(algoPred) && is1XorX2(seerPred) && paaPred === '12' && subPred === '12') {
            totalScore += -5;
            rulesHit.push({ description: "Algo and Seer is 1X/X2 but PAA and SubPattern is 12", points: -5 });
        }
        // Rule 5 & 6: Underdog odds penalty
        var moParts = (match.mo || '').split(',').map(function (s) { return parseFloat(s.trim()); });
        var o1 = moParts[0] || 0;
        var oX = moParts[1] || 0;
        var o2 = moParts[2] || 0;
        var udOdds = underdog === '1' ? o1 : underdog === '2' ? o2 : 0;
        if (udOdds > 0) {
            if (udOdds < 3.0) {
                totalScore += -5; // Minus 5 points
                rulesHit.push({ description: "Odds for underdog < 3.0", points: -5 });
            }
            else if (oX > 0 && udOdds <= oX) {
                totalScore += -10; // Minus 10 points
                rulesHit.push({ description: "Odds for underdog <= odds for draw", points: -10 });
            }
        }
        // Rule 7: M.fav GA is > 0.6 points lower than Underdog GA
        var mFavGA = mFav === '1' ? gaHome : gaAway;
        var underdogGA = underdog === '1' ? gaHome : gaAway;
        if (underdogGA - mFavGA > 0.6) {
            totalScore += 5; // Add 5 points
            rulesHit.push({ description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 5 });
        }
        // Rule: Underdog GA >= 2.0
        if (underdogGA >= 2.0) {
            totalScore += 10;
            rulesHit.push({ description: "Underdog GA >= 2.0", points: 10 });
        }
        // Rule: When 1X2 supports the underdog. The match loses 5 points.
        var pred1x2 = match.pred1x2 || '';
        if (pred1x2.includes(underdog)) {
            totalScore += -5;
            rulesHit.push({ description: "1X2 supports the underdog", points: 0 });
        }
        // Rule: When the underdog GS <1.0 And M.fav GS >1.8, Add 10 points to the match.
        var mFavGS = mFav === '1' ? gsHome : gsAway;
        var underdogGS = underdog === '1' ? gsHome : gsAway;
        if (underdogGS < 1.0 && mFavGS > 1.8) {
            totalScore += 10;
            rulesHit.push({ description: "Underdog GS < 1.0 And M.fav GS > 1.8", points: 10 });
        }
        // Rule: When Algo support for Mfav is 45-50%, the match gets 5 points, when >50%, the match gets 10 points.
        var algoProbs = ((_u = (_t = match.algoReport) === null || _t === void 0 ? void 0 : _t.probabilities) === null || _u === void 0 ? void 0 : _u[mFav]) || 0;
        var algoPercentage = algoProbs * 100;
        if (algoPercentage > 50) {
            totalScore += 10;
            rulesHit.push({ description: "Algo support for Mfav > 50%", points: 10 });
        }
        else if (algoPercentage >= 45 && algoPercentage <= 50) {
            totalScore += 5;
            rulesHit.push({ description: "Algo support for Mfav is 45-50%", points: 5 });
        }
        // Rule: When underdog has hidden strength, we deduct 5 points, when M.fav has hidden strength, we add 5 points.
        var mFavHiddenStrength = Math.abs(mFavGS - mFavGA) <= 0.2;
        var underdogHiddenStrength = Math.abs(underdogGS - underdogGA) <= 0.2;
        if (underdogHiddenStrength) {
            totalScore += -5;
            rulesHit.push({ description: "Underdog has hidden strength", points: -5 });
        }
        if (mFavHiddenStrength) {
            totalScore += 5;
            rulesHit.push({ description: "M.fav has hidden strength", points: 5 });
        }
        if (activeHedgingProtocol) {
            optimizedPrediction = '12';
        }
    }
    else if (categoryId === 'upsets') {
        var mFav = baseInfo.mFav;
        var underdog = mFav === '1' ? '2' : '1';
        // Rule: When 1X2 supports the underdog. The match gains 5 points.
        var pred1x2 = match.pred1x2 || '';
        if (pred1x2.includes(underdog)) {
            totalScore += 5;
            rulesHit.push({ description: "1X2 supports the underdog", points: 5 });
        }
        // Rule: Seer primary predicts on underdog
        var seerPred = match.seerPrimaryPrediction || match.rawPrediction || '1';
        if (seerPred.includes(underdog)) {
            totalScore += 5;
            rulesHit.push({ description: "Seer primary predicts on underdog", points: 5 });
        }
        // Rule: Point system differential
        var mFavPoints = mFav === '1' ? (((_v = match.totalPoints) === null || _v === void 0 ? void 0 : _v.home) || 0) : (((_w = match.totalPoints) === null || _w === void 0 ? void 0 : _w.away) || 0);
        var udPoints = underdog === '1' ? (((_x = match.totalPoints) === null || _x === void 0 ? void 0 : _x.home) || 0) : (((_y = match.totalPoints) === null || _y === void 0 ? void 0 : _y.away) || 0);
        if (udPoints - mFavPoints >= 5) {
            totalScore += 5;
            rulesHit.push({ description: "Underdog has >= 5 more points on point system", points: 5 });
        }
    }
    return { totalScore: totalScore, baseInfo: baseInfo, rulesHit: rulesHit, optimizedPrediction: optimizedPrediction, activeHedgingProtocol: activeHedgingProtocol };
}
/**
 * Calculates the final optimized score for a match in a specific category.
 */
function getOptimizedScore(match, categoryId, phaStatsMap) {
    return getOptimizedScoreDetailed(match, categoryId, phaStatsMap).totalScore;
}
/**
 * Applies category-specific hedging protocols to override default hedge predictions.
 */
function applyHedgingProtocol(match, defaultHedge, categoryId, phaStatsMap) {
    var _a, _b, _c, _d, _e, _f;
    var subPatPred = ((_a = match.patternAnalysis) === null || _a === void 0 ? void 0 : _a.subPatternPrediction) || '';
    var paaPred = match.paaPrediction || match.paaPrimaryPrediction || '';
    // Use pre-calculated fields if possible to avoid heavy calculations
    var baseSeerFinal = match.finalPrediction || match.rawPrediction || '1';
    var algoPred = (((_b = match.algoReport) === null || _b === void 0 ? void 0 : _b.prediction) || match.pred1x2 || match.rawPrediction || '').trim();
    var is1XorX2 = function (pred) { return pred === '1X' || pred === 'X2'; };
    if (is1XorX2(baseSeerFinal) && is1XorX2(paaPred) && algoPred === '12') {
        return '12';
    }
    // Protocol 2: Mfav TS >= 2.0 and Underdog TS < 0.7
    var mFav = getMarketFavorite(match);
    var favTS = mFav === '1' ? ((_c = match.tsa) !== null && _c !== void 0 ? _c : 0) : ((_d = match.tsb) !== null && _d !== void 0 ? _d : 0);
    var udTS = mFav === '1' ? ((_e = match.tsb) !== null && _e !== void 0 ? _e : 0) : ((_f = match.tsa) !== null && _f !== void 0 ? _f : 0);
    if (favTS >= 2.0 && udTS < 0.7) {
        return '12';
    }
    return defaultHedge;
}
