import { Match } from '../types';
import { 
    BaseWeightInterval, 
    OptimizedCategorySettings, 
    OptimizedScoreDetail,
    DayOfWeek,
    DayVolatilityTier,
    DayMetadata,
    DAY_METADATA,
    getMatchDayOfWeek,
    getMarketFavorite,
    extractMatchEvaluationStats
} from './opwCommon';

export type { BaseWeightInterval, OptimizedCategorySettings, OptimizedScoreDetail, DayOfWeek, DayVolatilityTier, DayMetadata };
export { DAY_METADATA, getMatchDayOfWeek, getMarketFavorite };

// Import daily category settings & evaluators
import { getMondayCategorySettings, evaluateMondayScoreDetailed } from '../mondayopw';
import { getTuesdayCategorySettings, evaluateTuesdayScoreDetailed } from '../opwtuesday';
import { getWednesdayCategorySettings, evaluateWednesdayScoreDetailed } from '../opwwednesday';
import { getThursdayCategorySettings, evaluateThursdayScoreDetailed } from '../opwthursday';
import { getFridayCategorySettings, evaluateFridayScoreDetailed } from '../opwfriday';
import { getSaturdayCategorySettings, evaluateSaturdayScoreDetailed } from '../opwsaturday';
import { getSundayCategorySettings, evaluateSundayScoreDetailed } from '../opwsunday';
import { sanitizeRulePolarity, populateCategoryWithMasterRules, setDayRulesBorrowProvider, borrowTriggerPoints } from './opwCatalog';
export { sanitizeRulePolarity, borrowTriggerPoints };

// Configure dynamic cross-day and cross-category borrowing provider
setDayRulesBorrowProvider((desc: string, categoryId: string, currentDay?: string) => {
    // Value Picks and Bankers Jackpot share Top 12's trigger points (user directive),
    // so they always resolve their points from the Top 12 category.
    const lookupCategoryId = (categoryId === 'value_picks' || categoryId === 'bankers_jackpot') ? 'top_12_value' : categoryId;
    // 1. Borrow from other days for this category
    const days: DayOfWeek[] = ['saturday', 'sunday', 'friday', 'thursday', 'wednesday', 'tuesday', 'monday'];
    for (const d of days) {
        if (d === currentDay) continue;
        const cat = DAILY_OPTIMIZED_SETTINGS?.[d]?.[lookupCategoryId] || DAILY_DEFAULT_CATEGORY_SETTINGS?.[d]?.[lookupCategoryId];
        if (cat?.rules) {
            const found = cat.rules.find(r => r.description === desc && r.points !== 0);
            if (found && found.points !== 0) return found.points;
        }
    }
    // 2. Borrow from other categories for this day
    const dayToUse = (currentDay as DayOfWeek) || 'sunday';
    const isUpsets = categoryId === 'upsets' || categoryId === 'underdog_only';
    const otherCats = isUpsets
        ? ['upsets', 'underdog_upsets']
        : ['top_12_value', 'best_bet', 'bankers_jackpot', 'value_picks', 'bankers_dlive', 'botb_best'];

    for (const c of otherCats) {
        if (c === categoryId) continue;
        const cat = DAILY_OPTIMIZED_SETTINGS?.[dayToUse]?.[c] || DAILY_DEFAULT_CATEGORY_SETTINGS?.[dayToUse]?.[c];
        if (cat?.rules) {
            const found = cat.rules.find(r => r.description === desc && r.points !== 0);
            if (found && found.points !== 0) return found.points;
        }
    }
    return undefined;
});

/**
 * All daily default settings indexed by day of week.
 */
export const DAILY_DEFAULT_CATEGORY_SETTINGS: Record<DayOfWeek, Record<string, OptimizedCategorySettings>> = {
    get monday() { return getMondayCategorySettings(); },
    get tuesday() { return getTuesdayCategorySettings(); },
    get wednesday() { return getWednesdayCategorySettings(); },
    get thursday() { return getThursdayCategorySettings(); },
    get friday() { return getFridayCategorySettings(); },
    get saturday() { return getSaturdayCategorySettings(); },
    get sunday() { return getSundayCategorySettings(); }
} as any;

/**
 * Backward compatibility: Default fallback settings (uses Saturday, the primary domestic league baseline).
 */
