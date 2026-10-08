
import { GoogleGenAI, Type, Schema, ThinkingLevel } from "@google/genai";
import { jsonrepair } from 'jsonrepair';
import { Match, AIAnalysisArchive } from '../../types';
import { SUB_PATTERN_RULES } from '../Patterns';
import { getActualResult, matchesPrediction, isMatchCorrectForCategory as isMatchCorrectForCategoryUtils, isMatchGoalAccurate } from '../../utils/matchProcessing';
import { predictWithSeer } from '../../utils/seerLogic';
import { getMatchEvaluatorTags, isMatchAccurate, getMatchStats, getMatchPriorityScore } from '../../utils/matchEvaluator';
import { matchAlgorithm } from './algorithm';
import { Pick, AuditEntry, Insight, PerformanceMetric, TacticalAudit } from './GeminiCards';
import * as Storage from '../../services/storage';
import { generateDailyAuditPrompt } from './LivePred';
import { generateJackpotAuditPrompt } from './JackpotPred';
import { generateSelfLearnPrompt } from './SelfLearn';

import { getMatchStars, getMatchMaxStars } from '../../utils/matchStars';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from '../../utils/seerLogic';
import { calculateAiCognitiveScore, ensureHedgedPrediction, parseMatchOdds, hasCategoryTag } from '../../utils/seerAiSlipSelection';
import { getPAAPredictionForSeer, calculateMatchProbability } from '../../utils/seerSlipSelection';
import { getOptimizedScore } from '../../utils/optimizedweights';

// --- Interfaces ---

export interface AIResponse {
  insights: Insight[];
  detailed_analysis: string; 
  category_analysis?: Record<string, string>;
  full_audit?: AuditEntry[]; 
  specialized_analysis?: {
      bankers_jackpot: Pick[];
      bankers_dlive: Pick[];
      value_bets: Pick[]; 
      value_picks: Pick[];
      banker_draws: Pick[];
      upsets: Pick[]; 
      uncategorized: Pick[];
      unallocated: Pick[];
  };
  live_predictions?: {
      best_bet: Pick[];
      top_10_value: Pick[];
      botb_best: Pick[];
      high_confidence: Pick[];
  };
  jackpot_predictions?: Pick[];
  performance_report?: {
      metrics: PerformanceMetric[];
      tactical_audit?: TacticalAudit; // Keep for backwards compatibility
      tactical_audits?: Record<string, TacticalAudit>;
      top_10_performance?: Pick[];
      botb_best_performance?: Pick[];
      high_confidence_performance?: Pick[];
      best_bet_performance?: Pick[];
      bankers_jackpot_performance?: Pick[];
      bankers_dlive_performance?: Pick[];
      value_performance?: Pick[];
      value_picks_performance?: Pick[];
      banker_draws_performance?: Pick[];
      upsets_performance?: Pick[];
      jackpot_performance?: Pick[];
      uncategorized_performance?: Pick[];
      key_failures: Pick[];
      adjustments: Insight[];
  };
}

export interface GeminiRequestPayload {
    mode: 'architect' | 'live' | 'jackpot' | 'post_match' | 'self_learn' | 'system_architecture' | 'supreme_weightings';
    matches: Match[];
    liveSessionMatches?: Match[];
    selectedJackpotId: string;
    postMatchMode: 'daily' | 'jackpot';
    postMatchCategory?: string;
    selfLearnFilter: 'all' | 'recent' | 'all_jackpots' | 'recent_jackpots' | 'priorities';
    selfLearnStrategy: 'general' | 'draw' | 'upset' | 'hedge' | 'value_bets' | 'value_picks' | 'algo' | 'pha' | 'banker' | 'jackpot_audit' | 'pattern_creator' | 'points_system' | 'ai_filters' | 'match_selector' | 'probability_review' | 'system_rebuild';
    predictionSource: 'cache' | 'archive';
    selectedBaselineArchiveId: string;
    aiHistory: AIAnalysisArchive[];
    liveData: AIResponse | null;
    jackpotData: AIResponse | null;
    fullHistory?: Match[];
    systemInstructionOverride?: string;
    promptOverride?: string;
    onProgress?: (message: string) => void;
    isIntelligenceActive?: boolean;
}

// --- Helpers ---

const calculateStars = (accuracyInput: number | string): number => {
    const accuracy = typeof accuracyInput === 'string' ? parseInt(accuracyInput) : accuracyInput;
    if (isNaN(accuracy) || accuracy <= 0) return 0;
    if (accuracy < 50) return 1;
    if (accuracy < 65) return 2;
    if (accuracy < 75) return 3;
    if (accuracy < 85) return 4;
    return 5;
};

const isMatchCorrectForCategory = (match: Match, category: string, useAiPrediction: boolean = false, priority?: string): boolean => {
    const actual = getActualResult(match.result);
    // If a match has no results, it is NOT calculated as wrong but as results pending.
    // It should be excluded from final score calculations.
    if (actual === 'pending') return false; 

    if (useAiPrediction) {
        return matchesPrediction(match.finalPrediction || '', actual);
    }
    return isMatchAccurate(match, category, priority || '');
};

// --- AI Configuration ---
const PAID_MODEL = "gemini-3.8-flash"; 
const FREE_MODEL = "gemini-3.8-flash";

export const getAIInstance = (isIntelligenceActive: boolean = false) => {
    // If running in browser, proxy requests to server to protect API keys
    if (typeof window !== 'undefined') {
        return {
            models: {
                generateContent: async (args: any) => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout safeguard
                    try {
                        const response = await fetch("/api/ai/generate-content", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(args),
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`AI proxy error: ${errorText}`);
                        }
                        const data = await response.json();
                        if (data && !data.text && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                            data.text = data.candidates[0].content.parts[0].text;
                        }
                        return data;
                    } catch (err: any) {
                        clearTimeout(timeoutId);
                        if (err.name === 'AbortError') {
                            throw new Error("AI Request timed out after 25s. Using algorithmic fallback.");
                        }
                        throw err;
                    }
                }
            }
        } as any;
    }

    const apiKey = (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY) : undefined) || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error("Gemini API Key missing.");
        throw new Error("API Key is missing. Please configure GEMINI_API_KEY in settings.");
    }

    return new GoogleGenAI({ apiKey });
};

export const getDeterministicSeed = (str: string): number => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
};

export const normalizeTeamName = (name: string) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// --- Schemas ---

const pickSchemaProperties = {
    match_id: { type: Type.STRING, description: "The unique identifier of the match AS A STRING." },
    team: { type: Type.STRING },
    prediction: { type: Type.STRING },
    odds: { type: Type.STRING, description: "The odds of the selected prediction AS A STRING." },
    reason: { type: Type.STRING },
    confidence: { type: Type.STRING, description: "NUMERIC PERCENTAGE STRING ONLY (e.g., '85%')." },
    tag_trace: { type: Type.STRING, description: "The exact tags found for this match in the input (MANDATORY for traceability)." }
};

const specialPicksSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        bankers_jackpot: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
        bankers_dlive: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
        value_bets: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
        value_picks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
        banker_draws: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
        upsets: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } }
    },
    required: ["bankers_jackpot", "bankers_dlive", "value_bets", "value_picks", "banker_draws", "upsets"]
};

const livePredictionsSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        best_bet: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
        top_10_value: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
        botb_best: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
        high_confidence: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } }
    },
    required: ["best_bet", "top_10_value", "botb_best", "high_confidence"]
};

// --- Handlers ---

const handleSystemArchitecture = async (payload: GeminiRequestPayload): Promise<AIResponse> => {
    const { isIntelligenceActive } = payload;
    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            insights: { 
                type: Type.ARRAY, 
                items: { 
                    type: Type.OBJECT, 
                    properties: { 
                        title: { type: Type.STRING }, 
                        type: { type: Type.STRING }, 
                        description: { type: Type.STRING }, 
                        actionable_rule: { type: Type.STRING }, 
                        impact: { type: Type.STRING } 
                    },
                    required: ["title", "type", "description", "actionable_rule", "impact"]
                }
            },
            detailed_analysis: { type: Type.STRING }
        },
        required: ["insights", "detailed_analysis"]
    };

    const ai = getAIInstance(isIntelligenceActive);
    const response = await ai.models.generateContent({
        model: isIntelligenceActive ? PAID_MODEL : FREE_MODEL,
        contents: payload.promptOverride || "Analyze the historical data.",
        config: {
            systemInstruction: payload.systemInstructionOverride || "You are an AI Architect.",
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.2,
            thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW
            }
        }
    });

    if (!response.text) throw new Error("Empty response from AI Architect");
    return JSON.parse(jsonrepair(response.text));
};

