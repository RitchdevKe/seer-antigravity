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
    extractMatchEvaluationStats,
    evaluateAllCatalogTriggers
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
import { sanitizeRulePolarity, populateCategoryWithMasterRules, normalizeOpwCategoryId } from './opwCatalog';
export { sanitizeRulePolarity, normalizeOpwCategoryId };

let isDailySettingsInitialized = false;

/**
 * All daily default settings indexed by day of week with memoization to prevent recursive re-computation.
 */
const cachedDefaultSettings: Partial<Record<DayOfWeek, Record<string, OptimizedCategorySettings>>> = {};
export const DAILY_DEFAULT_CATEGORY_SETTINGS: Record<DayOfWeek, Record<string, OptimizedCategorySettings>> = {
    get monday() {
        if (!cachedDefaultSettings.monday) cachedDefaultSettings.monday = getMondayCategorySettings();
        return cachedDefaultSettings.monday;
    },
    get tuesday() {
        if (!cachedDefaultSettings.tuesday) cachedDefaultSettings.tuesday = getTuesdayCategorySettings();
        return cachedDefaultSettings.tuesday;
    },
    get wednesday() {
        if (!cachedDefaultSettings.wednesday) cachedDefaultSettings.wednesday = getWednesdayCategorySettings();
        return cachedDefaultSettings.wednesday;
    },
    get thursday() {
        if (!cachedDefaultSettings.thursday) cachedDefaultSettings.thursday = getThursdayCategorySettings();
        return cachedDefaultSettings.thursday;
    },
    get friday() {
        if (!cachedDefaultSettings.friday) cachedDefaultSettings.friday = getFridayCategorySettings();
        return cachedDefaultSettings.friday;
    },
    get saturday() {
        if (!cachedDefaultSettings.saturday) cachedDefaultSettings.saturday = getSaturdayCategorySettings();
        return cachedDefaultSettings.saturday;
    },
    get sunday() {
        if (!cachedDefaultSettings.sunday) cachedDefaultSettings.sunday = getSundayCategorySettings();
        return cachedDefaultSettings.sunday;
    }
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

const STORAGE_KEY = 'daily_optimized_weights_settings_v27';
const CALIBRATED_CATS_KEY = 'seer_calibrated_day_categories_v1';

export const CALIBRATED_DAY_CATEGORIES = new Set<string>();

export function markDayCategoryCalibrated(day: DayOfWeek, categoryId: string) {
    const catKeys = (categoryId === 'top_12_value' || categoryId === 'top_10_value' || categoryId === 'top12' || categoryId === 'top10')
        ? ['top_12_value', 'top_10_value', 'top12', 'top10']
        : (categoryId === 'upsets' || categoryId === 'upset' || categoryId === 'underdog_upsets')
        ? ['upsets', 'upset', 'underdog_upsets']
        : (categoryId === 'bankers_dlive' || categoryId === 'banker')
        ? ['bankers_dlive', 'banker']
        : (categoryId === 'bankers_jackpot' || categoryId === 'bankers' || categoryId === 'jackpot')
        ? ['bankers_jackpot', 'bankers', 'jackpot']
        : [categoryId];
    for (const k of catKeys) {
        CALIBRATED_DAY_CATEGORIES.add(`${day}_${k}`);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.setItem(CALIBRATED_CATS_KEY, JSON.stringify(Array.from(CALIBRATED_DAY_CATEGORIES)));
        } catch (_) {}
    }
}

export function isDayCategoryCalibrated(day: DayOfWeek, categoryId: string): boolean {
    return CALIBRATED_DAY_CATEGORIES.has(`${day}_${categoryId}`);
}