export function getInitialOptimizedCategorySettings(): Record<string, OptimizedCategorySettings> {
    return JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.saturday));
}

export let OPTIMIZED_CATEGORY_SETTINGS: Record<string, OptimizedCategorySettings> = getInitialOptimizedCategorySettings();

export const CODE_DEFAULT_CATEGORY_SETTINGS: Readonly<Record<string, OptimizedCategorySettings>> = 
    DAILY_DEFAULT_CATEGORY_SETTINGS.saturday;

const STORAGE_KEY = 'daily_optimized_weights_settings_v12';

function loadPersistedDailySettings(): Record<DayOfWeek, Record<string, OptimizedCategorySettings>> {
    const base: Record<DayOfWeek, Record<string, OptimizedCategorySettings>> = {
        monday: JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.monday)),
        tuesday: JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.tuesday)),
        wednesday: JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.wednesday)),
        thursday: JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.thursday)),
        friday: JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.friday)),
        saturday: JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.saturday)),
        sunday: JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.sunday))
    };

    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            // Clean up obsolete legacy cache keys that contained uncalibrated or 0-point rule weights
            window.localStorage.removeItem('daily_optimized_weights_settings');
            window.localStorage.removeItem('daily_optimized_weights_settings_v2');
            window.localStorage.removeItem('daily_optimized_weights_settings_v3');
            window.localStorage.removeItem('daily_optimized_weights_settings_v4');
            window.localStorage.removeItem('daily_optimized_weights_settings_v5');
            window.localStorage.removeItem('daily_optimized_weights_settings_v6');
            window.localStorage.removeItem('daily_optimized_weights_settings_v7');
            window.localStorage.removeItem('daily_optimized_weights_settings_v8');
            window.localStorage.removeItem('daily_optimized_weights_settings_v9');
            // v10 held pre-alignment Value Picks / Bankers Jackpot points and +-35 caps
            window.localStorage.removeItem('daily_optimized_weights_settings_v10');
            // v11 held pre-LE triggers cache
            window.localStorage.removeItem('daily_optimized_weights_settings_v11');

            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                for (const d of days) {
                    if (parsed[d] && typeof parsed[d] === 'object') {
                        base[d] = { ...base[d], ...parsed[d] };
                    }
                }
            }
        } catch (e) {
            console.warn('[optimizedweights] Failed to hydrate settings from localStorage', e);
        }
    }
    // Ensure all rules across all days strictly adhere to domain semantic polarity and have non-zero points
    const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const d of allDays) {
        if (base[d]) {
            for (const catKey of Object.keys(base[d])) {
                if (base[d][catKey]?.rules) {
                    base[d][catKey].rules = sanitizeRulePolarity(base[d][catKey].rules, catKey);
                    base[d][catKey].rules.forEach(r => {
                        if (r.points === 0) {
                            r.points = borrowTriggerPoints(r.description, catKey, d);
                        }
                    });
                }
            }
        }
    }
    return base;
}

export function resetToCodeDefaults(day?: DayOfWeek) {
    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('daily_optimized_weights_settings');
        window.localStorage.removeItem('daily_optimized_weights_settings_v2');
        window.localStorage.removeItem('daily_optimized_weights_settings_v3');
        window.localStorage.removeItem('daily_optimized_weights_settings_v4');
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem('optimized_weights_settings');
    }
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const d of days) {
        DAILY_OPTIMIZED_SETTINGS[d] = JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS[d]));
    }
    OPTIMIZED_CATEGORY_SETTINGS = JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS.saturday));
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: 'all', day: day || 'all' } }));
        window.dispatchEvent(new Event('seerLockedSlipsUpdated'));
    }
}

const META_KEY = 'daily_optimized_weights_meta_v7';
/** Server-saved Value Picks / Bankers Jackpot rules older than this are ignored (they predate Top 12 alignment). */
const TOP12_ALIGN_EPOCH = Date.parse('2026-10-05T15:10:00Z');
const ALL_WEEK_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Per-day last-modified timestamps (ms) of locally applied OPW settings. */
function getDailySettingsMeta(): Partial<Record<DayOfWeek, number>> {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = window.localStorage.getItem(META_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}

function setDailySettingsMeta(days: DayOfWeek[], ts: number) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const meta = getDailySettingsMeta();
        days.forEach(d => { meta[d] = ts; });
        window.localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (e) {}
}