// --- Post-Processing Logic ---
const handleLiveOrJackpot = async (payload: GeminiRequestPayload): Promise<AIResponse> => {
    const { mode, matches, liveSessionMatches, selectedJackpotId, isIntelligenceActive, fullHistory } = payload;
    
    // Train with full history if available, otherwise fallback to matches
    const trainingSet = (fullHistory && fullHistory.length > 0) ? fullHistory : matches;
    if (!matchAlgorithm.isTrained) {
        matchAlgorithm.train(trainingSet); 
    }

    let targetMatches: Match[] = [];
    if (mode === 'jackpot') {
        targetMatches = liveSessionMatches?.filter(m => m.isJackpot && m.jackpotIds?.includes(selectedJackpotId)) || [];
    } else {
        targetMatches = liveSessionMatches?.filter(m => m.isDaily && getActualResult(m.result) === 'pending') || [];
    }

    if (targetMatches.length === 0) {
        throw new Error("No matches found for this session.");
    }

    const matchStars = await getMatchStars();
    
    const phaStatsMap: Record<string, any> = {};
    targetMatches.forEach(m => {
        const subP = m.patternAnalysis?.subPattern || 'NA';
        if (!phaStatsMap[subP]) {
            phaStatsMap[subP] = matchAlgorithm.getProbabilities(`S:${subP}`, 0);
        }
    });

    try {
        const { generateSeerSlips } = await import('../../utils/seerSlipSelection');
        // First extract baseline Seer slips for fallback and assigning m.seerPrediction
        const slips = generateSeerSlips(targetMatches, phaStatsMap, matchStars, mode === 'jackpot', false);

        // Apply Seer predictions directly to target matches so the prompt sees them
        targetMatches.forEach(m => {
                const idStr = m.id.toString();
                // Find in slips
                let foundPick: Pick | undefined;
                if (mode === 'jackpot') {
                     ['jackpot_slip', 'value_bets', 'value_picks', 'bankers_dlive', 'bankers_jackpot', 'banker_draws', 'upsets', 'unallocated', 'uncategorized'].forEach(c => {
                         const pick = slips.spec[c]?.find((p: Pick) => p.match_id?.toString() === idStr);
                         if (pick) foundPick = pick;
                     });
                } else {
                     ['best_bet', 'top_10_value', 'botb_best', 'high_confidence'].forEach(c => {
                         const pick = slips.live[c]?.find((p: Pick) => p.match_id?.toString() === idStr);
                         if (pick) foundPick = pick;
                     });
                     if (!foundPick) {
                         ['value_bets', 'value_picks', 'bankers_dlive', 'bankers_jackpot', 'banker_draws', 'upsets', 'unallocated', 'uncategorized'].forEach(c => {
                             const pick = slips.spec[c]?.find((p: Pick) => p.match_id?.toString() === idStr);
                             if (pick) foundPick = pick;
                         });
                     }
                }
                
                if (foundPick) {
                    m.seerPrediction = foundPick.prediction;
                    m.seerPrimaryPrediction = foundPick.primaryPrediction || foundPick.prediction;
                }
            });

            if (payload.onProgress) payload.onProgress('Gemini Intelligence Module offline. Running SEER core...');
            
            // --- ANALYTICAL COMPLETION ---
            if (!isIntelligenceActive) {
                // If not intelligence active, we just return the Seer slips as our base
                let aiResponse: AIResponse = {
                    insights: [],
                    detailed_analysis: `### Standard SEER Analysis
Predictions generated using deterministic pattern matching. Enable **Intelligence Mode** for AI-assisted confirmation and strategic insights.`,
                    specialized_analysis: slips.spec,
                    live_predictions: mode === 'jackpot' ? undefined : slips.live,
                    jackpot_predictions: []
                };

                if (mode === 'jackpot') {
                    const consolidated: Pick[] = [];
                    ['jackpot_slip', 'value_bets', 'value_picks', 'bankers_dlive', 'bankers_jackpot', 'banker_draws', 'upsets', 'unallocated', 'uncategorized'].forEach(c => {
                        if (slips.spec[c]) consolidated.push(...slips.spec[c]);
                    });
                    const uniquePicks = Array.from(new Map(consolidated.map(p => [(p.match_id || 0).toString() || p.team, p])).values());
                    aiResponse.jackpot_predictions = uniquePicks;
                }
                return aiResponse;
            }

            try {
                const { generateDailyPredictionPrompt } = await import('./LivePred');
                const { generateJackpotPredictionPrompt } = await import('./JackpotPred');
            
            // Filter targetMatches to ONLY include Seer picks + backups + unallocated
            const allowedMatchIds = new Set<string>();
            const extractIds = (slipCategory: Record<string, any[]>) => {
                 Object.values(slipCategory).forEach(picksArray => {
                      if (Array.isArray(picksArray)) {
                           picksArray.forEach(p => {
                               if (p?.match_id) allowedMatchIds.add(p.match_id.toString());
                           });
                      }
                 });
            };
            extractIds(slips.live);
            extractIds(slips.spec);
            
            const reducedMatches = targetMatches.filter(m => allowedMatchIds.has(m.id.toString()));

            const { systemInstruction, userPrompt } = mode === 'jackpot' 
                ? generateJackpotPredictionPrompt(reducedMatches, matchStars, slips)
                : generateDailyPredictionPrompt(reducedMatches, matchStars, slips);

            const insightSchema = { 
                type: Type.OBJECT, 
                properties: { 
                    title: { type: Type.STRING }, 
                    type: { type: Type.STRING, enum: ["Refinement", "New Pattern", "Coverage Fix", "Upset Insight", "System"] }, 
                    description: { type: Type.STRING }, 
                    actionable_rule: { type: Type.STRING }, 
                    impact: { type: Type.STRING } 
                }, 
                required: ["title", "type", "description", "actionable_rule", "impact"] 
            };

            const responseSchema: Schema = mode === 'jackpot' ? {
                type: Type.OBJECT,
                properties: {
                    jackpot_predictions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: pickSchemaProperties } },
                    specialized_analysis: specialPicksSchema,
                    insights: { type: Type.ARRAY, items: insightSchema },
                    detailed_analysis: { type: Type.STRING }
                },
                required: ["jackpot_predictions", "specialized_analysis", "insights", "detailed_analysis"]
            } : {
                type: Type.OBJECT,
                properties: {
                    live_predictions: livePredictionsSchema,
                    specialized_analysis: specialPicksSchema,
                    insights: { type: Type.ARRAY, items: insightSchema },
                    detailed_analysis: { type: Type.STRING }
                },
                required: ["live_predictions", "specialized_analysis", "insights", "detailed_analysis"]
            };

            const ai = getAIInstance(isIntelligenceActive);
            const response = await ai.models.generateContent({
                model: isIntelligenceActive ? PAID_MODEL : FREE_MODEL,
                contents: userPrompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                    temperature: 0.1,
                    thinkingConfig: {
                        thinkingLevel: ThinkingLevel.LOW
                    }
                }
            });

            if (!response.text) throw new Error("Empty response from AI engine");
            
            const parsed = JSON.parse(jsonrepair(response.text));
            // Force assign primaryPrediction from matches back to the output if missing
            const applySeerPred = (picks: Pick[]) => {
                if (!picks) return;
                picks.forEach(p => {
                    const m = targetMatches.find(tm => tm.id.toString() === p.match_id?.toString() || normalizeTeamName(tm.teams) === normalizeTeamName(p.team));
                    if (m) {
                         p.primaryPrediction = m.seerPrimaryPrediction || (p.prediction ? predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars).primary : m.seerPrediction);
                    }
                });
            };

            if (mode === 'jackpot' && parsed.jackpot_predictions) applySeerPred(parsed.jackpot_predictions);
            if (parsed.specialized_analysis) {
                Object.values(parsed.specialized_analysis).forEach((val: any) => applySeerPred(val));
            }
            if (parsed.live_predictions) {
                Object.values(parsed.live_predictions).forEach((val: any) => applySeerPred(val));
            }
            
            return parsed;
        } catch (apiError: any) {
            console.error("Gemini API Error in handleLiveOrJackpot, falling back to Local SEER:", apiError);
            
            // --- LOCAL FALLBACK LOGIC ---
            // generate slips with user preference on intelligence tagging
            const localSlips = slips;
            
            let aiResponse: AIResponse = {
            insights: [],
            detailed_analysis: "Predictions generated locally using the SEER engine.",
            specialized_analysis: localSlips.spec,
            live_predictions: mode === 'jackpot' ? undefined : localSlips.live,
            jackpot_predictions: []
        };

        if (mode === 'jackpot') {
            const consolidated: Pick[] = [];
            ['jackpot_slip', 'value_bets', 'value_picks', 'bankers_dlive', 'bankers_jackpot', 'banker_draws', 'upsets', 'unallocated', 'uncategorized'].forEach(c => {
                if (localSlips.spec[c]) consolidated.push(...localSlips.spec[c]);
            });
            
            // Deduplicate
            const uniquePicks = Array.from(new Map(consolidated.map(p => [(p.match_id || 0).toString() || p.team, p])).values());
            aiResponse.jackpot_predictions = uniquePicks;
        }

        return aiResponse;
        } // Close inner catch
    } catch (error: any) {
        console.error("Local Seer Engine Error in handleLiveOrJackpot:", error);
        throw new Error(`Seer Prediction failed: ${error.message}`);
    }
};

const handleSelfLearn = async (payload: GeminiRequestPayload): Promise<AIResponse> => {
    const { matches, fullHistory, aiHistory, selfLearnFilter, selfLearnStrategy, isIntelligenceActive } = payload;
    
    let trainingSet = (fullHistory && fullHistory.length > 0) ? fullHistory : matches;
    
    if (selfLearnStrategy === 'jackpot_audit') {
        trainingSet = trainingSet.filter(m => m.isJackpot);
    } else {
        const sorted = [...trainingSet].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (selfLearnFilter === 'recent') trainingSet = sorted.slice(0, 100); 
        else if (selfLearnFilter === 'all_jackpots') trainingSet = trainingSet.filter(m => m.isJackpot);
        else if (selfLearnFilter === 'recent_jackpots') trainingSet = sorted.filter(m => m.isJackpot).slice(0, 50); 
    }

    matchAlgorithm.train(trainingSet); 

    const { systemInstruction } = generateSelfLearnPrompt(trainingSet, fullHistory, aiHistory, selfLearnStrategy);

    const ai = getAIInstance(isIntelligenceActive);
    const response = await ai.models.generateContent({
        model: isIntelligenceActive ? PAID_MODEL : FREE_MODEL, 
        contents: "Generate Self-Learning Report based on instructions.",
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    insights: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: { title: { type: Type.STRING }, type: { type: Type.STRING, enum: ["Self Learning"] }, description: { type: Type.STRING }, actionable_rule: { type: Type.STRING }, impact: { type: Type.STRING } },
                            required: ["title", "type", "description", "actionable_rule", "impact"]
                        }
                    },
                    detailed_analysis: { type: Type.STRING }
                },
                required: ["insights", "detailed_analysis"]
            },
            temperature: 0,
            thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW
            }
        }
    });

    if (!response.text) throw new Error("Empty response from AI Self-Learn");
    return JSON.parse(jsonrepair(response.text));
};