function hydrateParsedDailySettings(
    base: Record<DayOfWeek, Record<string, OptimizedCategorySettings>>,
    parsed: any
) {
    if (!parsed || typeof parsed !== 'object') return;
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const d of days) {
        if (parsed[d] && typeof parsed[d] === 'object') {
            for (const [catKey, catVal] of Object.entries<any>(parsed[d])) {
                if (!catVal || typeof catVal !== 'object') continue;
                const rawRules = Array.isArray(catVal.rules) ? catVal.rules : [];
                const hydratedRules = rawRules
                    .map((r: any, idx: number) => {
                        if (Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'number') {
                            return { id: `rule_${idx}`, description: r[0], points: r[1] };
                        }
                        if (r && typeof r.description === 'string' && typeof r.points === 'number') {
                            return { id: r.id || `rule_${idx}`, description: r.description, points: r.points };
                        }
                        return null;
                    })
                    .filter(Boolean) as { id: string; description: string; points: number }[];
                const existingTemplate = base[d]?.[catKey] || DAILY_DEFAULT_CATEGORY_SETTINGS[d]?.[catKey];
                const normCatKey = normalizeOpwCategoryId(catKey);
                const inferredObjective: 'mfav_draw' | 'mfav_only' | 'underdog_only' =
                    normCatKey === 'upsets'
                        ? 'underdog_only'
                        : (normCatKey === 'top_12_value' || normCatKey === 'value_bets')
                            ? 'mfav_draw'
                            : 'mfav_only';
                const mergedCat: OptimizedCategorySettings = {
                    ...(existingTemplate || {}),
                    ...catVal,
                    rules: populateCategoryWithMasterRules(hydratedRules, inferredObjective, catKey, d, { preserveExact: true })
                };
                const aliasKeys = (catKey === 'top_12_value' || catKey === 'top_10_value')
                    ? ['top_12_value', 'top_10_value', 'top12', 'top10']
                    : (catKey === 'upsets' || catKey === 'upset')
                    ? ['upsets', 'upset']
                    : (catKey === 'bankers_dlive' || catKey === 'banker')
                    ? ['bankers_dlive', 'banker']
                    : (catKey === 'bankers_jackpot' || catKey === 'bankers' || catKey === 'jackpot')
                    ? ['bankers_jackpot', 'bankers', 'jackpot']
                    : [catKey];
                for (const ak of aliasKeys) {
                    base[d][ak] = JSON.parse(JSON.stringify(mergedCat));
                }
            }
        }
    }
}

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
            const savedCalibrated = window.localStorage.getItem(CALIBRATED_CATS_KEY);
            if (savedCalibrated) {
                const arr = JSON.parse(savedCalibrated);
                if (Array.isArray(arr)) {
                    arr.forEach(item => { if (typeof item === 'string') CALIBRATED_DAY_CATEGORIES.add(item); });
                }
            }
        } catch (_) {}

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
            window.localStorage.removeItem('daily_optimized_weights_settings_v10');
            window.localStorage.removeItem('daily_optimized_weights_settings_v11');
            window.localStorage.removeItem('daily_optimized_weights_settings_v12');
            window.localStorage.removeItem('daily_optimized_weights_settings_v13');
            window.localStorage.removeItem('daily_optimized_weights_settings_v14');
            window.localStorage.removeItem('daily_optimized_weights_settings_v15');
            window.localStorage.removeItem('daily_optimized_weights_settings_v16');
            window.localStorage.removeItem('daily_optimized_weights_settings_v17');
            window.localStorage.removeItem('daily_optimized_weights_settings_v18');
            window.localStorage.removeItem('daily_optimized_weights_settings_v19');
            window.localStorage.removeItem('daily_optimized_weights_settings_v20');
            window.localStorage.removeItem('daily_optimized_weights_settings_v21');
            window.localStorage.removeItem('daily_optimized_weights_settings_v22');
            window.localStorage.removeItem('daily_optimized_weights_settings_v23');
            window.localStorage.removeItem('daily_optimized_weights_settings_v24');
            window.localStorage.removeItem('daily_optimized_weights_settings_v25');
            window.localStorage.removeItem('daily_optimized_weights_settings_v26');

            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                hydrateParsedDailySettings(base, parsed);
            }
        } catch (e) {
            console.warn('[optimizedweights] Failed to hydrate settings from localStorage', e);
        }
    }
    // Ensure all rules across all days strictly adhere to domain semantic polarity while preserving calibrated 0 points
    const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const d of allDays) {
        if (base[d]) {
            for (const catKey of Object.keys(base[d])) {
                if (base[d][catKey]?.rules) {
                    base[d][catKey].rules = sanitizeRulePolarity(base[d][catKey].rules, catKey, { preserveExact: true, day: d });
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
const LS_PERSIST_TS_KEY = 'daily_optimized_weights_ls_ts_v1';
let localOpwMutationEpoch = 0;
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

export function setDailySettingsMeta(days: DayOfWeek[], ts: number, fromServer: boolean = false) {
    if (!fromServer) {
        localOpwMutationEpoch++;
    }
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const meta = getDailySettingsMeta();
        days.forEach(d => { meta[d] = ts; });
        window.localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (e) {}
}

const CANONICAL_CATS_FOR_STORAGE = [
    'top_12_value',
    'best_bet',
    'bankers_dlive',
    'bankers_jackpot',
    'value_picks',
    'value_bets',
    'upsets',
    'botb_best',
    'high_confidence'
];

function compactCategoryMapForStorage(catMap: Record<string, OptimizedCategorySettings>): Record<string, any> {
    const out: Record<string, any> = {};
    if (!catMap || typeof catMap !== 'object') return out;
    for (const catKey of CANONICAL_CATS_FOR_STORAGE) {
        const cat = catMap[catKey]
            || (catKey === 'top_12_value' ? catMap['top_10_value'] : undefined)
            || (catKey === 'upsets' ? catMap['upset'] : undefined)
            || (catKey === 'bankers_dlive' ? catMap['banker'] : undefined)
            || (catKey === 'value_bets' ? catMap['value_bet'] : undefined);
        if (!cat) continue;
        out[catKey] = {
            name: cat.name,
            description: cat.description,
            baseLogic: cat.baseLogic,
            baseWeightIntervals: cat.baseWeightIntervals,
            rules: (cat.rules || []).map(r => [r.description, r.points])
        };
    }
    return out;
}

export function savePersistedDailySettings() {
    if (typeof window !== 'undefined' && window.localStorage) {
        const compactDaily: Partial<Record<DayOfWeek, Record<string, any>>> = {};
        for (const d of ALL_WEEK_DAYS) {
            if (DAILY_OPTIMIZED_SETTINGS[d]) {
                compactDaily[d] = compactCategoryMapForStorage(DAILY_OPTIMIZED_SETTINGS[d]);
            }
        }
        const serializedDaily = JSON.stringify(compactDaily);
        const serializedMain = JSON.stringify(compactCategoryMapForStorage(OPTIMIZED_CATEGORY_SETTINGS));
        const persistTs = Date.now();
        try {
            window.localStorage.setItem(STORAGE_KEY, serializedDaily);
            window.localStorage.setItem('optimized_weights_settings', serializedMain);
            window.localStorage.setItem(LS_PERSIST_TS_KEY, String(persistTs));
        } catch (e) {
            // Free up localStorage quota by evicting regenerable slip cache ONLY (NEVER delete seer_opw_peak_memory_*)
            try {
                const keysToRemove: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                    const k = window.localStorage.key(i);
                    if (k && (
                        k.startsWith('local_locked_slip_') ||
                        k.startsWith('seer_locked_slip_hash_') ||
                        (k.startsWith('daily_optimized_weights_settings_') && k !== STORAGE_KEY)
                    )) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => window.localStorage.removeItem(k));
                window.localStorage.setItem(STORAGE_KEY, serializedDaily);
                window.localStorage.setItem('optimized_weights_settings', serializedMain);
                window.localStorage.setItem(LS_PERSIST_TS_KEY, String(persistTs));
            } catch (retryErr) {
                console.warn('[optimizedweights] Failed to save settings to localStorage after quota cleanup', retryErr);
            }
        }
        // Also persist timestamped snapshot to IndexedDB so localStorage quota limits can never silently revert calibrated settings
        const metaSnapshot = getDailySettingsMeta();
        import('idb-keyval').then(({ set }) => {
            set(STORAGE_KEY, { version: 2, savedAt: persistTs, meta: metaSnapshot, data: compactDaily }).catch(() => {});
        }).catch(() => {});
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
isDailySettingsInitialized = true;

// Sync initial OPTIMIZED_CATEGORY_SETTINGS with Saturday's hydrated settings
if (DAILY_OPTIMIZED_SETTINGS.saturday) {
    OPTIMIZED_CATEGORY_SETTINGS = { ...OPTIMIZED_CATEGORY_SETTINGS, ...DAILY_OPTIMIZED_SETTINGS.saturday };
}

// Asynchronous fallback hydration from IndexedDB whenever localStorage is missing STORAGE_KEY or missed a newer write (e.g. QuotaExceededError)
if (typeof window !== 'undefined' && window.localStorage) {
    import('idb-keyval').then(async ({ get }) => {
        try {
            const idbSaved = await get(STORAGE_KEY);
            if (!idbSaved || typeof idbSaved !== 'object') return;
            const isV2 = Boolean(idbSaved.version === 2 && idbSaved.data && typeof idbSaved.data === 'object');
            const idbSavedAt = isV2 ? (Number(idbSaved.savedAt) || 0) : 0;
            const lsPersistedAt = Number(window.localStorage.getItem(LS_PERSIST_TS_KEY) || 0);
            const hasLS = Boolean(window.localStorage.getItem(STORAGE_KEY));
            if (!hasLS || (isV2 && idbSavedAt > lsPersistedAt)) {
                const payloadToHydrate = isV2 ? idbSaved.data : idbSaved;
                if (!payloadToHydrate || typeof payloadToHydrate !== 'object') return;
                hydrateParsedDailySettings(DAILY_OPTIMIZED_SETTINGS, payloadToHydrate);
                if (isV2 && idbSaved.meta && typeof idbSaved.meta === 'object') {
                    const currentMeta = getDailySettingsMeta();
                    let metaChanged = false;
                    for (const d of ALL_WEEK_DAYS) {
                        const idbDayTs = Number(idbSaved.meta[d] || 0);
                        const curDayTs = Number(currentMeta[d] || 0);
                        if (idbDayTs > curDayTs) {
                            currentMeta[d] = idbDayTs;
                            metaChanged = true;
                        }
                    }
                    if (metaChanged) {
                        try {
                            window.localStorage.setItem(META_KEY, JSON.stringify(currentMeta));
                        } catch (_) {}
                    }
                }
                clearOptimizedScoreCache();
                savePersistedDailySettings();
                window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: 'all', day: 'all', source: 'idb-restore' } }));
            }
        } catch (_) {}
    }).catch(() => {});
}

export interface OpwSettingsUpdateOptions {
    /** Suppress the synchronous 'optimizedWeightsUpdated'/'seerLockedSlipsUpdated' events (caller dispatches later). */
    silent?: boolean;
    /** 'server' = hydrated from /api/opw/rules; 'codebase' = explicitly saved via Save to Codebase; 'user' = runtime-only session adjustment. */
    source?: 'user' | 'server' | 'codebase';
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
        : (categoryId === 'upsets' || categoryId === 'upset')
        ? ['upsets', 'upset']
        : (categoryId === 'bankers_dlive' || categoryId === 'banker')
        ? ['bankers_dlive', 'banker']
        : (categoryId === 'bankers_jackpot' || categoryId === 'bankers' || categoryId === 'jackpot')
        ? ['bankers_jackpot', 'bankers', 'jackpot']
        : (categoryId === 'value_bets' || categoryId === 'value_bet')
        ? ['value_bets', 'value_bet']
        : [categoryId];

    const sanitizedRules = settings.rules ? sanitizeRulePolarity(settings.rules, categoryId, { preserveExact: true, day }) : [];
    const sanitizedSettings: OptimizedCategorySettings = {
        ...settings,
        rules: sanitizedRules
    };

    for (const key of catKeys) {
        DAILY_OPTIMIZED_SETTINGS[day][key] = JSON.parse(JSON.stringify(sanitizedSettings));
    }
    markDayCategoryCalibrated(day, categoryId);

    if (syncMainAlgo) {
        for (const key of catKeys) {
            OPTIMIZED_CATEGORY_SETTINGS[key] = JSON.parse(JSON.stringify(sanitizedSettings));
        }
    }
    clearOptimizedScoreCache();
    // Always persist updated settings to localStorage so runtime & codebase updates never revert
    if (options.source !== 'server') {
        setDailySettingsMeta([day], Date.now());
        if (sanitizedRules.length > 0) {
            record3WeekTriggerSnapshot(day, categoryId, sanitizedRules);
        }
    }
    savePersistedDailySettings();
    if (typeof window !== 'undefined' && !options.silent) {
        window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: categoryId, day, syncMainAlgo: false, purge: false, wipeSlips: false } }));
        window.dispatchEvent(new CustomEvent('seerLockedSlipsUpdated', { detail: { category: categoryId, day, purge: false, wipeSlips: false } }));
        window.dispatchEvent(new Event('opw-weights-updated'));
    }
}