export function savePersistedDailySettings() {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DAILY_OPTIMIZED_SETTINGS));
            window.localStorage.setItem('optimized_weights_settings', JSON.stringify(OPTIMIZED_CATEGORY_SETTINGS));
        } catch (e) {
            console.warn('[optimizedweights] Failed to save settings to localStorage', e);
        }
        // Mark weights keys for Supabase user_storage sync (lazy import avoids module cycles)
        import('../services/supabaseStorage').then(m => {
            m.markKeyDirty(STORAGE_KEY);
            m.markKeyDirty(META_KEY);
            m.debouncedSyncToSupabase('optimized_weights_settings');
        }).catch(() => {});
    }
}

/**
 * Mutable runtime registry for day-specific settings, hydrated from localStorage if present
 */
export let DAILY_OPTIMIZED_SETTINGS: Record<DayOfWeek, Record<string, OptimizedCategorySettings>> = loadPersistedDailySettings();

// Sync initial OPTIMIZED_CATEGORY_SETTINGS with Saturday's hydrated settings
if (DAILY_OPTIMIZED_SETTINGS.saturday) {
    OPTIMIZED_CATEGORY_SETTINGS = { ...OPTIMIZED_CATEGORY_SETTINGS, ...DAILY_OPTIMIZED_SETTINGS.saturday };
}

export interface OpwSettingsUpdateOptions {
    /** Suppress the synchronous 'optimizedWeightsUpdated'/'seerLockedSlipsUpdated' events (caller dispatches later). */
    silent?: boolean;
    /** 'server' = hydrated from /api/opw/rules (does not bump the local modified timestamp). */
    source?: 'user' | 'server';
}

export function updateDailyOptimizedCategorySettings(
    day: DayOfWeek, 
    categoryId: string, 
    settings: OptimizedCategorySettings,
    syncMainAlgo: boolean = false,
    options: OpwSettingsUpdateOptions = {}
) {
    if (!DAILY_OPTIMIZED_SETTINGS[day]) {
        DAILY_OPTIMIZED_SETTINGS[day] = JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS[day]));
    }
    const catKeys = (categoryId === 'top_12_value' || categoryId === 'top_10_value' || categoryId === 'top12' || categoryId === 'top10')
        ? ['top_12_value', 'top_10_value', 'top12', 'top10']
        : [categoryId];

    const sanitizedRules = settings.rules ? sanitizeRulePolarity(settings.rules, categoryId) : [];
    const sanitizedSettings: OptimizedCategorySettings = {
        ...settings,
        rules: sanitizedRules
    };

    for (const key of catKeys) {
        DAILY_OPTIMIZED_SETTINGS[day][key] = JSON.parse(JSON.stringify(sanitizedSettings));
    }

    if (syncMainAlgo) {
        for (const key of catKeys) {
            OPTIMIZED_CATEGORY_SETTINGS[key] = JSON.parse(JSON.stringify(sanitizedSettings));
        }
        const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        for (const d of days) {
            if (!DAILY_OPTIMIZED_SETTINGS[d]) {
                DAILY_OPTIMIZED_SETTINGS[d] = JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS[d]));
            }
            for (const key of catKeys) {
                DAILY_OPTIMIZED_SETTINGS[d][key] = JSON.parse(JSON.stringify(sanitizedSettings));
            }
        }
    }
    if (options.source !== 'server') {
        setDailySettingsMeta(syncMainAlgo ? ALL_WEEK_DAYS : [day], Date.now());
    }
    savePersistedDailySettings();
    if (typeof window !== 'undefined' && !options.silent) {
        window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: categoryId, day, syncMainAlgo } }));
        window.dispatchEvent(new Event('seerLockedSlipsUpdated'));
    }
}