const handleArchitect = async (payload: GeminiRequestPayload): Promise<AIResponse> => {
    const { matches, isIntelligenceActive } = payload;
    
    const unclassified = matches.filter(m => !m.patternAnalysis?.subPattern || m.patternAnalysis?.subPattern === 'None'); 
    const failures = matches.filter(m => {
        const actual = getActualResult(m.result);
        return actual !== 'pending' && m.finalPrediction !== actual;
    });
    const successes = matches.filter(m => {
        const actual = getActualResult(m.result);
        return actual !== 'pending' && m.finalPrediction === actual;
    }).slice(0, 30); 

    const combined = [...unclassified, ...failures, ...successes];
    const uniqueMap = new Map(combined.map(m => [m.id, m]));
    const curatedMatches = Array.from(uniqueMap.values());
    
    const csvData = curatedMatches.map(m => {
        const sub = m.patternAnalysis?.subPattern || 'None';
        const main = m.patternAnalysis?.mainPattern || 'NA';
        const prediction = m.finalPrediction || 'NA';
        const result = m.result || '-';
        const flags = m.patternAnalysis?.activeFlags.join('+') || 'None';
        const teams = m.teams.replace(/[,|]/g, ' '); 
        return `${m.id}|G${m.group}|Pat:${main}-${sub}|[${flags}]|Pts:${m.maxPoints}|Pred:${prediction}|Res:${result}|Odds:${m.mo}|${teams}`;
    }).join('\n');

    const ruleRegistry = SUB_PATTERN_RULES.map(r => `${r.id}: ${r.mainPattern} [${r.riders.join(',')}] -> ${r.prediction}`).join('\n');
    const prompt = `You are the **System Architect**. 
    **DATA**: ${csvData}
    **RULES**: ${ruleRegistry}`;
    
    const ai = getAIInstance(isIntelligenceActive);
    const response = await ai.models.generateContent({
        model: isIntelligenceActive ? PAID_MODEL : FREE_MODEL, 
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.OBJECT, properties: { insights: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, type: { type: Type.STRING, enum: ["Refinement", "New Pattern", "Coverage Fix", "Upset Insight", "System"] }, description: { type: Type.STRING }, actionable_rule: { type: Type.STRING }, impact: { type: Type.STRING } }, required: ["title", "type", "description", "actionable_rule", "impact"] } }, detailed_analysis: { type: Type.STRING } }, required: ["insights", "detailed_analysis"] },
            temperature: 0,
            thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW
            }
        }
    });

    if (!response.text) throw new Error("Empty response from AI Architect");
    return JSON.parse(jsonrepair(response.text));
};