export function updateOptimizedCategorySettings(categoryId: string, settings: OptimizedCategorySettings, day?: DayOfWeek, options: OpwSettingsUpdateOptions = {}) {
    if (day) {
        updateDailyOptimizedCategorySettings(day, categoryId, settings, false, options);
        return;
    }
    const catKeys = (categoryId === 'top_12_value' || categoryId === 'top_10_value' || categoryId === 'top12' || categoryId === 'top10')
        ? ['top_12_value', 'top_10_value', 'top12', 'top10']
        : (categoryId === 'upsets' || categoryId === 'upset')
        ? ['upsets', 'upset']
        : (categoryId === 'bankers_dlive' || categoryId === 'banker')
        ? ['bankers_dlive', 'banker']
        : (categoryId === 'bankers_jackpot' || categoryId === 'bankers' || categoryId === 'jackpot')
        ? ['bankers_jackpot', 'bankers', 'jackpot']
        : (categoryId === 'value_bets' || categoryId === 'value_bet')
        ? ['value_bets', 'value_bet']
        : [categoryId];

    const sanitizedRules = settings.rules ? sanitizeRulePolarity(settings.rules, categoryId, { preserveExact: true }) : [];
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
        markDayCategoryCalibrated(d, categoryId);
    }
    clearOptimizedScoreCache();
    if (options.source !== 'server') {
        setDailySettingsMeta(ALL_WEEK_DAYS, Date.now());
    }
    savePersistedDailySettings();
    if (typeof window !== 'undefined' && !options.silent) {
        window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: categoryId, day: 'all', syncMainAlgo: true, purge: false, wipeSlips: false } }));
        window.dispatchEvent(new CustomEvent('seerLockedSlipsUpdated', { detail: { category: categoryId, day: 'all', purge: false, wipeSlips: false } }));
    }
}