export function updateOptimizedCategorySettings(categoryId: string, settings: OptimizedCategorySettings, day?: DayOfWeek, options: OpwSettingsUpdateOptions = {}) {
    if (day) {
        updateDailyOptimizedCategorySettings(day, categoryId, settings, false, options);
        return;
    }
    const catKeys = (categoryId === 'top_12_value' || categoryId === 'top_10_value' || categoryId === 'top12' || categoryId === 'top10')
        ? ['top_12_value', 'top_10_value', 'top12', 'top10']
        : [categoryId];

    const sanitizedRules = settings.rules ? sanitizeRulePolarity(settings.rules, categoryId) : [];
    const sanitizedSettings: OptimizedCategorySettings = {
        ...settings,
        rules: sanitizedRules
    };

    for (const key of catKeys) {
        OPTIMIZED_CATEGORY_SETTINGS[key] = JSON.parse(JSON.stringify(sanitizedSettings));
    }
    // When updating Main Algo / All Days, propagate to all daily registries so evaluations on any day use the calibrated settings!
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const d of days) {
        if (!DAILY_OPTIMIZED_SETTINGS[d]) {
            DAILY_OPTIMIZED_SETTINGS[d] = JSON.parse(JSON.stringify(DAILY_DEFAULT_CATEGORY_SETTINGS[d]));
        }
        for (const key of catKeys) {
            DAILY_OPTIMIZED_SETTINGS[d][key] = JSON.parse(JSON.stringify(sanitizedSettings));
        }
    }
    if (options.source !== 'server') {
        setDailySettingsMeta(ALL_WEEK_DAYS, Date.now());
    }
    savePersistedDailySettings();
    if (typeof window !== 'undefined' && !options.silent) {
        window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: categoryId, day: 'all', syncMainAlgo: true } }));
        window.dispatchEvent(new Event('seerLockedSlipsUpdated'));
    }
}

/**
 * Loads rules persisted by "Save to codebase" (server JSON at /api/opw/rules) and applies
 * them per day over the code defaults. A day is only overridden if the server copy is newer
 * than the last local Apply for that day. Fails silently (e.g. static hosting / offline).
 */
let serverRulesLoadPromise: Promise<DayOfWeek[]> | null = null;
export function loadServerOpwRules(force: boolean = false): Promise<DayOfWeek[]> {
    if (serverRulesLoadPromise && !force) return serverRulesLoadPromise;
    serverRulesLoadPromise = (async () => {
        const applied: DayOfWeek[] = [];
        if (typeof window === 'undefined' || typeof fetch === 'undefined') return applied;
        try {
            const res = await fetch('/api/opw/rules');
            if (!res.ok) return applied;
            const json = await res.json();
            const rulesByDay = (json && typeof json === 'object' && json.rules) ? json.rules : {};
            const meta = getDailySettingsMeta();
            for (const day of ALL_WEEK_DAYS) {
                const entry = rulesByDay[day];
                if (!entry || !entry.categories || typeof entry.categories !== 'object') continue;
                const savedAt = Date.parse(entry.savedAt) || 0;
                if ((meta[day] || 0) >= savedAt) continue; // local Apply is newer — keep it

                for (const [catId, catData] of Object.entries<any>(entry.categories)) {
                    // Value Picks / Bankers Jackpot now mirror Top 12 by default; ignore server copies saved before that alignment.
                    if ((catId === 'value_picks' || catId === 'bankers_jackpot') && savedAt < TOP12_ALIGN_EPOCH) continue;
                    const rawRules = Array.isArray(catData?.rules) ? catData.rules : [];
                    const tuned = rawRules
                        .filter((r: any) => r && typeof r.description === 'string' && typeof r.points === 'number')
                        .map((r: any) => ({ description: r.description, points: r.points }));
                    if (tuned.length === 0) continue;
                    const existing = DAILY_OPTIMIZED_SETTINGS[day]?.[catId] || DAILY_DEFAULT_CATEGORY_SETTINGS[day]?.[catId];
                    if (!existing) continue;
                    const objective = (catData?.targetObjective === 'mfav_only' || catData?.targetObjective === 'underdog_only' || catData?.targetObjective === 'mfav_draw')
                        ? catData.targetObjective
                        : (catId === 'upsets' ? 'underdog_only' : (catId === 'top_12_value' || catId === 'top_10_value') ? 'mfav_draw' : 'mfav_only');
                    updateDailyOptimizedCategorySettings(
                        day,
                        catId,
                        { ...existing, rules: populateCategoryWithMasterRules(tuned, objective) },
                        false,
                        { silent: true, source: 'server' }
                    );
                }
                if (day === 'saturday' && DAILY_OPTIMIZED_SETTINGS.saturday) {
                    // Keep legacy Main Algo registry aligned with Saturday baseline (mirrors module init)
                    Object.assign(OPTIMIZED_CATEGORY_SETTINGS, JSON.parse(JSON.stringify(DAILY_OPTIMIZED_SETTINGS.saturday)));
                }
                setDailySettingsMeta([day], savedAt);
                applied.push(day);
            }
            if (applied.length > 0) {
                savePersistedDailySettings();
                window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', {
                    detail: { category: 'all', day: applied.length === 1 ? applied[0] : 'all', days: applied, source: 'server-rules' }
                }));
            }
        } catch (e) {
            // Silent: server rules are optional
        }
        return applied;
    })();
    return serverRulesLoadPromise;
}