const handlePostMatch = async (payload: GeminiRequestPayload): Promise<AIResponse> => {
    const { liveSessionMatches, predictionSource, selectedBaselineArchiveId, aiHistory, liveData, jackpotData, postMatchMode, postMatchCategory, matches, selectedJackpotId, isIntelligenceActive } = payload;
    
    const matchStars = await getMatchStars();

    // 1. Determine Prediction Source
    let previousAnalysis: AIResponse | null = null;
    
    if (predictionSource === 'archive' && selectedBaselineArchiveId) {
        const found = aiHistory.find(h => h.id === selectedBaselineArchiveId);
        if (found) previousAnalysis = found.data;
        else throw new Error("Selected archive not found.");
    } else {
        // Cache Mode
        const isDaily = postMatchMode !== 'jackpot';
        previousAnalysis = isDaily ? liveData : jackpotData;
        
        if (!previousAnalysis && aiHistory && aiHistory.length > 0) {
            // Robust fallback to latest session in AI History matching target mode
            const targetMode = isDaily ? 'live' : 'jackpot';
            const matchedSessions = [...aiHistory]
                .filter(h => h.mode === targetMode && h.data)
                .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
            
            if (matchedSessions.length > 0) {
                console.log(`Fallback: Found cached predictions in history for date ${matchedSessions[0].date}`);
                previousAnalysis = matchedSessions[0].data;
            }
        }

        if (!previousAnalysis) {
            console.log("No previous analysis cache or archive found. Constructing robust dynamic prediction baseline from match statistics...");
            const allKnownMatches = [...matches, ...(liveSessionMatches || [])];
            
            const makePick = (m: Match): any => ({
                match_id: m.id.toString(),
                team: m.teams || '',
                prediction: m.seerPrediction || m.finalPrediction || m.rawPrediction || '1',
                odds: m.mo || '1.50',
                reason: 'Dynamic Seer Baseline',
                confidence: m.rating || 'Medium',
                primaryPrediction: m.seerPrimaryPrediction || m.patternAnalysis?.primaryPrediction || m.seerPrediction || m.finalPrediction || m.rawPrediction || '1',
                subPatternPrediction: m.patternAnalysis?.subPatternPrediction || undefined
            });

            const best_bet: any[] = [];
            const top_10_value: any[] = [];
            const botb_best: any[] = [];
            const high_confidence: any[] = [];
            const bankers_jackpot: any[] = [];
            const value_bets: any[] = [];
            const value_picks: any[] = [];
            const banker_draws: any[] = [];
            const upsets: any[] = [];
            const jackpot_predictions: any[] = [];

            allKnownMatches.forEach(m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
                    ? m.evaluatorTags 
                    : getMatchEvaluatorTags(m, {}, postMatchMode === 'jackpot', true, matchStars);

                const pick = makePick(m);

                if (tags.some(t => t.startsWith('best_bet'))) best_bet.push(pick);
                if (tags.some(t => t.startsWith('top10'))) top_10_value.push(pick);
                if (tags.some(t => t.startsWith('botb_best') || t.startsWith('botb'))) botb_best.push(pick);
                if (tags.some(t => t.startsWith('top20') || t.startsWith('high_confidence'))) high_confidence.push(pick);
                if (tags.some(t => t.startsWith('bankers_jackpot'))) bankers_jackpot.push(pick);
                if (tags.some(t => t.startsWith('value_bets'))) value_bets.push(pick);
                if (tags.some(t => t.startsWith('value_picks'))) value_picks.push(pick);
                if (tags.some(t => t.startsWith('banker_draws'))) banker_draws.push(pick);
                if (tags.some(t => t.startsWith('upsets'))) upsets.push(pick);

                if (postMatchMode === 'jackpot' && m.isJackpot) {
                    if (!selectedJackpotId || m.jackpotIds?.includes(selectedJackpotId) || m.jackpotId === selectedJackpotId) {
                        jackpot_predictions.push(pick);
                    }
                }
            });

            previousAnalysis = {
                insights: [],
                detailed_analysis: 'Dynamic fallback predictions baseline report.',
                live_predictions: {
                    best_bet,
                    top_10_value,
                    botb_best,
                    high_confidence
                },
                specialized_analysis: {
                    bankers_jackpot,
                    bankers_dlive: [],
                    value_bets,
                    value_picks,
                    banker_draws,
                    upsets,
                    uncategorized: [],
                    unallocated: []
                },
                jackpot_predictions
            };
        }
    }

    // 2. Build Result Lookup (Truth Data)
    const allKnownMatches = [...matches, ...(liveSessionMatches || [])];
    const resultLookup = new Map<string, string>();
    const matchLookup = new Map<string, Match>();
    
    allKnownMatches.forEach(m => {
        const res = getActualResult(m.result);
        const key = normalizeTeamName(m.teams || '');
        matchLookup.set(key, m); 
        
        if (res !== 'pending') {
            resultLookup.set(key, res);
            if (m.teams && m.teams.includes(' vs ')) {
                const [h, a] = m.teams.split(' vs ');
                resultLookup.set(normalizeTeamName(h), res);
                resultLookup.set(normalizeTeamName(a), res);
                matchLookup.set(normalizeTeamName(h), m);
                matchLookup.set(normalizeTeamName(a), m);
            }
        }
    });

    // Determine correct scopeMatches based on previousAnalysis dates
    const previousMatchIds = new Set<string>();
    const addPicks = (picks?: Pick[]) => picks?.forEach(p => p.match_id && previousMatchIds.add(p.match_id.toString()));
    
    addPicks(previousAnalysis.live_predictions?.best_bet);
    addPicks(previousAnalysis.live_predictions?.top_10_value);
    addPicks(previousAnalysis.live_predictions?.botb_best);
    addPicks(previousAnalysis.live_predictions?.high_confidence);
    addPicks(previousAnalysis.specialized_analysis?.bankers_jackpot);
    addPicks(previousAnalysis.specialized_analysis?.value_bets);
    addPicks(previousAnalysis.specialized_analysis?.value_picks);
    addPicks(previousAnalysis.specialized_analysis?.banker_draws);
    addPicks(previousAnalysis.specialized_analysis?.upsets);
    addPicks(previousAnalysis.jackpot_predictions);

    const previousDates = new Set<string>();
    allKnownMatches.forEach(m => {
        if (previousMatchIds.has(m.id.toString())) {
            previousDates.add(m.date);
        }
    });

    const scopeMatches = allKnownMatches.filter(m => previousDates.has(m.date));

    // 3. Client-Side Audit Function
    const auditCategory = (picks: Pick[] | undefined, categoryName: string): { audited: Pick[], metric: PerformanceMetric | null, failures: Pick[] } => {
        if (!picks || picks.length === 0) return { audited: [], metric: null, failures: [] };
        
        const audited: Pick[] = [];
        const failures: Pick[] = [];
        let correctCount = 0;
        let pendingCount = 0;

        picks.forEach(p => {
            const pKey = normalizeTeamName(p.team || '');
            let result = resultLookup.get(pKey);
            let match = matchLookup.get(pKey);

            if (!result) {
                if (p.team && p.team.includes(' vs ')) {
                    const [h, a] = p.team.split(' vs ');
                    const hKey = normalizeTeamName(h);
                    const aKey = normalizeTeamName(a);
                    result = resultLookup.get(hKey) || resultLookup.get(aKey);
                    if (!match) match = matchLookup.get(hKey) || matchLookup.get(aKey);
                }
            }

            const finalRes = result || 'Pending';
            const isPending = finalRes === 'Pending';
            
            let outcome: "Correct" | "Incorrect" | "Pending" = "Pending";
            
            if (!isPending) {
                const isCorrect = matchesPrediction(p.prediction, finalRes);
                if (isCorrect) {
                    outcome = "Correct";
                    correctCount++;
                } else {
                    outcome = "Incorrect";
                    const stars = match ? getMatchMaxStars(match, matchStars) : 0;
                    failures.push({ ...p, actualResult: finalRes, outcome, stars });
                }
            } else {
                pendingCount++;
            }

            const subPatPred = match?.patternAnalysis?.subPatternPrediction || 'N/A';
            const primPred = p.primaryPrediction || match?.seerPrediction || match?.patternAnalysis?.primaryPrediction || 'N/A';

            audited.push({
                ...p,
                outcome,
                actualResult: finalRes,
                subPatternPrediction: subPatPred,
                primaryPrediction: primPred
            });
        });

        const totalCompleted = audited.length - pendingCount;
        const accuracyFraction = totalCompleted > 0 ? `${Math.round((correctCount/totalCompleted)*100)}%` : "0%";

        const metric: PerformanceMetric = {
            category: "Unknown", 
            total: totalCompleted,
            correct: correctCount,
            accuracy: accuracyFraction,
            notes: totalCompleted === 0 ? "No matches completed" : ""
        };

        return { audited, metric, failures };
    };

    const createMetric = (cat: string, correct: number, total: number) => {
        const accuracyNum = total > 0 ? Math.round((correct/total)*100) : 0;
        const accuracy = `${accuracyNum}%`;
        return {
            category: cat,
            total: total,
            correct: correct,
            accuracy: accuracy,
            stars: calculateStars(accuracy),
            notes: ""
        };
    };

    const calcAcc = (list: Match[], predicate: (m: Match) => boolean) => {
        const total = list.length;
        const correct = list.filter(predicate).length;
        return { correct, total };
    };

    // 4. Client-Side GLOBAL METRICS Calculation
    const phaStatsMap: Record<string, any> = {};
    allKnownMatches.forEach(m => {
        const subP = m.patternAnalysis?.subPattern || 'NA';
        if (!phaStatsMap[subP]) {
            phaStatsMap[subP] = matchAlgorithm.getProbabilities(`S:${subP}`, 0);
        }
    });

    const completedScopeBase = scopeMatches.filter(m => getActualResult(m.result) !== 'pending');
    
    if (isIntelligenceActive && postMatchCategory && postMatchCategory !== 'all') {
        let categoryMatches: Match[] = [];
        if (postMatchCategory === 'jackpot_slip') {
            categoryMatches = completedScopeBase.filter(m => m.isJackpot && m.jackpotIds?.includes(selectedJackpotId || ''));
        } else {
            categoryMatches = completedScopeBase.filter(m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, postMatchMode === 'jackpot', true, matchStars);
                return tags.some(t => t.startsWith(postMatchCategory));
            });
        }
        
        if (categoryMatches.length === 0) {
            console.log(`Skipping Gemini post-match call for empty category: ${postMatchCategory}`);
            return {
                insights: [],
                detailed_analysis: `No completed matches or failures detected for category **${postMatchCategory.replace('_', ' ').toUpperCase()}** in this scope. Out of ${scopeMatches.length} matches in the active session, none qualified or have completed. AI audit adjustment is not required.`,
                performance_report: {
                    metrics: [],
                    key_failures: [],
                    adjustments: []
                }
            };
        }
    }
    
    const categoriesToAudit = [
        'top10', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_bets', 
        'value_picks', 'banker_draws', 'upsets', 'jackpot_slip', 'uncategorized'
    ];

    const tacticalAudits: Record<string, TacticalAudit> = {};

    categoriesToAudit.forEach(cat => {
        let categoryMatches: Match[] = [];
        if (cat === 'jackpot_slip') {
            categoryMatches = completedScopeBase.filter(m => m.isJackpot && m.jackpotIds?.includes(selectedJackpotId || ''));
        } else {
            categoryMatches = completedScopeBase.filter(m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, postMatchMode === 'jackpot', true, matchStars);
                return tags.some(t => t.startsWith(cat));
            });
        }

        const overall = calcAcc(categoryMatches, m => {
            const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, postMatchMode === 'jackpot', true, matchStars);
            const catTags = tags.filter(t => t.startsWith(`${cat}:`));
            const highestPriorityTag = catTags.sort()[0];
            const highestPriority = highestPriorityTag ? highestPriorityTag.split(':')[1] : '';
            return isMatchCorrectForCategory(m, cat, false, highestPriority);
        });
        
        // Slip performance
        let categoryPicks: Pick[] = [];
        switch (cat) {
            case 'top10': categoryPicks = previousAnalysis?.live_predictions?.top_10_value || []; break;
            case 'bankers_dlive': categoryPicks = previousAnalysis?.specialized_analysis?.bankers_dlive || []; break;
            case 'botb_best': categoryPicks = previousAnalysis?.live_predictions?.botb_best || []; break;
            case 'top20': categoryPicks = previousAnalysis?.live_predictions?.high_confidence || []; break;
            case 'bankers_jackpot': categoryPicks = previousAnalysis?.specialized_analysis?.bankers_jackpot || []; break;
            case 'value_bets': categoryPicks = previousAnalysis?.specialized_analysis?.value_bets || []; break;
            case 'value_picks': categoryPicks = previousAnalysis?.specialized_analysis?.value_picks || []; break;
            case 'banker_draws': categoryPicks = previousAnalysis?.specialized_analysis?.banker_draws || []; break;
            case 'upsets': categoryPicks = previousAnalysis?.specialized_analysis?.upsets || []; break;
            case 'jackpot_slip': categoryPicks = previousAnalysis?.jackpot_predictions || []; break;
            case 'uncategorized': categoryPicks = previousAnalysis?.specialized_analysis?.uncategorized || []; break;
        }

        const slipTeams = new Set<string>();
        categoryPicks.forEach(p => {
            if (!p.team) return;
            slipTeams.add(normalizeTeamName(p.team.split(' vs ')[0] || p.team));
            slipTeams.add(normalizeTeamName(p.team.split(' vs ')[1] || ''));
            slipTeams.add(normalizeTeamName(p.team));
        });

        const slipAllMatches = scopeMatches.filter(m => {
            if (!m.teams) return false;
            const t1 = normalizeTeamName(m.teams.split(' vs ')[0] || m.teams);
            const t2 = normalizeTeamName(m.teams.split(' vs ')[1] || '');
            return slipTeams.has(t1) || slipTeams.has(t2) || slipTeams.has(normalizeTeamName(m.teams));
        });
        
        const slipCompleted = slipAllMatches.filter(m => getActualResult(m.result) !== 'pending');
        const slipHits = calcAcc(slipCompleted, m => isMatchCorrectForCategory(m, cat, true));

        const priorities: TacticalAudit['priorities'] = {};
        const uniquePRs = new Set<string>();
        
        if (cat !== 'jackpot_slip') {
            categoryMatches.forEach(m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, postMatchMode === 'jackpot', true, matchStars);
                tags.forEach(t => {
                    if (t.startsWith(cat)) {
                        const pr = t.split(':')[1];
                        if (pr && (pr.startsWith('PR') || pr === 'PROMOTE' || pr === 'DEMOTE')) uniquePRs.add(pr);
                    }
                });
            });

            Array.from(uniquePRs).sort((a, b) => {
                if (a === 'PROMOTE') return -1;
                if (b === 'PROMOTE') return 1;
                if (a === 'DEMOTE') return 1;
                if (b === 'DEMOTE') return -1;
                const numA = parseInt(a.replace('PR', ''));
                const numB = parseInt(b.replace('PR', ''));
                return numA - numB;
            }).forEach(pr => {
                const prMatches = categoryMatches.filter(m => {
                    const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, postMatchMode === 'jackpot', true, matchStars);
                    return tags.some(t => t.startsWith(cat) && t.endsWith(`:${pr}`));
                });
                if (prMatches.length > 0) {
                    const prOverall = calcAcc(prMatches, m => isMatchCorrectForCategory(m, cat, false, pr));
                    const g1Pr = calcAcc(prMatches.filter(m => m.group === 1), m => isMatchCorrectForCategory(m, cat, false, pr));
                    const g2Pr = calcAcc(prMatches.filter(m => m.group === 2), m => isMatchCorrectForCategory(m, cat, false, pr));
                    const g3Pr = calcAcc(prMatches.filter(m => m.group === 3), m => isMatchCorrectForCategory(m, cat, false, pr));

                    priorities[pr] = {
                        overall: createMetric(`${pr} Overall`, prOverall.correct, prOverall.total),
                        groups: {
                            1: createMetric(`${pr} G1`, g1Pr.correct, g1Pr.total),
                            2: createMetric(`${pr} G2`, g2Pr.correct, g2Pr.total),
                            3: createMetric(`${pr} G3`, g3Pr.correct, g3Pr.total)
                        }
                    };
                }
            });
        }

        const groups = {
            1: calcAcc(categoryMatches.filter(m => m.group === 1), m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, postMatchMode === 'jackpot', true, matchStars);
                const catTags = tags.filter(t => t.startsWith(`${cat}:`));
                const highestPriorityTag = catTags.sort()[0];
                const highestPriority = highestPriorityTag ? highestPriorityTag.split(':')[1] : '';
                return isMatchCorrectForCategory(m, cat, false, highestPriority);
            }),
            2: calcAcc(categoryMatches.filter(m => m.group === 2), m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, postMatchMode === 'jackpot', true, matchStars);
                const catTags = tags.filter(t => t.startsWith(`${cat}:`));
                const highestPriorityTag = catTags.sort()[0];
                const highestPriority = highestPriorityTag ? highestPriorityTag.split(':')[1] : '';
                return isMatchCorrectForCategory(m, cat, false, highestPriority);
            }),
            3: calcAcc(categoryMatches.filter(m => m.group === 3), m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, postMatchMode === 'jackpot', true, matchStars);
                const catTags = tags.filter(t => t.startsWith(`${cat}:`));
                const highestPriorityTag = catTags.sort()[0];
                const highestPriority = highestPriorityTag ? highestPriorityTag.split(':')[1] : '';
                return isMatchCorrectForCategory(m, cat, false, highestPriority);
            })
        };

        const algoMatches = categoryMatches.filter(m => !!m.algoReport?.prediction);
        const algoPhaAgree = categoryMatches.filter(m => m.algoReport?.prediction && m.patternAnalysis?.primaryPrediction && m.algoReport.prediction === m.patternAnalysis.primaryPrediction);
        const algoPhaProbAgree = categoryMatches.filter(m => m.algoReport?.prediction && m.patternAnalysis?.primaryPrediction && m.algoReport.prediction === m.patternAnalysis.primaryPrediction && (m.algoReport.confidence || 0) > 70);
        const algoPhaExtAgree = categoryMatches.filter(m => m.algoReport?.prediction && m.patternAnalysis?.primaryPrediction && m.pred1x2 && m.algoReport.prediction === m.patternAnalysis.primaryPrediction && m.algoReport.prediction === m.pred1x2);
        const subPattMatches = categoryMatches.filter(m => !!m.patternAnalysis?.subPatternPrediction && m.patternAnalysis.subPatternPrediction !== 'NA');
        const algoSubAgree = categoryMatches.filter(m => m.algoReport?.prediction && m.patternAnalysis?.subPatternPrediction && m.algoReport.prediction === m.patternAnalysis.subPatternPrediction);
        const algoSubPhaAgree = categoryMatches.filter(m => 
            m.algoReport?.prediction && 
            m.patternAnalysis?.subPatternPrediction && 
            m.patternAnalysis?.primaryPrediction && 
            m.algoReport.prediction === m.patternAnalysis.subPatternPrediction && 
            m.algoReport.prediction === m.patternAnalysis.primaryPrediction
        );

        tacticalAudits[cat] = {
            overall: createMetric("Overall", overall.correct, overall.total),
            slip: createMetric("Slip", slipHits.correct, slipCompleted.length),
            priorities,
            groups: {
                1: createMetric("Group 1", groups[1].correct, groups[1].total),
                2: createMetric("Group 2", groups[2].correct, groups[2].total),
                3: createMetric("Group 3", groups[3].correct, groups[3].total)
            },
            algo: createMetric("Algo", calcAcc(algoMatches, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoMatches.length),
            algoAlone: createMetric("Algo Alone", calcAcc(algoMatches, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoMatches.length),
            algoAloneByGroup: {
                1: createMetric("Algo G1", calcAcc(algoMatches.filter(m => m.group === 1), m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoMatches.filter(m => m.group === 1).length),
                2: createMetric("Algo G2", calcAcc(algoMatches.filter(m => m.group === 2), m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoMatches.filter(m => m.group === 2).length),
                3: createMetric("Algo G3", calcAcc(algoMatches.filter(m => m.group === 3), m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoMatches.filter(m => m.group === 3).length)
            },
            algoPha: createMetric("Algo+PHA Agree", calcAcc(algoPhaAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoPhaAgree.length),
            algoPhaProb: createMetric("Algo+PHA+Prob", calcAcc(algoPhaProbAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoPhaProbAgree.length),
            algoPhaExt: createMetric("Algo+PHA+Ext", calcAcc(algoPhaExtAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoPhaExtAgree.length),
            subPatt: createMetric("Sub Pattern", calcAcc(subPattMatches, m => matchesPrediction(m.patternAnalysis?.subPatternPrediction || '', getActualResult(m.result))).correct, subPattMatches.length),
            algoSub: createMetric("Algo+Sub Agree", calcAcc(algoSubAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoSubAgree.length),
            algoSubPha: createMetric("Algo+Sub+PHA", calcAcc(algoSubPhaAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result))).correct, algoSubPhaAgree.length)
        };
    });

    const globalMetrics: PerformanceMetric[] = [];

    const g1 = calcAcc(completedScopeBase.filter(m => m.group === 1), m => isMatchCorrectForCategory(m, postMatchCategory || 'all'));
    globalMetrics.push(createMetric("Group 1", g1.correct, g1.total));

    const g2 = calcAcc(completedScopeBase.filter(m => m.group === 2), m => isMatchCorrectForCategory(m, postMatchCategory || 'all'));
    globalMetrics.push(createMetric("Group 2", g2.correct, g2.total));

    const g3 = calcAcc(completedScopeBase.filter(m => m.group === 3), m => isMatchCorrectForCategory(m, postMatchCategory || 'all'));
    globalMetrics.push(createMetric("Group 3", g3.correct, g3.total));

    const ext = calcAcc(completedScopeBase.filter(m => !!m.pred1x2), m => matchesPrediction(m.pred1x2, getActualResult(m.result)));
    globalMetrics.push(createMetric("External 1x2", ext.correct, ext.total));

    const pha = calcAcc(completedScopeBase.filter(m => !!m.patternAnalysis?.subPatternPrediction && m.patternAnalysis.subPatternPrediction !== 'NA'), m => matchesPrediction(m.patternAnalysis?.subPatternPrediction || '', getActualResult(m.result)));
    globalMetrics.push(createMetric("PHA Sub Pattern", pha.correct, pha.total));

    // 5. Execution: Audit Specific Lists
    const report: any = {
        metrics: [...globalMetrics], 
        tactical_audit: postMatchCategory && postMatchCategory !== 'all' ? tacticalAudits[postMatchCategory] : undefined,
        tactical_audits: tacticalAudits,
        top_10_performance: [],
        botb_best_performance: [],
        best_bet_performance: [],
        high_confidence_performance: [],
        bankers_jackpot_performance: [],
        bankers_dlive_performance: [],
        value_performance: [],
        value_picks_performance: [],
        banker_draws_performance: [],
        upsets_performance: [],
        jackpot_performance: [],
        uncategorized_performance: [],
        key_failures: [],
        adjustments: []
    };

    let allFailures: Pick[] = [];

    const processList = (list: Pick[] | undefined, name: string, targetKey: string) => {
        const res = auditCategory(list, name);
        report[targetKey] = res.audited;
        if(res.metric) { 
            res.metric.category = name; 
            report.metrics.unshift(res.metric); 
        }
        const failuresWithCategory = res.failures.map(f => ({ ...f, category: postMatchCategory || name }));
        allFailures.push(...failuresWithCategory);
    };

    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'jackpot_slip') {
        if (postMatchMode === 'jackpot') {
            processList(previousAnalysis?.jackpot_predictions, "Jackpot Slip", "jackpot_performance");
        }
    }
    
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'best_bet') {
        if (postMatchMode === 'daily') processList(previousAnalysis?.live_predictions?.best_bet, "Best Bet", "best_bet_performance");
    }
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'top10') {
        if (postMatchMode === 'daily') processList(previousAnalysis?.live_predictions?.top_10_value, "Top 12 Value", "top_10_performance");
    }
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'botb_best') {
        if (postMatchMode === 'daily') processList(previousAnalysis?.live_predictions?.botb_best, "BOTB", "botb_best_performance");
    }
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'top20') {
        if (postMatchMode === 'daily') processList(previousAnalysis?.live_predictions?.high_confidence, "Top 20", "high_confidence_performance");
    }
    
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'bankers_jackpot') {
        processList(previousAnalysis?.specialized_analysis?.bankers_jackpot, "Bankers Jackpot", "bankers_jackpot_performance");
    }
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'bankers_dlive') {
        processList(previousAnalysis?.specialized_analysis?.bankers_dlive, "Bankers Dlive", "bankers_dlive_performance");
    }
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'value_bets') {
        processList(previousAnalysis?.specialized_analysis?.value_bets, "Value Bets", "value_performance");
    }
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'value_picks') {
        processList(previousAnalysis?.specialized_analysis?.value_picks, "Value Picks", "value_picks_performance");
    }
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'banker_draws') {
        processList(previousAnalysis?.specialized_analysis?.banker_draws, "Banker Draws", "banker_draws_performance");
    }
    if (!postMatchCategory || postMatchCategory === 'all' || postMatchCategory === 'upsets') {
        processList(previousAnalysis?.specialized_analysis?.upsets, "Upsets", "upsets_performance");
    }

    report.key_failures = allFailures;

    // Optimize: Use completedScopeBase instead of allKnownMatches to reduce token usage and focus AI on relevant data
    let allMatchesSummary = completedScopeBase.map(m => {
        const res = getActualResult(m.result);
        const isCorrect = postMatchCategory && postMatchCategory !== 'all' 
            ? isMatchCorrectForCategory(m, postMatchCategory) 
            : matchesPrediction(m.finalPrediction || '', res);
        const stars = getMatchMaxStars(m, matchStars);
        return `Match: ${m.teams} | Group: ${m.group} | Actual: ${res} | Pred1x2: ${m.pred1x2} | SubPat: ${m.patternAnalysis?.subPatternPrediction} | Stars: ${stars} | Correct: ${isCorrect ? 'YES' : 'NO'}`;
    }).join('\n');

    // --- ANALYTICAL COMPLETION ---
    if (!isIntelligenceActive) {
        // Generate Deterministic Insights
        const insights: Insight[] = [];
        
        // 1. Accuracy Insight
        const totalCompleted = completedScopeBase.length;
        if (totalCompleted > 0) {
            const overallAcc = Math.round((completedScopeBase.filter(m => matchesPrediction(m.finalPrediction || '', getActualResult(m.result))).length / totalCompleted) * 100);
            insights.push({
                category: postMatchCategory || 'overall',
                title: "Deterministic Accuracy Audit",
                type: overallAcc >= 70 ? "success" : overallAcc >= 50 ? "warning" : "error",
                description: `Statistical validation shows an overall accuracy of ${overallAcc}% across ${totalCompleted} analyzed matches in this scope.`,
                actionable_rule: "Review low-performing sub-patterns in the System Formulas to identify statistical outliers.",
                impact: "System Reliability Assessment"
            });
        }

        // 2. Failure Concentration Insight
        if (allFailures.length > 0) {
            const groupFailures = {
                1: allFailures.filter(f => matchLookup.get(normalizeTeamName(f.team || ''))?.group === 1).length,
                2: allFailures.filter(f => matchLookup.get(normalizeTeamName(f.team || ''))?.group === 2).length,
                3: allFailures.filter(f => matchLookup.get(normalizeTeamName(f.team || ''))?.group === 3).length
            };
            const maxFailsGroup = Object.entries(groupFailures).sort((a,b) => b[1] - a[1])[0];
            if (maxFailsGroup[1] > 0) {
                insights.push({
                    category: postMatchCategory || 'overall',
                    title: `Volatility Cluster: Group ${maxFailsGroup[0]}`,
                    type: "warning",
                    description: `Group ${maxFailsGroup[0]} recorded the highest failure volume (${maxFailsGroup[1]} mismatches).`,
                    actionable_rule: `Adjust slip parameters to demote Group ${maxFailsGroup[0]} matches when volatility tags are present.`,
                    impact: "Yield Optimization"
                });
            }
        }

        return {
            insights,
            detailed_analysis: `### Standard Deterministic Audit
This report provides objective statistical validation based on historical data patterns and local processing rules.

**Audit Scope:** ${postMatchCategory?.replace('_', ' ').toUpperCase() || 'ALL CATEGORIES'}
**Execution Mode:** Deterministic / Logic-Only (LLM Disabled)

#### Metric Overview
Objective performance metrics have been computed for all tracked slips. AI-driven strategic insights, root-cause analysis, and automated adjustment logic are available in **Intelligence Mode**.`,
            performance_report: report 
        };
    }

    const tacticalAudit = postMatchCategory && postMatchCategory !== 'all' ? tacticalAudits[postMatchCategory] : tacticalAudits['top10'] || undefined;
    const taggedMatchesSummary = ""; // Placeholder if needed for prompt

    const prompt = postMatchMode === 'jackpot'
        ? generateJackpotAuditPrompt(postMatchCategory || "JACKPOT SLIP", report.metrics, allFailures, allMatchesSummary, tacticalAudit, taggedMatchesSummary)
        : generateDailyAuditPrompt(postMatchCategory || "ALL CATEGORIES", report.metrics, allFailures, allMatchesSummary, tacticalAudit, taggedMatchesSummary);

    const adjustmentSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            adjustments: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        type: { type: Type.STRING },
                        description: { type: Type.STRING },
                        actionable_rule: { type: Type.STRING },
                        impact: { type: Type.STRING }
                    },
                    required: ["title", "type", "description", "actionable_rule", "impact"]
                }
            }
        },
        required: ["adjustments"]
    };

    try {
        const ai = getAIInstance(isIntelligenceActive);
        const response = await ai.models.generateContent({
            model: isIntelligenceActive ? PAID_MODEL : FREE_MODEL, 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: adjustmentSchema,
                temperature: 0,
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW
                }
            }
        });

        if (!response.text) throw new Error("Empty response from AI Audit");
        const aiOutput = JSON.parse(jsonrepair(response.text));
        
        // Force the category on the adjustments so they can be filtered in the UI
        if (Array.isArray(aiOutput.adjustments)) {
            aiOutput.adjustments = aiOutput.adjustments.map((a: any) => ({
                ...a,
                category: postMatchCategory || 'all'
            }));
        }
        
        report.adjustments = aiOutput.adjustments;
        
        return {
            insights: aiOutput.adjustments, 
            detailed_analysis: aiOutput.detailed_analysis,
            performance_report: report 
        };
    } catch (apiError: any) {
        console.error("AI Audit Module Error:", apiError);
        return {
            insights: [],
            detailed_analysis: `### Audit Result (Service Unavailable)
The AI Intelligence module encountered an error (404/Quota). Displaying deterministic performance data only.

**Error Details:** ${apiError.message || 'API Communication Failure'}`,
            performance_report: report
        };
    }
};