export interface ThreeWeekTriggerSnapshot {
    weekKey: string;
    savedAt: string;
    points: Record<string, number>;
}

export interface ThreeWeekTriggerConsistency {
    weeks: { weekKey: string; points: number }[];
    avgPoints: number;
    consistency: 1 | -1 | 0; // 1 = consistent bonus, -1 = consistent penalty, 0 = mixed/neutral
    flippedSign: boolean;
}

const THREE_WEEK_MEMORY_KEY = 'seer_opw_3week_trigger_memory_v1';
export const THREE_WEEK_TRIGGER_MEMORY: Record<string, Record<string, ThreeWeekTriggerSnapshot[]>> = (() => {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const raw = window.localStorage.getItem(THREE_WEEK_MEMORY_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (_) {}
    }
    return {};
})();

export function getIsoWeekKey(dateInput: Date | string = new Date()): string {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput.getTime());
    if (isNaN(d.getTime())) return getIsoWeekKey(new Date());
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function persist3WeekTriggerMemory() {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.setItem(THREE_WEEK_MEMORY_KEY, JSON.stringify(THREE_WEEK_TRIGGER_MEMORY));
        } catch (_) {}
    }
}

export function hydrate3WeekTriggerMemory(serverMemory: any) {
    if (!serverMemory || typeof serverMemory !== 'object') return;
    let changed = false;
    for (const [dayKey, catMap] of Object.entries<any>(serverMemory)) {
        if (!catMap || typeof catMap !== 'object') continue;
        const normDay = dayKey.toLowerCase();
        if (!THREE_WEEK_TRIGGER_MEMORY[normDay]) THREE_WEEK_TRIGGER_MEMORY[normDay] = {};
        for (const [catId, snaps] of Object.entries<any>(catMap)) {
            if (!Array.isArray(snaps)) continue;
            const normCat = normalizeOpwCategoryId(catId);
            const existing = Array.isArray(THREE_WEEK_TRIGGER_MEMORY[normDay][normCat])
                ? THREE_WEEK_TRIGGER_MEMORY[normDay][normCat]
                : [];
            const byWeek = new Map<string, ThreeWeekTriggerSnapshot>();
            existing.forEach(s => { if (s?.weekKey) byWeek.set(s.weekKey, s); });
            snaps.forEach((s: any) => {
                if (!s?.weekKey || !s?.points || typeof s.points !== 'object') return;
                const prev = byWeek.get(s.weekKey);
                const sTs = Date.parse(s.savedAt || '') || 0;
                const pTs = prev ? (Date.parse(prev.savedAt || '') || 0) : -1;
                if (sTs >= pTs) {
                    byWeek.set(s.weekKey, { weekKey: s.weekKey, savedAt: s.savedAt || new Date().toISOString(), points: s.points });
                }
            });
            const merged = Array.from(byWeek.values())
                .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
                .slice(-3);
            if (JSON.stringify(merged) !== JSON.stringify(existing)) {
                THREE_WEEK_TRIGGER_MEMORY[normDay][normCat] = merged;
                changed = true;
            }
        }
    }
    if (changed) persist3WeekTriggerMemory();
}