// Invoke once at app startup (module is loaded early by MatchAnalysis / SeerAnalysis / OPW algo)
if (typeof window !== 'undefined') {
    loadServerOpwRules();
}

export function replaceAllOptimizedCategorySettings(settings: Record<string, OptimizedCategorySettings>, day?: DayOfWeek) {
    const HARDCODED_CATEGORIES = ['best_bet', 'bankers_dlive', 'top_12_value', 'top_10_value', 'upsets', 'botb_best', 'value_picks', 'bankers_jackpot', 'high_confidence'];
    const activeDefaults = day ? DAILY_DEFAULT_CATEGORY_SETTINGS[day] : CODE_DEFAULT_CATEGORY_SETTINGS;
    
    const merged: Record<string, OptimizedCategorySettings> = {};
    for (const hcKey of HARDCODED_CATEGORIES) {
        const codeDefault = activeDefaults[hcKey] || CODE_DEFAULT_CATEGORY_SETTINGS[hcKey];
        if (codeDefault) {
            const userRules = settings[hcKey]?.rules;
            merged[hcKey] = {
                ...codeDefault,
                name: settings[hcKey]?.name || codeDefault.name,
                description: settings[hcKey]?.description || codeDefault.description,
                baseWeightIntervals: (settings[hcKey]?.baseWeightIntervals && settings[hcKey].baseWeightIntervals.length > 0)
                    ? JSON.parse(JSON.stringify(settings[hcKey].baseWeightIntervals))
                    : JSON.parse(JSON.stringify(codeDefault.baseWeightIntervals || [])),
                rules: (userRules && Array.isArray(userRules) && userRules.length > 0)
                    ? JSON.parse(JSON.stringify(userRules))
                    : JSON.parse(JSON.stringify(codeDefault.rules || []))
            };
        }
    }
    
    for (const key of Object.keys(settings)) {
        if (HARDCODED_CATEGORIES.includes(key)) continue;
        const existing = OPTIMIZED_CATEGORY_SETTINGS[key];
        if (existing) {
            merged[key] = {
                ...existing,
                name: settings[key].name || existing.name,
                description: settings[key].description || existing.description,
                baseWeightIntervals: settings[key].baseWeightIntervals || existing.baseWeightIntervals,
                rules: (settings[key].rules && Array.isArray(settings[key].rules) && settings[key].rules.length > 0)
                    ? settings[key].rules
                    : existing.rules
            };
        } else {
            merged[key] = settings[key];
        }
    }

    for (const k of Object.keys(merged)) {
        if (merged[k]?.rules) {
            merged[k].rules = sanitizeRulePolarity(merged[k].rules, k);
        }
    }

    if (day) {
        DAILY_OPTIMIZED_SETTINGS[day] = merged;
    } else {
        Object.keys(OPTIMIZED_CATEGORY_SETTINGS).forEach(k => delete OPTIMIZED_CATEGORY_SETTINGS[k]);
        Object.assign(OPTIMIZED_CATEGORY_SETTINGS, merged);
        const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        for (const d of days) {
            DAILY_OPTIMIZED_SETTINGS[d] = { ...(DAILY_OPTIMIZED_SETTINGS[d] || {}), ...merged };
        }
    }

    clearOptimizedScoreCache();
}

