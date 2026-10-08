import {
    SUNDAY_TOP_12_RULES,
    SUNDAY_BEST_BET_RULES,
    SUNDAY_BANKERS_DLIVE_RULES,
    SUNDAY_BANKERS_JACKPOT_RULES,
    SUNDAY_VALUE_PICKS_RULES,
    SUNDAY_UPSETS_RULES,
    SUNDAY_BOTB_RULES
} from './utils/opwSundayRules';
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

// Re-export dedicated Sunday rules for day isolation
export {
    SUNDAY_TOP_12_RULES,
    SUNDAY_BEST_BET_RULES,
    SUNDAY_BANKERS_DLIVE_RULES,
    SUNDAY_BANKERS_JACKPOT_RULES,
    SUNDAY_VALUE_PICKS_RULES,
    SUNDAY_UPSETS_RULES,
    SUNDAY_BOTB_RULES
};

export const SUNDAY_METADATA: DayMetadata = DAY_METADATA.sunday;

/**
 * Sunday OPW Default Category Settings
 */
export function getSundayCategorySettings(): Record<string, OptimizedCategorySettings> {
    const top12Config: OptimizedCategorySettings = {
        name: "Top 12 Value (Sunday)",
        description: "Sunday Top 12 - Statistically sound 1X hedged value picks with proven safety.",
        baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
        baseWeightIntervals: [
            { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
            { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
            { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
            { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
            { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
            { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: populateCategoryWithMasterRules(SUNDAY_TOP_12_RULES, 'mfav_draw', 'top_12_value', 'sunday')
    };

    return {
        top_12_value: top12Config,
        top_10_value: top12Config,
        best_bet: {
            name: "Best Bets (Sunday)",
            description: "Sunday Best Bets - Peak high-conviction favorites.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
                { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
                { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
                { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SUNDAY_BEST_BET_RULES, 'mfav_only', 'best_bet', 'sunday')
        },
        bankers_dlive: {
            name: "Bankers Dlive (Sunday)",
            description: "Sunday Bankers Dlive selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SUNDAY_BANKERS_DLIVE_RULES, 'mfav_only', 'bankers_dlive', 'sunday')
        },
        bankers_jackpot: {
            name: "Bankers Jackpot (Sunday)",
            description: "Sunday Bankers Jackpot selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SUNDAY_BANKERS_JACKPOT_RULES, 'mfav_only', 'bankers_jackpot', 'sunday')
        },
        upsets: {
            name: "Upsets (Sunday)",
            description: "Sunday Underdog Upsets - High value underdogs based on pattern support.",
            baseLogic: "Points based on Underdog's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 45, max: 100, points: 30, metric: 'pha_underdog' },
                { id: '2', min: 35, max: 44.99, points: 25, metric: 'pha_underdog' },
                { id: '3', min: 25, max: 34.99, points: 20, metric: 'pha_underdog' },
                { id: '4', min: 0, max: 24.99, points: 10, metric: 'pha_underdog' }
            ],
            rules: populateCategoryWithMasterRules(SUNDAY_UPSETS_RULES, 'underdog_only', 'upsets', 'sunday')
        },
        value_picks: {
            name: "Value Picks (Sunday)",
            description: "Sunday Value Picks (Mfav must win, odds 2.0-2.5).",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 50, max: 100, points: 30, metric: 'pha_market_fav' },
                { id: '2', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SUNDAY_VALUE_PICKS_RULES, 'mfav_only', 'value_picks', 'sunday')
        },
        botb_best: {
            name: "BOTB (Sunday)",
            description: "Sunday Best of the Best selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 55, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 0, max: 54.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(SUNDAY_BOTB_RULES, 'mfav_only', 'botb_best', 'sunday')
        }
    };
}

/**
 * Detailed evaluation function for Sunday fixtures.
 */
export function evaluateSundayScoreDetailed(
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
            const pts = rule.points !== 0 ? rule.points : borrowTriggerPoints(rule.description, 'top_12_value', 'sunday');
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