export function record3WeekTriggerSnapshot(
    day: DayOfWeek | string,
    categoryId: string,
    rulesOrMap: { description: string; points: number }[] | Map<string, number> | Record<string, number>,
    weekKeyInput?: string
) {
    const normDay = String(day || 'saturday').toLowerCase();
    const normCat = normalizeOpwCategoryId(categoryId);
    const nowIso = new Date().toISOString();
    const weekKey = weekKeyInput || getIsoWeekKey(nowIso);
    const pointsObj: Record<string, number> = {};
    if (Array.isArray(rulesOrMap)) {
        rulesOrMap.forEach(r => {
            if (r?.description && typeof r.points === 'number' && !isNaN(r.points)) {
                pointsObj[r.description] = r.points;
            }
        });
    } else if (rulesOrMap instanceof Map) {
        rulesOrMap.forEach((pts, desc) => {
            if (desc && typeof pts === 'number' && !isNaN(pts)) {
                pointsObj[desc] = pts;
            }
        });
    } else if (rulesOrMap && typeof rulesOrMap === 'object') {
        Object.entries(rulesOrMap).forEach(([desc, pts]) => {
            if (desc && typeof pts === 'number' && !isNaN(pts)) {
                pointsObj[desc] = pts;
            }
        });
    }
    if (Object.keys(pointsObj).length === 0) return;

    if (!THREE_WEEK_TRIGGER_MEMORY[normDay]) THREE_WEEK_TRIGGER_MEMORY[normDay] = {};
    const list = Array.isArray(THREE_WEEK_TRIGGER_MEMORY[normDay][normCat])
        ? [...THREE_WEEK_TRIGGER_MEMORY[normDay][normCat]]
        : [];
    const idx = list.findIndex(s => s.weekKey === weekKey);
    const entry: ThreeWeekTriggerSnapshot = { weekKey, savedAt: nowIso, points: pointsObj };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);

    THREE_WEEK_TRIGGER_MEMORY[normDay][normCat] = list
        .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
        .slice(-3);
    persist3WeekTriggerMemory();
}

export function get3WeekTriggerConsistencyMap(
    day: DayOfWeek | string,
    categoryId: string
): Map<string, ThreeWeekTriggerConsistency> {
    const normDay = String(day || 'saturday').toLowerCase() as DayOfWeek;
    const normCat = normalizeOpwCategoryId(categoryId);
    const result = new Map<string, ThreeWeekTriggerConsistency>();
    let snapshots = THREE_WEEK_TRIGGER_MEMORY[normDay]?.[normCat]
        || THREE_WEEK_TRIGGER_MEMORY[normDay]?.[categoryId]
        || [];

    // If no multi-week snapshots exist yet, seed an initial virtual Week-0 baseline from saved/default rules
    if (snapshots.length === 0) {
        const baselineRules = DAILY_OPTIMIZED_SETTINGS[normDay]?.[normCat]?.rules
            || DAILY_OPTIMIZED_SETTINGS[normDay]?.[categoryId]?.rules
            || DAILY_DEFAULT_CATEGORY_SETTINGS[normDay]?.[normCat]?.rules
            || [];
        if (baselineRules.length > 0) {
            const ptsObj: Record<string, number> = {};
            baselineRules.forEach(r => { if (r?.description && typeof r.points === 'number') ptsObj[r.description] = r.points; });
            snapshots = [{ weekKey: 'Baseline', savedAt: '', points: ptsObj }];
        }
    }
    if (snapshots.length === 0) return result;

    const allDescs = new Set<string>();
    snapshots.forEach(s => Object.keys(s.points || {}).forEach(d => allDescs.add(d)));

    allDescs.forEach(desc => {
        const weeks: { weekKey: string; points: number }[] = [];
        let sum = 0;
        let posCount = 0;
        let negCount = 0;
        snapshots.forEach(s => {
            const p = s.points?.[desc];
            if (typeof p === 'number' && !isNaN(p) && p !== 0) {
                weeks.push({ weekKey: s.weekKey, points: p });
                sum += p;
                if (p > 0) posCount++;
                else if (p < 0) negCount++;
            }
        });
        if (weeks.length === 0) return;
        const avgPoints = sum / weeks.length;
        const flippedSign = posCount > 0 && negCount > 0;
        let consistency: 1 | -1 | 0 = 0;
        if (!flippedSign) {
            if (weeks.length >= 2) {
                if (posCount === weeks.length && avgPoints >= 10) consistency = 1;
                else if (negCount === weeks.length && avgPoints <= -10) consistency = -1;
            } else {
                if (avgPoints >= 15) consistency = 1;
                else if (avgPoints <= -15) consistency = -1;
            }
        }
        result.set(desc, { weeks, avgPoints, consistency, flippedSign });
    });

    return result;
}