let scoreCache = new WeakMap<Match, Map<string, OptimizedScoreDetail>>();
export function clearOptimizedScoreCache() {
    scoreCache = new WeakMap();
}
if (typeof window !== 'undefined') {
    window.addEventListener('optimizedWeightsUpdated', clearOptimizedScoreCache);
    window.addEventListener('seerLockedSlipsUpdated', clearOptimizedScoreCache);
}

/**
 * Calculates the base weight points based on Market Favorite / Underdog PHA %.
 */
export function getOptimizedBaseWeight(
    match: Match, 
    phaStatsMap: Record<string, any>, 
    categoryId?: string,
    dayOverride?: DayOfWeek
): { points: number, mFav: '1'|'2', phaPercentage: number, isUnderdogBase: boolean } {
    const day = dayOverride || getMatchDayOfWeek(match);
    const mFav = getMarketFavorite(match);
    const underdog = mFav === '1' ? '2' : '1';
    const isUnderdogBase = categoryId === 'upsets';
    const isT12 = ['top_12_value', 'top_10_value', 'top12', 'top10'].includes(categoryId || '');
    const targetSide = isUnderdogBase ? underdog : mFav;
    
    let phaPercentage = 0;
    const primaryPattern = match.patternAnalysis?.subPattern;
    if (primaryPattern && phaStatsMap[primaryPattern]) {
        const stats = phaStatsMap[primaryPattern];
        if (stats.total > 0) {
            if (isT12) {
                // Top 12 Value target is Mfav + Draw combined
                const favorableWins = (stats.outcomes?.[mFav] ?? 0) + (stats.outcomes?.['X'] ?? 0);
                phaPercentage = (favorableWins / stats.total) * 100;
            } else {
                phaPercentage = (((stats.outcomes?.[targetSide] ?? 0) / stats.total) * 100);
            }
        }
    }

    let points = 10;
    const daySettings = DAILY_OPTIMIZED_SETTINGS[day] || DAILY_DEFAULT_CATEGORY_SETTINGS[day];
    const catSettings = categoryId ? (
        daySettings?.[categoryId] || 
        (isT12 ? (daySettings?.['top_12_value'] || daySettings?.['top_10_value'] || daySettings?.['top12'] || daySettings?.['top10']) : undefined) ||
        OPTIMIZED_CATEGORY_SETTINGS[categoryId] ||
        (isT12 ? (OPTIMIZED_CATEGORY_SETTINGS['top_12_value'] || OPTIMIZED_CATEGORY_SETTINGS['top_10_value'] || OPTIMIZED_CATEGORY_SETTINGS['top12'] || OPTIMIZED_CATEGORY_SETTINGS['top10']) : undefined)
    ) : undefined;

    if (catSettings?.baseWeightIntervals && catSettings.baseWeightIntervals.length > 0) {
        for (const interval of catSettings.baseWeightIntervals) {
            if (phaPercentage >= interval.min && phaPercentage <= interval.max) {
                points = interval.points;
                break;
            }
        }
    } else {
        if (phaPercentage >= 60) points = 35;
        else if (phaPercentage >= 50) points = 30;
        else if (phaPercentage >= 45) points = 25;
        else if (phaPercentage >= 40) points = 20;
        else if (phaPercentage >= 34) points = 15;
    }

    return { points, mFav, phaPercentage, isUnderdogBase };
}

/**
 * Calculates the final optimized score for a match in a specific category,
 * dynamically routing to the appropriate day-of-week module.
 */
