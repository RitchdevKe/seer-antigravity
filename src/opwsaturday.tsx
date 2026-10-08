import {
    SATURDAY_TOP_12_RULES,
    SATURDAY_BEST_BET_RULES,
    SATURDAY_BANKERS_DLIVE_RULES,
    SATURDAY_BANKERS_JACKPOT_RULES,
    SATURDAY_VALUE_PICKS_RULES,
    SATURDAY_UPSETS_RULES,
    SATURDAY_BOTB_RULES
} from './utils/opwSaturdayRules';
import React, { useState, useMemo } from 'react';
import { Match } from './types';
import { DayMetadata, DAY_METADATA } from './utils/opwDayMetadata';
import { populateCategoryWithMasterRules, borrowTriggerPoints } from './utils/opwCatalog';
import { 
    OptimizedCategorySettings, 
    MatchEvaluationStats,
    isClose,
    evaluateAllCatalogTriggers
} from './utils/opwCommon';
import { Calendar, Trophy, Sliders, CheckCircle2 } from 'lucide-react';

// Re-export dedicated Saturday rules for day isolation
export {
    SATURDAY_TOP_12_RULES,
    SATURDAY_BEST_BET_RULES,
    SATURDAY_BANKERS_DLIVE_RULES,
    SATURDAY_BANKERS_JACKPOT_RULES,
    SATURDAY_VALUE_PICKS_RULES,
    SATURDAY_UPSETS_RULES,
    SATURDAY_BOTB_RULES
};

export const SATURDAY_METADATA: DayMetadata = DAY_METADATA.saturday;

/**
 * Saturday OPW Default Category Settings
 */
export function getSaturdayCategorySettings(): Record<string, OptimizedCategorySettings> {
    const top12Config: OptimizedCategorySettings = {
        name: "Top 12 Value (Saturday)",
        description: "Saturday Top 12 - Statistically sound 1X hedged value picks with proven safety.",
        baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
        baseWeightIntervals: [
            { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
            { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
            { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
            { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
            { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
            { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: populateCategoryWithMasterRules(SATURDAY_TOP_12_RULES, 'mfav_draw', 'top_12_value', 'saturday')
    };

    return {
        top_12_value: top12Config,
        top_10_value: top12Config,
        best_bet: {
            name: "Best Bets (Saturday)",
            description: "Saturday Best Bets - Peak high-conviction favorites.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
                { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
                { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
                { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SATURDAY_BEST_BET_RULES, 'mfav_only', 'best_bet', 'saturday')
        },
        bankers_dlive: {
            name: "Bankers Dlive (Saturday)",
            description: "Saturday Bankers Dlive selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SATURDAY_BANKERS_DLIVE_RULES, 'mfav_only', 'bankers_dlive', 'saturday')
        },
        bankers_jackpot: {
            name: "Bankers Jackpot (Saturday)",
            description: "Saturday Bankers Jackpot selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SATURDAY_BANKERS_JACKPOT_RULES, 'mfav_only', 'bankers_jackpot', 'saturday')
        },
        upsets: {
            name: "Upsets (Saturday)",
            description: "Saturday Underdog Upsets - High value underdogs based on pattern support.",
            baseLogic: "Points based on Underdog's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 45, max: 100, points: 30, metric: 'pha_underdog' },
                { id: '2', min: 35, max: 44.99, points: 25, metric: 'pha_underdog' },
                { id: '3', min: 25, max: 34.99, points: 20, metric: 'pha_underdog' },
                { id: '4', min: 0, max: 24.99, points: 10, metric: 'pha_underdog' }
            ],
            rules: populateCategoryWithMasterRules(SATURDAY_UPSETS_RULES, 'underdog_only', 'upsets', 'saturday')
        },
        value_picks: {
            name: "Value Picks (Saturday)",
            description: "Saturday Value Picks (Mfav must win, odds 2.0-2.5).",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 50, max: 100, points: 30, metric: 'pha_market_fav' },
                { id: '2', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SATURDAY_VALUE_PICKS_RULES, 'mfav_only', 'value_picks', 'saturday')
        },
        botb_best: {
            name: "BOTB (Saturday)",
            description: "Saturday Best of the Best selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 55, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 0, max: 54.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SATURDAY_BOTB_RULES, 'mfav_only', 'botb_best', 'saturday')
        }
    };
}

/**
 * Detailed evaluation function for Saturday fixtures.
 */
export function evaluateSaturdayScoreDetailed(
    stats: MatchEvaluationStats, 
    match: Match, 
    categorySettings?: OptimizedCategorySettings
): {
    totalScore: number;
    rulesHit: { description: string; points: number }[];
    activeHedgingProtocol: string | null;
    optimizedPrediction: string;
} {
    const rulesToUse = categorySettings?.rules || [];
    const triggeredDescriptions = evaluateAllCatalogTriggers(stats, match);
    const rulesHit: { description: string; points: number }[] = [];
    let totalScore = 0;

    rulesToUse.forEach(rule => {
        if (triggeredDescriptions.has(rule.description)) {
            const pts = rule.points !== 0 ? rule.points : borrowTriggerPoints(rule.description, 'top_12_value', 'saturday');
            rulesHit.push({ description: rule.description, points: pts });
            totalScore += pts;
        }
    });

    let activeHedgingProtocol: string | null = null;
    let optimizedPrediction = match.finalPrediction || match.rawPrediction || "1";

    return {
        totalScore,
        rulesHit,
        activeHedgingProtocol,
        optimizedPrediction
    };
}