/**
 * Loads rules persisted by "Save to codebase" / "Apply to Runtime" (server JSON + RDS at /api/opw/rules) and applies
 * them per day on startup so saved rules permanently replace old trigger points across reloads.
 */
let serverRulesLoadPromise: Promise<DayOfWeek[]> | null = null;
let inFlightServerRulesPromise: Promise<DayOfWeek[]> | null = null;
const LEGACY_CATEGORY_SORT_SET = new Set(['top_10_value', 'top10', 'upset', 'underdog_upsets', 'banker', 'value_bet']);
const getCategoryApplyOrder = (catId: string): number => (LEGACY_CATEGORY_SORT_SET.has(catId) ? 0 : 1);

export function loadServerOpwRules(force: boolean = false): Promise<DayOfWeek[]> {
    if (inFlightServerRulesPromise) return inFlightServerRulesPromise;
    if (serverRulesLoadPromise && !force) return serverRulesLoadPromise;
    const runPromise = (async () => {
        const applied: DayOfWeek[] = [];
        if (typeof window === 'undefined' || typeof fetch === 'undefined') return applied;
        const startEpoch = localOpwMutationEpoch;
        try {
            const res = await fetch('/api/opw/rules', { cache: 'no-store' });
            if (!res.ok) {
                if (serverRulesLoadPromise === runPromise) serverRulesLoadPromise = null;
                return applied;
            }
            const json = await res.json();
            if (json && typeof json === 'object' && json.weeklyMemory) {
                hydrate3WeekTriggerMemory(json.weeklyMemory);
            }
            const rulesByDay = (json && typeof json === 'object' && json.rules) ? json.rules : {};
            const localMeta = getDailySettingsMeta();
            const localChangedWhileInFlight = localOpwMutationEpoch !== startEpoch;
            for (const day of ALL_WEEK_DAYS) {
                const entry = rulesByDay[day];
                if (!entry || !entry.categories || typeof entry.categories !== 'object') continue;
                const savedAt = Date.parse(entry.savedAt) || 0;

                // Timestamp Guard: Never overwrite local settings if local has newer calibrations,
                // UNLESS force = true AND no local mutation happened while this fetch was in flight.
                const localSavedAt = localMeta[day] || 0;
                if ((!force || localChangedWhileInFlight) && localSavedAt > 0 && localSavedAt > savedAt) {
                    continue;
                }

                const sortedCatEntries = Object.entries<any>(entry.categories).sort(
                    ([catA], [catB]) => getCategoryApplyOrder(catA) - getCategoryApplyOrder(catB)
                );

                for (const [catId, catData] of sortedCatEntries) {
                    const rawRules = Array.isArray(catData?.rules) ? catData.rules : [];
                    const tuned = rawRules
                        .filter((r: any) => r && typeof r.description === 'string' && typeof r.points === 'number')
                        .map((r: any) => ({ description: r.description, points: r.points }));
                    if (tuned.length === 0) continue;
                    const objective = (catData?.targetObjective === 'mfav_only' || catData?.targetObjective === 'underdog_only' || catData?.targetObjective === 'mfav_draw')
                        ? catData.targetObjective
                        : (catId === 'upsets' || catId === 'upset' ? 'underdog_only' : (catId === 'top_12_value' || catId === 'top_10_value' || catId === 'value_bets' || catId === 'value_bet') ? 'mfav_draw' : 'mfav_only');
                    
                    const aliasKey = catId === 'top_12_value' ? 'top_10_value' : (catId === 'top_10_value' ? 'top_12_value' : (catId === 'upsets' ? 'upset' : (catId === 'upset' ? 'upsets' : (catId === 'bankers_dlive' ? 'banker' : (catId === 'banker' ? 'bankers_dlive' : (catId === 'value_bets' ? 'value_bet' : (catId === 'value_bet' ? 'value_bets' : undefined)))))));
                    const targetCats = [catId];
                    if (aliasKey && !targetCats.includes(aliasKey)) targetCats.push(aliasKey);

                    for (const targetCat of targetCats) {
                        const existing = DAILY_OPTIMIZED_SETTINGS[day]?.[targetCat] || DAILY_DEFAULT_CATEGORY_SETTINGS[day]?.[targetCat];
                        if (!existing) continue;
                        const existingUntuned = Array.isArray(existing.rules)
                            ? existing.rules.map(r => ({ description: r.description, points: r.points }))
                            : [];
                        const exactServerRules = populateCategoryWithMasterRules(
                            [...tuned, ...existingUntuned],
                            objective,
                            targetCat,
                            day,
                            { preserveExact: true }
                        );
                        updateDailyOptimizedCategorySettings(
                            day,
                            targetCat,
                            { ...existing, rules: exactServerRules },
                            false,  // Never force syncMainAlgo from server load — prevents Saturday reversion
                            { silent: true, source: 'server' }
                        );
                        // Keep Peak Memory points aligned with server-saved rules so old points never resurrect
                        if (window.localStorage) {
                            try {
                                const pmKey = `seer_opw_peak_memory_${day}_${targetCat}`;
                                const rawPm = window.localStorage.getItem(pmKey);
                                const existingPm = rawPm ? JSON.parse(rawPm) : {};
                                window.localStorage.setItem(pmKey, JSON.stringify({
                                    cleanTopMatches: existingPm?.cleanTopMatches || 0,
                                    firstTrapRank: existingPm?.firstTrapRank || 0,
                                    quality: existingPm?.quality || 0,
                                    trapRanks: existingPm?.trapRanks || [],
                                    trapGaps: existingPm?.trapGaps || [],
                                    points: Object.fromEntries(exactServerRules.map(r => [r.description, r.points])),
                                    updatedAt: savedAt || Date.now()
                                }));
                            } catch (_) {}
                        }
                    }
                }
                if (savedAt > 0) {
                    setDailySettingsMeta([day], savedAt, true);
                }
                applied.push(day);
            }
            if (applied.length > 0) {
                clearOptimizedScoreCache();
                savePersistedDailySettings();
                window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', {
                    detail: { category: 'all', day: applied.length === 1 ? applied[0] : 'all', days: applied, source: 'server-rules', purge: false, wipeSlips: false }
                }));
                window.dispatchEvent(new CustomEvent('seerLockedSlipsUpdated', { detail: { category: 'all', purge: false, wipeSlips: false } }));
                window.dispatchEvent(new Event('opw-weights-updated'));
            }
        } catch (e) {
            if (serverRulesLoadPromise === runPromise) serverRulesLoadPromise = null;
            // Silent: server rules are optional
        } finally {
            if (inFlightServerRulesPromise === runPromise) inFlightServerRulesPromise = null;
        }
        return applied;
    })();
    inFlightServerRulesPromise = runPromise;
    serverRulesLoadPromise = runPromise;
    return runPromise;
}