export function getOptimizedScoreDetailed(
    match: Match, 
    categoryId: string, 
    phaStatsMap: Record<string, any>,
    dayOverride?: DayOfWeek
): OptimizedScoreDetail {
    if (!match) {
        return {
            totalScore: 0,
            baseInfo: { points: 0, mFav: '1', phaPercentage: 0, isUnderdogBase: categoryId === 'upsets' },
            rulesHit: [],
            optimizedPrediction: "1",
            activeHedgingProtocol: null
        };
    }

    const cacheKey = `${categoryId}_${dayOverride || ''}`;
    let matchMap = scoreCache.get(match);
    if (!matchMap) {
        matchMap = new Map();
        scoreCache.set(match, matchMap);
    }
    const cached = matchMap.get(cacheKey);
    if (cached) return cached;

    try {
        const day = dayOverride || getMatchDayOfWeek(match);
        const stats = extractMatchEvaluationStats(match, phaStatsMap, categoryId);
        const canonicalCat = stats.evalCategoryId || categoryId;
        const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, canonicalCat, day);

        const daySettings = DAILY_OPTIMIZED_SETTINGS[day] || DAILY_DEFAULT_CATEGORY_SETTINGS[day];
        const isT12 = ['top_12_value', 'top_10_value', 'top12', 'top10'].includes(canonicalCat) || ['top_12_value', 'top_10_value', 'top12', 'top10'].includes(categoryId);
        const categoryConfig = daySettings?.[canonicalCat] || 
                               daySettings?.[categoryId] || 
                               (isT12 ? (daySettings?.['top_12_value'] || daySettings?.['top_10_value'] || daySettings?.['top12'] || daySettings?.['top10']) : undefined) ||
                               OPTIMIZED_CATEGORY_SETTINGS[canonicalCat] || 
                               OPTIMIZED_CATEGORY_SETTINGS[categoryId] || 
                               (isT12 ? (OPTIMIZED_CATEGORY_SETTINGS['top_12_value'] || OPTIMIZED_CATEGORY_SETTINGS['top_10_value'] || OPTIMIZED_CATEGORY_SETTINGS['top12'] || OPTIMIZED_CATEGORY_SETTINGS['top10']) : undefined) ||
                               CODE_DEFAULT_CATEGORY_SETTINGS[canonicalCat] || 
                               CODE_DEFAULT_CATEGORY_SETTINGS[categoryId] ||
                                (isT12 ? (CODE_DEFAULT_CATEGORY_SETTINGS['top_12_value'] || CODE_DEFAULT_CATEGORY_SETTINGS['top_10_value'] || CODE_DEFAULT_CATEGORY_SETTINGS['top12'] || CODE_DEFAULT_CATEGORY_SETTINGS['top10']) : undefined);
 
        if (categoryConfig && categoryConfig.rules && categoryConfig.rules.some(r => r.points === 0)) {
            categoryConfig.rules = sanitizeRulePolarity(categoryConfig.rules, canonicalCat);
        }

        let evalResult: { totalScore: number; rulesHit: { description: string; points: number }[]; activeHedgingProtocol: string | null; optimizedPrediction: string };

        switch (day) {
            case 'monday':
                evalResult = evaluateMondayScoreDetailed(stats, match, categoryConfig);
                break;
            case 'tuesday':
                evalResult = evaluateTuesdayScoreDetailed(stats, match, categoryConfig);
                break;
            case 'wednesday':
                evalResult = evaluateWednesdayScoreDetailed(stats, match, categoryConfig);
                break;
            case 'thursday':
                evalResult = evaluateThursdayScoreDetailed(stats, match, categoryConfig);
                break;
            case 'friday':
                evalResult = evaluateFridayScoreDetailed(stats, match, categoryConfig);
                break;
            case 'saturday':
                evalResult = evaluateSaturdayScoreDetailed(stats, match, categoryConfig);
                break;
            case 'sunday':
                evalResult = evaluateSundayScoreDetailed(stats, match, categoryConfig);
                break;
            default:
                evalResult = evaluateSaturdayScoreDetailed(stats, match, categoryConfig);
                break;
        }

        let optPred = evalResult.optimizedPrediction;
        const catKey = (stats.evalCategoryId || categoryId || '').toLowerCase();
        if (catKey === 'value_picks' || catKey === 'sandbox_value_picks') {
            optPred = stats.mFav || (stats as any).moFav || baseInfo.mFav || getMarketFavorite(match);
        } else if (catKey === 'upsets' || catKey === 'sandbox_upsets' || catKey === 'upset') {
            optPred = stats.underdog || (stats as any).moUnderdog || (baseInfo.mFav === '1' ? '2' : '1');
        }

        // Strict non-zero guarantee for active penalties & bonuses:
        // Any 0-point trigger is dynamically resolved via borrowTriggerPoints
        const sanitizedRulesHit = evalResult.rulesHit.map(r => {
            if (r.points !== 0) return r;
            const borrowed = borrowTriggerPoints(r.description, canonicalCat, day);
            return { description: r.description, points: borrowed };
        });
        const sanitizedEvalScore = sanitizedRulesHit.reduce((sum, r) => sum + r.points, 0);

        const scoreDetail: OptimizedScoreDetail = {
            totalScore: baseInfo.points + sanitizedEvalScore,
            baseInfo,
            rulesHit: sanitizedRulesHit,
            optimizedPrediction: optPred,
            activeHedgingProtocol: evalResult.activeHedgingProtocol
        };

        matchMap.set(cacheKey, scoreDetail);
        return scoreDetail;
    } catch (err) {
        console.error(`Error in getOptimizedScoreDetailed for ${categoryId}:`, err);
        return {
            totalScore: 0,
            baseInfo: { points: 0, mFav: '1', phaPercentage: 0, isUnderdogBase: categoryId === 'upsets' },
            rulesHit: [],
            optimizedPrediction: match.finalPrediction || match.rawPrediction || "1",
            activeHedgingProtocol: null
        };
    }
}

