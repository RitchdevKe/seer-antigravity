
import { Match } from '../types';
import { getActualResult } from './matchProcessing';
import { 
    calculateFlags, 
    detectMainPattern, 
    detectLegacyPatterns, 
    analyzeSubPatterns, 
    SUB_PATTERN_RULES,
    getActiveFlags
} from '../components/Patterns';

export interface AuditResult {
    fixes: FixRecommendation[];
    newPatterns: NewPatternRecommendation[];
    streamlining: StreamlineRecommendation[];
    stats: {
        totalMatches: number;
        matchesWithSubPattern: number;
        matchesWithoutSubPattern: number;
        misclassified: number;
    };
}

export interface FixRecommendation {
    type: 'rename' | 'recategorize';
    matchId?: string | number; // For recategorize
    currentId?: string; // For rename
    suggestedId: string;
    reason: string;
    details?: string;
}

export interface NewPatternRecommendation {
    group: number;
    mainPattern: string;
    suggestedId: string;
    commonRiders: string[];
    matchCount: number;
    exampleMatches: string[]; // Team names
    predictionDetails?: {
        primaryPrediction: string;
        finalPrediction: string;
        accuracy: string;
    };
}

export interface StreamlineRecommendation {
    currentId: string;
    issue: string;
    suggestion: string;
    affectedMatches: number;
    splitDetails?: {
        newId: string;
        flags: string[];
        primaryPrediction: string;
        finalPrediction: string;
        accuracy: string;
    };
}