// --- Main Execution Function ---

const timeoutPromise = <T>(ms: number, message: string): Promise<T> => {
    return new Promise((_, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(message));
        }, ms);
        // Ensure Timer doesn't block node process exit (if run in node)
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    });
};

export const executeGeminiAnalysis = async (payload: GeminiRequestPayload): Promise<AIResponse | undefined> => {
    try {
        const analysisPromise = (async () => {
            switch (payload.mode) {
                case 'system_architecture':
                    return await handleSystemArchitecture(payload);
                case 'live':
                case 'jackpot':
                    return await handleLiveOrJackpot(payload);
                case 'self_learn':
                    return await handleSelfLearn(payload);
                case 'architect':
                    return await handleArchitect(payload);
                case 'post_match':
                    return await handlePostMatch(payload);
                default:
                    throw new Error(`Unknown mode: ${payload.mode}`);
            }
        })();

        // Enforce maximum 1 minute runtime (58 seconds budget to be safe)
        return await Promise.race([
            analysisPromise,
            timeoutPromise<AIResponse | undefined>(58000, "Analysis timeout: Run time exceeded the maximum 1-minute limit.")
        ]);
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        throw error; // Re-throw to be handled by UI
    }
};

export interface SelfLearnLesson {
  id: string;
  date: string;
  category: string;
  overallAccuracy: number;
  goalAccuracy: number;
  findings: string[];
  actionableRules: string[];
  insights?: string[];
  createdAt: string;
  scope?: string;
  totalLiveCandidatesEvaluated?: number;
  liveCandidatesAccuracy?: number;
  liveCandidatesGoalAccuracy?: number;
  status?: 'pending' | 'approved' | 'rejected';
}

