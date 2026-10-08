import React, { useState, useMemo } from 'react';
import { Match } from './types';
import { DayMetadata, DAY_METADATA } from './utils/opwDayMetadata';
import { 
    populateCategoryWithMasterRules,
    borrowTriggerPoints,
    MASTER_TOP_12_RULES,
    MASTER_BEST_BET_RULES,
    MASTER_BANKERS_DLIVE_RULES,
    MASTER_BANKERS_JACKPOT_RULES,
    MASTER_VALUE_PICKS_RULES,
    MASTER_UPSETS_RULES,
    MASTER_BOTB_RULES
} from './utils/opwCatalog';
import { 
    OptimizedCategorySettings, 
    MatchEvaluationStats,
    isClose,
    evaluateAllCatalogTriggers
} from './utils/opwCommon';
import { Calendar, Trophy, Sliders, CheckCircle2 } from 'lucide-react';

export const MONDAY_METADATA: DayMetadata = DAY_METADATA.monday;

/**
 * Monday OPW Default Category Settings
 */
export function getMondayCategorySettings(): Record<string, OptimizedCategorySettings> {
    const top12Config: OptimizedCategorySettings = {
        name: "Top 12 Value (Monday)",
        description: "Monday Top 12 - Statistically sound 1X hedged value picks with proven safety.",
        baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
        baseWeightIntervals: [
            { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
            { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
            { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
            { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
            { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
            { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: populateCategoryWithMasterRules(MASTER_TOP_12_RULES, 'mfav_draw', 'top_12_value', 'monday')
    };

    return {
        top_12_value: top12Config,
        top_10_value: top12Config,
        best_bet: {
            name: "Best Bets (Monday)",
            description: "Monday Best Bets - Peak high-conviction favorites.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
                { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
                { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
                { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(MASTER_BEST_BET_RULES, 'mfav_only', 'best_bet', 'monday')
        },
        bankers_dlive: {
            name: "Bankers Dlive (Monday)",
            description: "Monday Bankers Dlive selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(MASTER_BANKERS_DLIVE_RULES, 'mfav_only', 'bankers_dlive', 'monday')
        },
        bankers_jackpot: {
            name: "Bankers Jackpot (Monday)",
            description: "Monday Bankers Jackpot selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(MASTER_BANKERS_JACKPOT_RULES, 'mfav_only', 'bankers_jackpot', 'monday')
        },
        upsets: {
            name: "Upsets (Monday)",
            description: "Monday Underdog Upsets - High value underdogs based on pattern support.",
            baseLogic: "Points based on Underdog's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 45, max: 100, points: 30, metric: 'pha_underdog' },
                { id: '2', min: 35, max: 44.99, points: 25, metric: 'pha_underdog' },
                { id: '3', min: 25, max: 34.99, points: 20, metric: 'pha_underdog' },
                { id: '4', min: 0, max: 24.99, points: 10, metric: 'pha_underdog' }
            ],
            rules: populateCategoryWithMasterRules(MASTER_UPSETS_RULES, 'underdog_only', 'upsets', 'monday')
        },
        value_picks: {
            name: "Value Picks (Monday)",
            description: "Monday Value Picks (Mfav must win, odds 2.0-2.5).",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 50, max: 100, points: 30, metric: 'pha_market_fav' },
                { id: '2', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(MASTER_VALUE_PICKS_RULES, 'mfav_only', 'value_picks', 'monday')
        },
        botb_best: {
            name: "BOTB (Monday)",
            description: "Monday Best of the Best selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 55, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 0, max: 54.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(MASTER_BOTB_RULES, 'mfav_only', 'botb_best', 'monday')
        }
    };
}

/**
 * Detailed evaluation function for Monday fixtures.
 */
export function evaluateMondayScoreDetailed(
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
            const pts = rule.points !== 0 ? rule.points : borrowTriggerPoints(rule.description, 'top_12_value', 'monday');
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