export function invalidateServerRulesCache(): void {
    serverRulesLoadPromise = null;
    inFlightServerRulesPromise = null;
}

// Invoke once at app startup (module is loaded early by MatchAnalysis / SeerAnalysis / OPW algo)
if (typeof window !== 'undefined') {
    loadServerOpwRules(true);
}

export function replaceAllOptimizedCategorySettings(settings: Record<string, OptimizedCategorySettings>, day?: DayOfWeek) {
    const HARDCODED_CATEGORIES = ['best_bet', 'bankers_dlive', 'top_12_value', 'top_10_value', 'upsets', 'botb_best', 'value_picks', 'value_bets', 'bankers_jackpot', 'high_confidence'];
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
            merged[k].rules = sanitizeRulePolarity(merged[k].rules, k, { preserveExact: true });
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
let weightsEpoch = Date.now();
export function clearOptimizedScoreCache() {
    scoreCache = new WeakMap();
    weightsEpoch = Date.now();
}
if (typeof window !== 'undefined') {
    window.addEventListener('optimizedWeightsUpdated', clearOptimizedScoreCache);
    window.addEventListener('seerLockedSlipsUpdated', clearOptimizedScoreCache);
    window.addEventListener('opwProtectedGuardsUpdated', clearOptimizedScoreCache);
    window.addEventListener('opw-weights-updated', clearOptimizedScoreCache);
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
    const isBankerDraws = ['banker_draws', 'bankers_draws', 'banker_draw'].includes(categoryId || '');
    const isValueBets = ['value_bets', 'value_bet'].includes(categoryId || '');
    const isT12 = ['top_12_value', 'top_10_value', 'top12', 'top10'].includes(categoryId || '');
    const isVb = isValueBets;
    const targetSide = isUnderdogBase ? underdog : mFav;
    
    let phaPercentage = 0;
    const primaryPattern = match.patternAnalysis?.subPattern;
    if (primaryPattern && phaStatsMap[primaryPattern]) {
        const stats = phaStatsMap[primaryPattern];
        if (stats.total > 0) {
            if (isBankerDraws) {
                // Banker Draws base trigger: Draw Primary Pattern PHA %
                phaPercentage = (((stats.outcomes?.['X'] ?? 0) / stats.total) * 100);
            } else if (isT12 || isValueBets) {
                // Top 12 Value and Value Bets target is Mfav + Draw combined
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
        (isVb ? (daySettings?.['value_bets'] || daySettings?.['value_bet']) : undefined) ||
        OPTIMIZED_CATEGORY_SETTINGS[categoryId] ||
        (isT12 ? (OPTIMIZED_CATEGORY_SETTINGS['top_12_value'] || OPTIMIZED_CATEGORY_SETTINGS['top_10_value'] || OPTIMIZED_CATEGORY_SETTINGS['top12'] || OPTIMIZED_CATEGORY_SETTINGS['top10']) : undefined) ||
        (isVb ? (OPTIMIZED_CATEGORY_SETTINGS['value_bets'] || OPTIMIZED_CATEGORY_SETTINGS['value_bet']) : undefined)
    ) : undefined;

    if (catSettings?.baseWeightIntervals && catSettings.baseWeightIntervals.length > 0) {
        for (const interval of catSettings.baseWeightIntervals) {
            if (phaPercentage >= interval.min && phaPercentage <= interval.max) {
                points = interval.points;
                break;
            }
        }
    } else {
        if (isBankerDraws) {
            if (phaPercentage >= 35) points = 45;
            else if (phaPercentage >= 30) points = 40;
            else if (phaPercentage >= 25) points = 30;
            else if (phaPercentage >= 20) points = 20;
            else points = 10;
        } else {
            if (phaPercentage >= 60) points = 45;
            else if (phaPercentage >= 50) points = 40;
            else if (phaPercentage >= 45) points = 35;
            else if (phaPercentage >= 40) points = 25;
            else if (phaPercentage >= 34) points = 10;
            else points = 5;
        }
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

    const day = dayOverride || getMatchDayOfWeek(match);
    const cacheKey = `${categoryId}_${day}_${weightsEpoch}`;

    if (match.lockedOpwScores) {
        delete match.lockedOpwScores;
    }

    let matchMap = scoreCache.get(match);
    if (!matchMap) {
        matchMap = new Map();
        scoreCache.set(match, matchMap);
    }
    const cached = matchMap.get(cacheKey);
    if (cached) return cached;

    try {
        const stats = extractMatchEvaluationStats(match, phaStatsMap, categoryId);
        const canonicalCat = stats.evalCategoryId || categoryId;
        const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, canonicalCat, day);

        const isBankerDraws = ['banker_draws', 'bankers_draws', 'banker_draw'].includes(canonicalCat) || ['banker_draws', 'bankers_draws', 'banker_draw'].includes(categoryId);

        // Banker draws dont have trigger points, they just have the base triggers.
        if (isBankerDraws) {
            const optPred = 'X';
            const scoreDetail: OptimizedScoreDetail = {
                totalScore: baseInfo.points,
                baseInfo,
                rulesHit: [],
                optimizedPrediction: optPred,
                activeHedgingProtocol: null
            };
            matchMap.set(cacheKey, scoreDetail);
            return scoreDetail;
        }

        const daySettings = DAILY_OPTIMIZED_SETTINGS[day] || DAILY_DEFAULT_CATEGORY_SETTINGS[day];
        const isT12 = ['top_12_value', 'top_10_value', 'top12', 'top10'].includes(canonicalCat) || ['top_12_value', 'top_10_value', 'top12', 'top10'].includes(categoryId);
        const isUpsets = ['upsets', 'upset', 'underdog_upsets', 'underdog_only'].includes(canonicalCat) || ['upsets', 'upset', 'underdog_upsets', 'underdog_only'].includes(categoryId);
        const isBdl = ['bankers_dlive', 'banker'].includes(canonicalCat) || ['bankers_dlive', 'banker'].includes(categoryId);
        const isBj = ['bankers_jackpot', 'bankers', 'jackpot'].includes(canonicalCat) || ['bankers_jackpot', 'bankers', 'jackpot'].includes(categoryId);
        const isVp = ['value_picks', 'sandbox_value_picks'].includes(canonicalCat) || ['value_picks', 'sandbox_value_picks'].includes(categoryId);
        const isVb = ['value_bets', 'value_bet', 'sandbox_value_bets'].includes(canonicalCat) || ['value_bets', 'value_bet', 'sandbox_value_bets'].includes(categoryId);
        const isBb = ['best_bet', 'best'].includes(canonicalCat) || ['best_bet', 'best'].includes(categoryId);

        // Strict day-specific settings lookup: NO falling back to Saturday or master defaults!
        const categoryConfig = daySettings?.[canonicalCat] || 
                               daySettings?.[categoryId] || 
                               (isT12 ? (daySettings?.['top_12_value'] || daySettings?.['top_10_value'] || daySettings?.['top12'] || daySettings?.['top10']) : undefined) ||
                               (isUpsets ? (daySettings?.['upsets'] || daySettings?.['upset']) : undefined) ||
                               (isBdl ? (daySettings?.['bankers_dlive'] || daySettings?.['banker']) : undefined) ||
                               (isBj ? (daySettings?.['bankers_jackpot'] || daySettings?.['bankers'] || daySettings?.['jackpot']) : undefined) ||
                               (isVp ? (daySettings?.['value_picks']) : undefined) ||
                               (isVb ? (daySettings?.['value_bets'] || daySettings?.['value_bet']) : undefined) ||
                               (isBb ? (daySettings?.['best_bet']) : undefined) ||
                               DAILY_DEFAULT_CATEGORY_SETTINGS[day]?.[canonicalCat] ||
                               DAILY_DEFAULT_CATEGORY_SETTINGS[day]?.[categoryId];

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

        const finalRulesHit = [...evalResult.rulesHit];
        const finalEvalScore = finalRulesHit.reduce((sum, r) => sum + r.points, 0);

        const scoreDetail: OptimizedScoreDetail = {
            totalScore: baseInfo.points + finalEvalScore,
            baseInfo,
            rulesHit: finalRulesHit,
            optimizedPrediction: optPred,
            activeHedgingProtocol: evalResult.activeHedgingProtocol
        };

        matchMap.set(cacheKey, scoreDetail);
        return scoreDetail;
    } catch (err) {
        console.error(`Error in getOptimizedScoreDetailed for ${categoryId}:`, (err as any)?.stack || err);
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