export const selectSlipsWithAI = async (
  category: { id: string; label: string; maxPicks?: number },
  allMatches: Match[],
  phaStatsMap: Record<string, any>,
  matchStars: Record<string, number>,
  isJackpot: boolean,
  modelName: string = "gemini-3.8-flash"
): Promise<Pick[]> => {
  const maxP = category.maxPicks || (category.id === 'high_confidence' || category.id === 'top20' ? 20 : (['bankers_jackpot', 'banker_draws', 'value_picks', 'value_bets', 'upsets'].includes(category.id) ? 5 : (category.id === 'top_10_value' ? 12 : 10)));
  
  // Filter target matches satisfying category odds parameters
  const oddsEligibleMatches = allMatches.filter(m => {
    const { odds1, odds2, mFavOdds } = parseMatchOdds(m);
    if (category.id === 'best_bet') return mFavOdds >= 1.30 && mFavOdds <= 1.60;
    if (category.id === 'top_10_value') return mFavOdds >= 2.00 && mFavOdds <= 2.50;
    if (category.id === 'bankers_dlive') return mFavOdds >= 1.50 && mFavOdds <= 2.00;
    if (category.id === 'botb_best') return (mFavOdds >= 1.50 && mFavOdds <= 2.00) || (mFavOdds >= 2.00 && mFavOdds <= 2.50);
    if (category.id === 'high_confidence' || category.id === 'top20') return (mFavOdds >= 1.50 && mFavOdds <= 2.00) || (mFavOdds >= 2.00 && mFavOdds <= 2.50);
    if (category.id === 'bankers_jackpot') return mFavOdds >= 1.80 && mFavOdds <= 2.00;
    if (category.id === 'value_bets') return odds1 >= 2.50 && odds2 >= 2.50;
    if (category.id === 'value_picks') return mFavOdds >= 2.00 && mFavOdds <= 2.50;
    if (category.id === 'banker_draws') return odds1 >= 2.00 && odds2 >= 2.00;
    return true; // upsets & others
  });

  let eligibleMatches = oddsEligibleMatches.length >= maxP ? oddsEligibleMatches : allMatches;

  const isOpwCategory = ['value_picks', 'top_10_value', 'best_bet', 'bankers_dlive', 'botb_best', 'high_confidence', 'top20', 'bankers_jackpot', 'upsets'].includes(category.id);

  // Step 1: Pre-Score via OPW Engine or ML Probability Engine
  const scoredMatches = eligibleMatches.map(m => {
    const pScore = isOpwCategory
      ? getOptimizedScore(m, category.id, phaStatsMap)
      : calculateMatchProbability(m, phaStatsMap);
    return { match: m, probabilityScore: pScore };
  });

  // Step 2: Sort descending by Score
  scoredMatches.sort((a, b) => b.probabilityScore - a.probabilityScore);

  // Step 3: Take Top 40 candidates for Gemini to evaluate (or at least maxP * 3 to ensure enough options)
  const poolSize = Math.max(40, maxP * 3);
  const targetMatches = scoredMatches.slice(0, poolSize);

  // Format the match data to include ALL 4 PREDICTION ENGINES + ML Score
  const matchData = targetMatches.map(({ match: m, probabilityScore }) => {
    const mAny = m as any;
    const seerDetailed = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars, category.id);
    const paaObj = getPAAPredictionForSeer(m, phaStatsMap);
    const tags = getMatchEvaluatorTags(m, phaStatsMap, isJackpot, true, matchStars);
    const probs = mAny.algoReport?.probabilities || mAny.calculatedProbabilities || mAny.probabilities || {};
    
    const moParts = (m.mo || "").split(",").map((s: string) => parseFloat(s.trim()));
    const odds1 = moParts[0] || 2.0;
    const odds2 = moParts[2] || 2.5;
    const marketFav = odds1 <= odds2 ? "Home (1)" : "Away (2)";

    return {
      match_id: m.id.toString(),
      teams: m.teams,
      league: m.le || "Unknown",
      odds_1x2: m.mo || "1.0",
      market_favorite: marketFav,
      algo_prediction: mAny.finalPrediction || mAny.calculatedPrediction || seerDetailed.final || "1X",
      sub_pattern_prediction: mAny.patternAnalysis?.subPatternPrediction || "None",
      paa_prediction: paaObj.paaFinal || mAny.paaPrediction || "None",
      seer_default_prediction: seerDetailed.final || "1X",
      algo_probabilities: probs,
      ml_probability_score: Number(probabilityScore.toFixed(1)),
      opw_points: isOpwCategory ? Number(probabilityScore.toFixed(1)) : undefined,
      evaluator_tags: tags.filter(t => !t.startsWith("BANNED:")).join(", "),
      match_rating_stars: matchStars[m.id] || 0
    };
  });

  // Fetch past lessons/insights to guide the selection
  let pastInsightsText = "";
  try {
    const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
    const lessons = JSON.parse(existingStr) as SelfLearnLesson[];
    const relevantLessons = lessons.filter(l => (l.category === category.id || l.category === "all") && l.status === 'approved');
    
    if (relevantLessons.length > 0) {
      const allFindings = relevantLessons.flatMap(l => l.findings || []);
      const allRules = relevantLessons.flatMap(l => l.actionableRules || []);
      const allInsights = relevantLessons.flatMap(l => l.insights || []);
      
      if (allFindings.length > 0 || allRules.length > 0 || allInsights.length > 0) {
        pastInsightsText = `
### PAST SELF-LEARNING INSIGHTS & CORRECTION RULES FOR "${category.label}":
You must strictly respect and apply these past self-learning insights and rules to prioritize optimal matches, avoid low-accuracy traps, and appropriately hedge potential failures (while still selecting ${maxP} matches if candidate matches exist):

${allInsights.length > 0 ? `**Usable Insights:**\n${allInsights.map(ins => `- ${ins}`).join('\n')}\n` : ''}
${allFindings.length > 0 ? `**Findings/Observations:**\n${allFindings.map(f => `- ${f}`).join('\n')}\n` : ''}
${allRules.length > 0 ? `**Actionable Correction Rules:**\n${allRules.map(r => `- ${r}`).join('\n')}\n` : ''}
`;
      }
    }
  } catch (e) {
    console.warn("Failed to load past self-learning lessons for slip selection prompt", e);
  }

  const prompt = `You are the SEER AI Slip Master, an independent and elite sports match selector.
Your objective is to select the ABSOLUTE HIGHEST-ACCURACY matches for the category: "${category.label}" (Target EXACTLY ${maxP} picks if available).

You are provided with full multi-model analytical predictions for every candidate match in this category:
1. algo_prediction (Algorithm model prediction)
2. sub_pattern_prediction (Sub-pattern model prediction)
3. paa_prediction (PAA statistical model prediction)
4. seer_default_prediction (SEER default model prediction)
5. market_favorite (Home vs Away favorite based on 1X2 market odds)
6. algo_probabilities (Win/Draw/Loss calculated probabilities)
7. ml_probability_score (0-100 graded safety score - HIGHER is better/safer)
8. evaluator_tags & match_rating_stars

Here is the candidate pool of matches:
${JSON.stringify(matchData, null, 2)}

${pastInsightsText}

CRITERIA FOR YOUR AI SELECTION ("${category.label}"):
${isOpwCategory ? `- CRITICAL OPW POINTS MANDATE: For "${category.label}", you must strictly prioritize candidate matches with the highest 'opw_points'. Rank and select the top matches with the highest OPW points.` : ""}
- Analyze multi-model consensus across all 4 prediction engines (algo, sub_pattern, paa, seer_default).
- Prioritize matches with the highest 'ml_probability_score'. This score mathematically determines the safest matches.
- Prioritize matches where predictions align with the Market Favorite or Draw (the 1X / X2 target pool).
- DO NOT pick volatile underdogs that contradict market favorite and model consensus.
- CRITICAL PREDICTION MANDATE: ALL PREDICTIONS MUST BE HEDGED DOUBLE-CHANCE OPTIONS (1X or X2). YOU ARE STRICTLY FORBIDDEN FROM OUTPUTTING SINGLE OUTCOMES ('1', 'X', '2') OR '12'. EVERY PICK MUST BE HEDGED AS 1X OR X2 TO COVER BOTH FAVORITE WIN AND DRAW.
- CRITICAL REASONING MANDATE: AI reasoning MUST cite the ml_probability_score and multi-model agreement across Algo, Sub-Pattern, PAA, and SEER default models.

${category.id === "banker_draws" ? "- CRITICAL REQUIREMENT: For Banker Draws, YOU MUST HEDGE the prediction as 1X or X2 based on market favorite direction. Do NOT predict X natively or 12." : ""}

Your output must strictly conform to the following JSON schema:
{
  "selections": [
    {
      "match_id": "The ID of the selected match as a string",
      "team": "The teams name",
      "prediction": "The final hedged prediction (MUST be 1X or X2)",
      "odds": "The odds of the selected prediction (or 1X2 odds if unknown)",
      "reason": "A concise analytical explanation citing model predictions consensus and statistics",
      "confidence": "An estimated confidence percentage (e.g., '85%')"
    }
  ]
};`;

  const ai = getAIInstance(false);
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      selections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            match_id: { type: Type.STRING },
            team: { type: Type.STRING },
            prediction: { type: Type.STRING },
            odds: { type: Type.STRING },
            reason: { type: Type.STRING },
            confidence: { type: Type.STRING }
          },
          required: ["match_id", "team", "prediction", "odds", "reason", "confidence"]
        }
      }
    },
    required: ["selections"]
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
      systemInstruction: "You are an elite, independent sports betting AI analyst. You construct unique predictive models to find value beyond standard algorithms. All your predictions MUST be hedged double chance (1X, X2, or 12) and backed by statistical data analysis.",
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.7,
    }
  });

  if (!response.text) {
    throw new Error("Empty response from Gemini Slip Selection");
  }

  const parsed = JSON.parse(jsonrepair(response.text));
  const rawSelections: Pick[] = parsed.selections || [];

  // Post-process all selections: enforce double-chance hedged predictions (1X, X2, 12) and data-driven reasoning
  const selections: Pick[] = rawSelections.map((s: any) => {
    const matchingMatchWrap = targetMatches.find(m => m.match.id.toString() === s.match_id?.toString());
    const matchingMatch = matchingMatchWrap ? matchingMatchWrap.match : undefined;
    const hedgedPred = ensureHedgedPrediction(s.prediction, matchingMatch, phaStatsMap);
    
    // Clean up reason if it relies purely on odds or lacks statistical data context
    let reason = s.reason || "";
    const lowerReason = reason.toLowerCase();
    if (!reason || (lowerReason.includes("odds") && !lowerReason.includes("goal") && !lowerReason.includes("paa") && !lowerReason.includes("stat") && !lowerReason.includes("prob") && !lowerReason.includes("model"))) {
      if (matchingMatch) {
        const cog = calculateAiCognitiveScore(matchingMatch, category.id, phaStatsMap, matchStars, isJackpot);
        reason = cog.reason;
      }
    }

    return {
      match_id: s.match_id?.toString() || "",
      team: s.team || (matchingMatch?.teams || ""),
      prediction: hedgedPred,
      odds: s.odds || (matchingMatch?.mo || "1.0").split(",")[0].trim(),
      reason: reason || "Multi-indicator statistical consensus",
      confidence: s.confidence || "80%",
      category: category.id
    };
  });

  // If AI returned fewer picks than maxP, backfill from candidate matches to reach target match count
  const targetCount = Math.min(maxP, targetMatches.length);
  if (selections.length < targetCount) {
    const selectedIds = new Set(selections.map((s: any) => s.match_id?.toString()));
    const remainingMatches = targetMatches.filter(m => !selectedIds.has(m.match.id.toString()));
    
    for (const wrap of remainingMatches) {
      if (selections.length >= targetCount) break;
      const m = wrap.match;
      const cog = calculateAiCognitiveScore(m, category.id, phaStatsMap, matchStars, isJackpot);
      selections.push({
        match_id: m.id.toString(),
        team: m.teams,
        prediction: cog.prediction,
        odds: (m.mo || "1.0").split(",")[0].trim(),
        reason: cog.reason,
        confidence: (cog as any).confidence || "80%",
        category: category.id
      });
    }
  }

  return selections;
};