// Helper to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const runPatternAudit = async (matches: Match[]): Promise<AuditResult> => {
    const fixes: FixRecommendation[] = [];
    const newPatterns: NewPatternRecommendation[] = [];
    const streamlining: StreamlineRecommendation[] = [];
    
    let matchesWithSubPattern = 0;
    let matchesWithoutSubPattern = 0;
    let misclassified = 0;

    // Helper to track max index for naming
    const maxIndices: Record<string, number> = {}; // Key: "G{group}{pattern}", Value: max index

    // 1. Analyze existing rules for naming violations and max indices
    SUB_PATTERN_RULES.forEach(rule => {
        const id = rule.id;
        const match = id.match(/^G([1-3])([a-zA-Z]+)(\d+)$/);
        
        if (!match) {
            let group = rule.group;
            let pattern = rule.mainPattern.toLowerCase();
            fixes.push({
                type: 'rename',
                currentId: id,
                suggestedId: `G${group}${pattern}???`, 
                reason: 'Invalid Naming Format'
            });
        } else {
            const group = match[1];
            const pattern = match[2].toLowerCase();
            const index = parseInt(match[3], 10);
            
            const key = `G${group}${pattern}`;
            if (!maxIndices[key] || index > maxIndices[key]) {
                maxIndices[key] = index;
            }
        }
    });

    // 2. Audit Matches
    const unassignedMatches: Record<string, Match[]> = {}; 

    // Process matches in chunks to simulate realistic processing time
    const chunkSize = 50;
    for (let i = 0; i < matches.length; i += chunkSize) {
        const chunk = matches.slice(i, i + chunkSize);
        await delay(50); // Artificial delay per chunk

        for (const m of chunk) {
            const flags = calculateFlags(m);
            const mainPattern = detectMainPattern(m);
            
            if (!mainPattern) continue; 

            const totalPoints = m.totalPoints || { home: 0, away: 0, draw: 0, breakdown: {} }; 
            const legacy = detectLegacyPatterns(m, totalPoints as any, m.rawPrediction || '1X');
            
            const analysis = analyzeSubPatterns(m, mainPattern, flags, legacy.patterns, 100);
            
            if (analysis) {
                matchesWithSubPattern++;
                if (m.patternAnalysis?.subPattern && m.patternAnalysis.subPattern !== analysis.subPattern) {
                    misclassified++;
                    fixes.push({
                        type: 'recategorize',
                        matchId: m.id,
                        suggestedId: analysis.subPattern,
                        reason: `Currently assigned to ${m.patternAnalysis.subPattern} but fits ${analysis.subPattern} better.`,
                        details: `${m.teams} (${m.date})`
                    });
                }
            } else {
                matchesWithoutSubPattern++;
                const key = `G${m.group || 1}-${mainPattern}`;
                if (!unassignedMatches[key]) unassignedMatches[key] = [];
                unassignedMatches[key].push(m);
            }
        }
    }

    // 3. Analyze Unassigned Matches for New Patterns
    const ACCEPTABLE_RIDERS = new Set([
        'SHGS', 'ESHGS', 'WHGS', 'EWHGS', 'SAGS', 'ESAGS', 'WAGS', 'EWAGS',
        'SHGA', 'ESHGA', 'WHGA', 'EWHGA', 'SAGA', 'ESAGA', 'WAGA', 'EWAGA'
    ]);

    Object.entries(unassignedMatches).forEach(([key, groupMatches]) => {
        if (groupMatches.length < 3) return; 

        const [groupStr, mainPattern] = key.split('-');
        const group = parseInt(groupStr.replace('G', ''));

        const riderCounts: Record<string, number> = {};
        
        groupMatches.forEach(m => {
            const flags = calculateFlags(m);
            const active = getActiveFlags(flags);
            active.forEach(f => {
                if (ACCEPTABLE_RIDERS.has(f)) {
                    riderCounts[f] = (riderCounts[f] || 0) + 1;
                }
            });
        });

        const commonRiders = Object.entries(riderCounts)
            .filter(([_, count]) => count >= groupMatches.length * 0.5)
            .map(([r]) => r);

        if (commonRiders.length > 0) {
            const patternKey = `G${group}${mainPattern.toLowerCase()}`;
            const nextIndex = (maxIndices[patternKey] || 0) + 1;
            const suggestedId = `${patternKey}${nextIndex}`;
            maxIndices[patternKey] = nextIndex;

            // Calculate Predictions for New Pattern
            let outcomes = { '1': 0, 'X': 0, '2': 0 };
            groupMatches.forEach(m => {
                const actual = getActualResult(m.result);
                if (actual !== 'pending') {
                    outcomes[actual]++;
                }
            });

            const total = groupMatches.length;
            const p1 = outcomes['1'] / total;
            const pX = outcomes['X'] / total;
            const p2 = outcomes['2'] / total;

            let primary = '1';
            if (pX > p1 && pX > p2) primary = 'X';
            if (p2 > p1 && p2 > pX) primary = '2';

            let final = '1X';
            if (p1 > 0.6) final = '1';
            else if (p2 > 0.6) final = '2';
            else if (pX > 0.6) final = 'X';
            else if ((p1 + pX) > 0.75) final = '1X';
            else if ((p2 + pX) > 0.75) final = 'X2';
            else if ((p1 + p2) > 0.75) final = '12';
            else final = '1X'; 

            const accuracy = Math.round((outcomes[primary as '1'|'X'|'2'] / total) * 100) + '%';

            newPatterns.push({
                group,
                mainPattern,
                suggestedId,
                commonRiders,
                matchCount: groupMatches.length,
                exampleMatches: groupMatches.slice(0, 3).map(m => m.teams),
                predictionDetails: {
                    primaryPrediction: primary,
                    finalPrediction: final,
                    accuracy
                }
            });
        }
    });

    // 4. Streamlining (Split Suggestions)
    const matchesBySubPattern: Record<string, Match[]> = {};
    
    for (const m of matches) {
        const flags = calculateFlags(m);
        const mainPattern = detectMainPattern(m);
        if (!mainPattern) continue;
        const totalPoints = m.totalPoints || { home: 0, away: 0, draw: 0, breakdown: {} }; 
        const legacy = detectLegacyPatterns(m, totalPoints as any, m.rawPrediction || '1X');
        const analysis = analyzeSubPatterns(m, mainPattern, flags, legacy.patterns, 100);

        if (analysis) {
            if (!matchesBySubPattern[analysis.subPattern]) matchesBySubPattern[analysis.subPattern] = [];
            matchesBySubPattern[analysis.subPattern].push(m);
        }
    }

    Object.entries(matchesBySubPattern).forEach(([subId, subMatches]) => {
        if (subMatches.length < 5) return;

        const rule = SUB_PATTERN_RULES.find(r => r.id === subId);
        if (!rule) return;

        const hiddenRiderCounts: Record<string, number> = {};
        
        subMatches.forEach(m => {
            const flags = calculateFlags(m);
            const active = getActiveFlags(flags);
            
            active.forEach(f => {
                if (!rule.riders.includes(f)) {
                    hiddenRiderCounts[f] = (hiddenRiderCounts[f] || 0) + 1;
                }
            });
        });

        Object.entries(hiddenRiderCounts).forEach(([rider, count]) => {
            const percentage = count / subMatches.length;
            if (percentage > 0.4 && percentage < 0.9) {
                // Determine Split Prediction
                const splitMatches = subMatches.filter(m => {
                     const flags = calculateFlags(m);
                     return getActiveFlags(flags).includes(rider);
                });

                let outcomes = { '1': 0, 'X': 0, '2': 0 };
                splitMatches.forEach(m => {
                    // Assuming we have result or can infer it. 
                    // If result is not available, we can't recommend prediction.
                    // We'll try to use 'result' field if it exists and is valid.
                    // For now, let's assume we are auditing past matches with results.
                    // If no result, we can't determine prediction.
                    // We'll use a placeholder logic or rely on available data.
                    const actual = getActualResult(m.result);
                    if (actual !== 'pending') {
                        outcomes[actual]++;
                    }
                });

                const total = splitMatches.length;
                const p1 = outcomes['1'] / total;
                const pX = outcomes['X'] / total;
                const p2 = outcomes['2'] / total;

                let primary = '1';
                if (pX > p1 && pX > p2) primary = 'X';
                if (p2 > p1 && p2 > pX) primary = '2';

                let final = '1X';
                if (p1 > 0.6) final = '1';
                else if (p2 > 0.6) final = '2';
                else if (pX > 0.6) final = 'X';
                else if ((p1 + pX) > 0.75) final = '1X';
                else if ((p2 + pX) > 0.75) final = 'X2';
                else if ((p1 + p2) > 0.75) final = '12';
                else final = '1X'; // Default fallback

                // Generate New ID
                const patternKey = `G${rule.group}${rule.mainPattern.toLowerCase()}`;
                const nextIndex = (maxIndices[patternKey] || 0) + 1;
                // We don't increment maxIndices here to avoid consuming it for multiple suggestions on same pattern, 
                // but for unique suggestions we should. 
                // Let's increment it to give unique IDs for each rider suggestion.
                maxIndices[patternKey] = nextIndex;
                const newId = `${patternKey}${nextIndex}`;

                const accuracy = Math.round((outcomes[primary as '1'|'X'|'2'] / total) * 100) + '%';

                streamlining.push({
                    currentId: subId,
                    issue: `Rider ${rider} present in ${Math.round(percentage * 100)}% of matches.`,
                    suggestion: `Split ${subId} -> New Pattern ${newId}. Flags: ${rule.riders.join('+')}+${rider}. Primary: ${primary}, Final: ${final}.`,
                    affectedMatches: count,
                    splitDetails: {
                        newId,
                        flags: [...rule.riders, rider],
                        primaryPrediction: primary,
                        finalPrediction: final,
                        accuracy
                    }
                });
            }
        });
    });

    fixes.forEach(fix => {
        if (fix.type === 'rename' && fix.suggestedId.includes('???')) {
            const rule = SUB_PATTERN_RULES.find(r => r.id === fix.currentId);
            if (rule) {
                const patternKey = `G${rule.group}${rule.mainPattern.toLowerCase()}`;
                const nextIndex = (maxIndices[patternKey] || 0) + 1;
                fix.suggestedId = `${patternKey}${nextIndex}`;
                maxIndices[patternKey] = nextIndex;
            }
        }
    });

    return {
        fixes,
        newPatterns,
        streamlining,
        stats: {
            totalMatches: matches.length,
            matchesWithSubPattern,
            matchesWithoutSubPattern,
            misclassified
        }
    };
};