export function getOptimizedScore(
    match: Match, 
    categoryId: string, 
    phaStatsMap: Record<string, any>,
    dayOverride?: DayOfWeek
): number {
    return getOptimizedScoreDetailed(match, categoryId, phaStatsMap, dayOverride).totalScore;
}

/**
 * Applies category-specific hedging protocols to override default hedge predictions.
 */
export function applyHedgingProtocol(
    match: Match, 
    defaultHedge: string, 
    categoryId: string, 
    phaStatsMap: Record<string, any>,
    dayOverride?: DayOfWeek
): string {
    if (categoryId === 'upsets' || categoryId === 'upset' || categoryId === 'sandbox_upsets' || categoryId === 'value_picks' || categoryId === 'sandbox_value_picks') {
        return defaultHedge;
    }
    const detailed = getOptimizedScoreDetailed(match, categoryId, phaStatsMap, dayOverride);
    if (detailed.activeHedgingProtocol) {
        if (detailed.activeHedgingProtocol.includes('(Hedge 12)')) return '12';
        if (detailed.activeHedgingProtocol.includes('(Hedge 1X)')) return '1X';
        if (detailed.activeHedgingProtocol.includes('(Hedge X2)')) return 'X2';
    }

    const subPatPred = match.patternAnalysis?.subPatternPrediction || '';
    const paaPred = match.paaPrediction || match.paaPrimaryPrediction || '';
    const algoPred = (match.algoReport?.prediction || match.pred1x2 || match.rawPrediction || '').trim();
    const mlPred = match.mlInfo?.mlPrediction || match.finalPrediction || match.rawPrediction || '';

    const mFav = getMarketFavorite(match);
    const underdog = mFav === '1' ? '2' : '1';
    const favTS = mFav === '1' ? (match.tsa ?? 0) : (match.tsb ?? 0);
    const udTS = mFav === '1' ? (match.tsb ?? 0) : (match.tsa ?? 0);

    const opwPoints = detailed.totalScore;
    const hedge1X_X2 = mFav === '1' ? '1X' : 'X2';
    const is12 = (pred: string) => pred === '12';
    
    if (is12(paaPred) && is12(subPatPred) && is12(algoPred) && is12(mlPred)) {
        if (opwPoints >= 40) return hedge1X_X2;
        return '12';
    }

    const moParts = (match.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
    const o1 = moParts[0] || 0;
    const oX = moParts[1] || 0;
    const o2 = moParts[2] || 0;
    const udOdds = underdog === '1' ? o1 : underdog === '2' ? o2 : 0;
    const oddsUnderdogLessEqDraw = udOdds > 0 && oX > 0 && udOdds <= oX;

    if (favTS >= 2.0 && udTS < 0.7) {
        if (oddsUnderdogLessEqDraw && udOdds >= 3.0) return '12';
        if (opwPoints >= 45) return hedge1X_X2;
    }

    if (favTS - udTS >= 1.5 || Math.abs(favTS - udTS) >= 1.5) {
        if (oddsUnderdogLessEqDraw && udOdds >= 2.8 && udOdds <= 3.0) return '12';
        if (opwPoints >= 40) return hedge1X_X2;
        return '12';
    }

    return defaultHedge;
}