export const runSelfLearnReflectiveCycle = async (
  date: string,
  categories: { id: string; label: string }[],
  lockedSlips: Record<string, any>,
  allMatches: Match[],
  phaStatsMap: Record<string, any>,
  matchStars: Record<string, number> = {},
  liveCategoryMatches?: Record<string, { match: any; prediction: string }[]>,
  modelName: string = "gemini-3.8-flash"
): Promise<SelfLearnLesson> => {
  const evaluatedSlipsPerformance: any[] = [];
  let totalEvaluated = 0;
  let totalCorrect = 0;
  let totalGoalCorrect = 0;

  categories.forEach(cat => {
    const slip = lockedSlips[cat.id];
    if (!slip || !slip.picks || slip.picks.length === 0) return;

    const slipPicks = slip.picks;
    const picksPerformance: any[] = [];
    let slipEvaluated = 0;
    let slipCorrect = 0;
    let slipGoalCorrect = 0;

    slipPicks.forEach((p: any) => {
      const match = allMatches.find(m => m.id.toString() === p.match_id?.toString());
      if (match) {
        const actual = getActualResult(match.result);
        if (actual && actual !== "pending") {
          slipEvaluated++;
          totalEvaluated++;
          const isCorrect = isMatchCorrectForCategoryUtils(match, p.prediction, actual, cat.id);
          const isGoalCorrect = isMatchGoalAccurate(match, p.prediction, actual, cat.id, phaStatsMap);
          
          if (isCorrect) {
            slipCorrect++;
            totalCorrect++;
          }
          if (isGoalCorrect) {
            slipGoalCorrect++;
            totalGoalCorrect++;
          }

          picksPerformance.push({
            teams: match.teams,
            prediction: p.prediction,
            actual_result: match.result,
            actual_outcome: actual,
            overall_correct: isCorrect,
            goal_correct: isGoalCorrect,
            reason: p.reason
          });
        }
      }
    });

    if (slipEvaluated > 0) {
      evaluatedSlipsPerformance.push({
        category_id: cat.id,
        category_label: cat.label,
        overall_accuracy: Math.round((slipCorrect / slipEvaluated) * 100),
        goal_accuracy: Math.round((slipGoalCorrect / slipEvaluated) * 100),
        picks: picksPerformance
      });
    }
  });

  // Compile performance of all live analysis candidates (every category-tagged match on live analysis)
  const evaluatedLiveCandidatesPerformance: any[] = [];
  let totalLiveEvaluated = 0;
  let totalLiveCorrect = 0;
  let totalLiveGoalCorrect = 0;

  if (liveCategoryMatches) {
    categories.forEach(cat => {
      const candidates = liveCategoryMatches[cat.id];
      if (!candidates || candidates.length === 0) return;

      const candidatesPerformance: any[] = [];
      let catLiveEvaluated = 0;
      let catLiveCorrect = 0;
      let catLiveGoalCorrect = 0;

      candidates.forEach((c: any) => {
        const match = c.match;
        const pred = c.prediction;
        const actual = getActualResult(match.result);
        if (actual && actual !== "pending") {
          catLiveEvaluated++;
          totalLiveEvaluated++;
          const isCorrect = isMatchCorrectForCategoryUtils(match, pred, actual, cat.id);
          const isGoalCorrect = isMatchGoalAccurate(match, pred, actual, cat.id, phaStatsMap);

          if (isCorrect) {
            catLiveCorrect++;
            totalLiveCorrect++;
          }
          if (isGoalCorrect) {
            catLiveGoalCorrect++;
            totalLiveGoalCorrect++;
          }

          candidatesPerformance.push({
            teams: match.teams,
            prediction: pred,
            actual_result: match.result,
            actual_outcome: actual,
            overall_correct: isCorrect,
            goal_correct: isGoalCorrect,
            odds: match.mo || "1.0",
            league: match.le || "Unknown",
            paa_prediction: match.paaPrediction || match.paaPrimaryPrediction || "None",
            sub_pattern: match.patternAnalysis?.subPattern || "None",
            match_stars: matchStars[match.id] || 0
          });
        }
      });

      if (catLiveEvaluated > 0) {
        evaluatedLiveCandidatesPerformance.push({
          category_id: cat.id,
          category_label: cat.label,
          live_candidates_accuracy: Math.round((catLiveCorrect / catLiveEvaluated) * 100),
          live_candidates_goal_accuracy: Math.round((catLiveGoalCorrect / catLiveEvaluated) * 100),
          candidates_count: catLiveEvaluated,
          candidates: candidatesPerformance
        });
      }
    });
  }

  const overallAccuracy = totalEvaluated > 0 ? Math.round((totalCorrect / totalEvaluated) * 100) : (totalLiveEvaluated > 0 ? Math.round((totalLiveCorrect / totalLiveEvaluated) * 100) : 0);
  const goalAccuracy = totalEvaluated > 0 ? Math.round((totalGoalCorrect / totalEvaluated) * 100) : (totalLiveEvaluated > 0 ? Math.round((totalLiveGoalCorrect / totalLiveEvaluated) * 100) : 0);

  const liveCandidatesAccuracy = totalLiveEvaluated > 0 ? Math.round((totalLiveCorrect / totalLiveEvaluated) * 100) : 0;
  const liveCandidatesGoalAccuracy = totalLiveEvaluated > 0 ? Math.round((totalLiveGoalCorrect / totalLiveEvaluated) * 100) : 0;

  if (evaluatedSlipsPerformance.length === 0 && evaluatedLiveCandidatesPerformance.length === 0) {
    throw new Error("No finalized matches with completed results found in locked AI slips or live analysis candidates for self-learning. Please sync results first or select a date with completed matches!");
  }

  const primaryCategory = categories.length === 1 ? categories[0] : null;

  const prompt = `You are the Lead AI Algorithm Engineer. You are performing a Post-Match Self-Learning Evaluation on the SEER AI system for date: ${date}.

Our primary objective is to audit all outcomes and formulate precise, logical correction rules to drive selection accuracy for all category-tagged matches to 100%.

Evaluating the full pool of category-tagged matches on live analysis allows us to discover false-positive traps and refine our filters.

${primaryCategory ? `CRITICAL CONTEXT: We are specifically analyzing and learning for the Category: "${primaryCategory.label}" (${primaryCategory.id}). Your findings, insights, and actionable rules MUST be tailored specifically to help the AI select better matches next time for "${primaryCategory.label}" specifically.` : ""}

--- DATASET 1: Locked Slips Performance ---
${JSON.stringify(evaluatedSlipsPerformance, null, 2)}

--- DATASET 2: All Live Analysis Category-Tagged Candidates Performance ---
${JSON.stringify(evaluatedLiveCandidatesPerformance, null, 2)}

Prime Directives for your Analysis:
1. Auditing Failures: If the selection/prediction accuracy of any category is below 100%, perform a rigorous forensic audit of every failed prediction (where overall_correct or goal_correct is false).
2. Deep Feature Search: For every failure, analyze its features: PAA prediction, SEER predictions, team statistics (TS differential, volatility, odds), stars ratings, and sub-patterns. Identify why the algorithm miscalculated.
3. Formulate Actionable Corrections: DO NOT recommend banning or restricting matches from selections. Instead, design strict, logical rules to PRIORITIZE matches that meet category Goal accuracy requirements and DEPRIORITIZE those with bad data. Furthermore, provide rules on how to properly HEDGE risky matches. For example: "RULE: Prioritize matches where Home Win index > 45%. If Draw probability is > 30%, hedge the selection with a 1X or X2."
4. Generate Usable Strategic Insights: Formulate general strategic insights (e.g. "We noticed that in bankers_dlive, favorites playing away in low-scoring leagues fail 40% of the time, so they should be deprioritized or hedged appropriately").
5. Ensure your lessons, insights, and actionable rules are highly specific and descriptive so we can save them and feed them directly into the next AI slip selection to prioritize the right matches and hedge properly to push accuracy towards 100%.

Your output must strictly conform to the following JSON schema:
{
  "findings": [
    "A detailed finding of why certain selections succeeded or failed (e.g., 'In Top 10 Value, 3 candidate matches failed because we selected the favorite but their Home Win index was below 40% with high underdog scoring probability')"
  ],
  "actionable_rules": [
    "An actionable rule to prioritize or hedge matches (e.g., 'RULE: For Top 10 Value, prioritize matches with Home Win index > 45%, and hedge matches with Draw probability > 30% to improve accuracy without banning matches')"
  ],
  "insights": [
    "A usable strategic insight to help select better matches next time (e.g., 'Favorites playing away in high-volatility matchups tend to draw, so selecting Draw No Bet (DNB) or double-chance is highly recommended over straight win predictions.')"
  ]
}`;

  const ai = getAIInstance(false);
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      findings: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      actionable_rules: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      insights: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
    required: ["findings", "actionable_rules", "insights"]
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.HIGH,
      },
      systemInstruction: "You are an elite machine learning algorithms auditor. You evaluate prediction performance and design perfect correction rules and strategic insights to achieve 100% selection accuracy.",
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.1,
    }
  });

  if (!response.text) {
    throw new Error("Empty response from Self-Learn AI Agent");
  }

  const parsed = JSON.parse(jsonrepair(response.text));

  const lesson: SelfLearnLesson = {
    id: `lesson_${Date.now()}`,
    date: date,
    category: primaryCategory ? primaryCategory.id : "all",
    overallAccuracy,
    goalAccuracy,
    findings: parsed.findings || [],
    actionableRules: parsed.actionable_rules || [],
    insights: parsed.insights || [],
    createdAt: new Date().toISOString(),
    status: 'pending',
    scope: liveCategoryMatches ? "hybrid" : "locked",
    totalLiveCandidatesEvaluated: totalLiveEvaluated,
    liveCandidatesAccuracy,
    liveCandidatesGoalAccuracy
  };

  // Save lesson in local storage
  try {
    const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
    const existing = JSON.parse(existingStr);
    existing.unshift(lesson);
    localStorage.setItem("seer_ai_self_learn_lessons", JSON.stringify(existing));
  } catch (e) {
    console.error("Failed to save lesson in local storage", e);
  }

  return lesson;
};