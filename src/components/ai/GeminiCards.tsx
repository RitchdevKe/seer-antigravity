
import React from 'react';
import { 
    ThumbsUp, ThumbsDown, Clock, CheckCircle2, X, TrendingUp, Wrench, Lightbulb, ShieldCheck, DollarSign, Zap,
    ArrowRight, Cpu, Target, ListOrdered, Medal, Star
} from 'lucide-react';
import { Match } from '../../types';

export interface Pick {
    match_id?: number | string;
    team: string;
    prediction: string;
    odds: string;
    reason: string;
    confidence: string; 
    probability_confidence?: string;
    outcome?: "Correct" | "Incorrect" | "Pending";
    subPatternPrediction?: string; 
    primaryPrediction?: string;
    actualResult?: string;
    category?: string;
    stars?: number;
    tag_trace?: string;
    le?: string;
    l10?: string;
    rating?: string;
    isHprOverride?: boolean;
    opwPoints?: number;
    opwRulesHit?: { description: string; points: number }[];
    opwBaseInfo?: { points: number; mFav: string; phaPercentage: number; isUnderdogBase: boolean };
    gs?: string;
    ga?: string;
    league?: string;
    evaluatorTags?: string[];
}

export interface AuditEntry {
    match: string;
    prediction: string;
    result: string;
    status: "WON" | "LOST" | "PENDING" | "VOID";
}

export interface Insight {
  category?: string;
  title: string;
  type: 'Refinement' | 'New Pattern' | 'Coverage Fix' | 'Upset Insight' | 'System' | 'Live Pick' | 'Self Learning' | 'Risk Management' | 'Signal Weighting' | 'Strategy Shift' | 'Classification Logic' | 'Pattern Recognition' | 'Selection Priority' | 'success' | 'warning' | 'error';
  description: string;
  actionable_rule: string;
  impact: string;
}

export interface PerformanceMetric {
    category: string;
    total: number;
    correct: number;
    accuracy: string;
    stars?: number;
    notes: string;
}

export interface TacticalAudit {
    overall: PerformanceMetric;
    slip: PerformanceMetric;
    priorities: {
        [key: string]: {
            overall: PerformanceMetric;
            groups: { [key: number]: PerformanceMetric };
        }
    };
    groups: { [key: number]: PerformanceMetric };
    algo: PerformanceMetric;
    algoAlone?: PerformanceMetric;
    algoAloneByGroup?: { [key: number]: PerformanceMetric };
    algoPha: PerformanceMetric;
    algoPhaProb: PerformanceMetric;
    algoPhaExt: PerformanceMetric;
    subPatt: PerformanceMetric;
    algoSub: PerformanceMetric;
    algoSubPha?: PerformanceMetric;
}

// Helper to clean team name from potential API noise
const cleanTeamDisplay = (name: string) => {
    if (!name) return "Unknown Team";
    // Remove "Match ID: ...", "Prediction:", "Confidence:" patterns and trim
    let clean = name.split(/Match ID|Prediction:|Confidence:|Odds:/i)[0];
    // Remove trailing punctuation
    clean = clean.replace(/[.,;:-]+$/, '').trim();
    return clean;
};

export const PickCard: React.FC<{ pick: Pick; type?: 'standard' | 'confidence' | 'value'; rank?: number; algoStats?: string; algoPrediction?: string; stars?: number; marketOdds?: string; matchTags?: string[]; isJackpot?: boolean }> = ({ pick, type = 'standard', rank, algoStats, algoPrediction, stars, marketOdds, matchTags, isJackpot }) => {
    if (!pick) return null;
    let bgClass = "bg-white border-gray-200";
    let textClass = "text-gray-800";
    let badgeColor = "bg-gray-100 text-gray-800 border-gray-200";
    
    if (type === 'confidence') {
        bgClass = "bg-purple-50 border-purple-200";
        textClass = "text-purple-900";
        badgeColor = "bg-purple-100 text-purple-800 border-purple-200";
    } else if (type === 'value') {
        bgClass = "bg-green-50 border-green-200";
        textClass = "text-green-900";
        badgeColor = "bg-green-100 text-green-800 border-green-200";
    }

    // Outcome styling overrides
    let outcomeIcon = null;
    if (pick.outcome === 'Correct') {
        bgClass = "bg-green-50 border-green-300";
        outcomeIcon = <ThumbsUp size={14} className="text-green-600" />;
    } else if (pick.outcome === 'Incorrect') {
        bgClass = "bg-red-50 border-red-300";
        outcomeIcon = <ThumbsDown size={14} className="text-red-600" />;
    } else if (pick.outcome === 'Pending' && pick.actualResult) {
        bgClass = "bg-amber-50 border-amber-300 border-dashed text-gray-500 opacity-80";
        outcomeIcon = <Clock size={14} className="text-amber-500 animate-pulse" />;
    }

    const showActual = pick.actualResult;
    
    const normPred = pick.prediction?.toUpperCase() || '';
    const normAlgo = algoPrediction?.toUpperCase() || '';
    const isAgreed = normAlgo === normPred;

    const teamName = cleanTeamDisplay(pick.team);

    return (
        <div className={`p-4 rounded-xl border ${bgClass} shadow-sm flex flex-col gap-3 hover:shadow-md transition-all relative overflow-hidden`}>
            
            {/* Header: Team & Predictions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
                <div className="flex items-center gap-2">
                    {rank && <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-xs font-bold shadow-sm shrink-0">{rank}</span>}
                    <h4 className={`font-black ${textClass} text-base leading-tight flex items-center flex-wrap gap-x-2`}>
                        <span>{teamName}</span>
                        {marketOdds && typeof marketOdds === 'string' && (
                            <span className="text-sm font-medium text-gray-500 font-mono">
                                {marketOdds.split(',').map(s => s.trim()).join(',')}
                            </span>
                        )}
                        {pick.le && (
                            <span className="text-xs font-mono font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                LE: {pick.le}
                            </span>
                        )}
                    </h4>
                    {stars !== undefined && stars > 0 && (
                        <div className="flex text-amber-500 ml-1">
                            {Array.from({ length: stars }).map((_, i) => (
                                <Star key={i} size={14} fill="currentColor" />
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Predictions Section */}
                <div className="flex items-center gap-2 self-start sm:self-auto ml-auto sm:ml-0">
                    {/* Seer Prediction / Algo Prediction */}
                    {pick.primaryPrediction || algoPrediction ? (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">SEER PRED</span>
                            <div className={`flex items-center justify-center min-w-[36px] h-[28px] rounded-md border font-black text-xs shadow-sm ${(pick.primaryPrediction || algoPrediction) === pick.prediction ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : 'bg-blue-100 border-blue-200 text-blue-800'}`} title={`Seer Prediction: ${pick.primaryPrediction || algoPrediction}`}>
                                {pick.primaryPrediction || algoPrediction}
                            </div>
                        </div>
                    ) : null}

                    {(pick.primaryPrediction || algoPrediction) && <ArrowRight size={14} className="text-gray-300" />}

                    {/* Final Prediction / AI Prediction Badge */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:inline ${pick.isHprOverride ? 'text-purple-600' : 'text-gray-500'}`}>
                            {pick.isHprOverride ? 'HPR PREDICTS' : pick.outcome ? 'FINAL PRED' : 'AI PRED'}
                        </span>
                        <div className="flex items-center h-[28px] bg-white px-3 rounded-md border border-gray-300 shadow-sm text-sm font-black text-gray-800 min-w-[80px] justify-center whitespace-nowrap">
                            <span>{pick.prediction}</span>
                            <span className="text-gray-400 font-normal text-xs mx-1">@</span>
                            <span className="text-xs">{pick.odds}</span>
                            {outcomeIcon && <span className="ml-2">{outcomeIcon}</span>}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Stats Row */}
            {(algoStats || isAgreed) && (
                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    {algoStats && (
                        <div className="bg-gray-200/50 px-2 py-1 rounded text-[10px] font-mono font-bold text-gray-600 border border-gray-200/50">
                            CONF: {algoStats}
                        </div>
                    )}
                    {isAgreed && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                            <CheckCircle2 size={12} /> Algo Agreed
                        </span>
                    )}
                </div>
            )}

            {/* Actual Result Display for Audit */}
            {showActual && (
                 <div className={`flex justify-between items-center px-3 py-2 rounded border relative z-10 ${pick.outcome === 'Pending' ? 'bg-amber-100/50 border-amber-200' : 'bg-white/60 border-black/5'}`}>
                     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{pick.outcome === 'Pending' ? 'STATUS' : 'ACTUAL RESULT'}</span>
                     <span className={`text-base font-black ${pick.outcome === 'Correct' ? 'text-green-700' : pick.outcome === 'Incorrect' ? 'text-red-600' : 'text-amber-600'}`}>{pick.outcome === 'Pending' ? 'PENDING' : pick.actualResult}</span>
                 </div>
            )}

            {/* Reasoning */}
            <p className="text-xs text-gray-600 leading-relaxed border-t border-black/5 pt-2 relative z-10">
                {pick.reason}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-1 relative z-10">
                <div className="flex items-center gap-2">
                    {pick.probability_confidence && (
                        <span className="text-[10px] font-mono text-gray-400" title="Probability Confidence">P:{pick.probability_confidence}</span>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">CONFIDENCE</span>
                    <span className={`text-sm font-black ${type === 'confidence' ? 'text-purple-700' : 'text-gray-800'}`}>
                        {(() => {
                            if (!pick.confidence) return '0%';
                            const num = parseFloat(String(pick.confidence).replace('%', ''));
                            return isNaN(num) ? pick.confidence : `${Math.round(num)}%`;
                        })()}
                    </span>
                </div>
            </div>

            {/* Match Tags */}
            {((matchTags && matchTags.length > 0) || (pick.tag_trace && pick.tag_trace.length > 0)) && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-black/5 relative z-10 items-center">
                    {(matchTags || (typeof pick.tag_trace === 'string' ? pick.tag_trace.split(',').map(t => t.trim()) : []))
                        .filter(tag => {
                            const t = tag.toLowerCase().replace(/[^a-z0-9]/g, '');
                            if (t === 'volatilelastresort') return false;
                            
                            if (!isJackpot) return true;
                            
                            // Always allow value bets and value picks tags to persist on jackpot slips
                            if (t.includes('valuebets') || t.includes('valuepicks')) return true;
                            
                            return !t.includes('top10') && 
                                   !t.includes('top20') && 
                                   !t.includes('nextbest') &&
                                   !t.includes('promote') &&
                                   !t.includes('demote') &&
                                   t !== 'jackpot';
                        })
                        .map((tag, i) => {
                        let tagClass = "text-gray-500 bg-gray-100 border-gray-200";
                        if (tag.toUpperCase().includes('PROMOTE')) tagClass = "text-green-600 bg-green-50 border-green-200";
                        else if (tag.toUpperCase().includes('DEMOTE')) tagClass = "text-red-600 bg-red-50 border-red-200";
                        else if (isJackpot) tagClass = "text-amber-600 bg-amber-50 border-amber-200";
                        
                        return (
                            <span key={i} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${tagClass}`}>
                                {tag.replace(/_/g, ' ')}
                            </span>
                        );
                    })}
                    {stars !== undefined && stars > 0 && (
                        <div className="flex text-amber-500 ml-1">
                            {Array.from({ length: stars }).map((_, i) => (
                                <Star key={i} size={10} fill="currentColor" />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const PostMatchCard: React.FC<{ pick: Pick; stars?: number; matchTags?: string[]; isJackpot?: boolean; match?: Match; algoStats?: string; algoPrediction?: string }> = ({ pick, stars, matchTags, isJackpot, match, algoStats, algoPrediction }) => {
    // If we have a match object, derive the primaryPrediction using Seer if not already set on the pick
    if (match && !pick.primaryPrediction) {
        pick.primaryPrediction = match.seerPrediction;
    }
    return <PickCard pick={pick} stars={stars} matchTags={matchTags} isJackpot={isJackpot} algoStats={algoStats} algoPrediction={algoPrediction} type={isJackpot ? "confidence" : "standard"} />;
};



export const StrategyItem: React.FC<{ insight: Insight }> = ({ insight }) => {
    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Risk Management': return 'bg-red-100 text-red-700 border-red-200';
            case 'Signal Weighting': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'Strategy Shift': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'Classification Logic': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
            case 'Pattern Recognition': return 'bg-pink-100 text-pink-700 border-pink-200';
            case 'Selection Priority': return 'bg-lime-100 text-lime-700 border-lime-200';
            case 'Refinement': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'New Pattern': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'Coverage Fix': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Upset Insight': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Self Learning': return 'bg-teal-100 text-teal-700 border-teal-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
            <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex flex-col gap-1">
                    <span className={`self-start px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${getTypeColor(insight.type)}`}>
                        {insight.type || 'ADJUSTMENT'}
                    </span>
                </div>
                {insight.impact && (
                    <div className="flex items-start gap-1 text-[10px] text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded w-full justify-end leading-tight">
                        <TrendingUp size={12} className="shrink-0 mt-0.5" /> 
                        <span>{insight.impact}</span>
                    </div>
                )}
            </div>
            
            <h4 className="font-extrabold text-gray-800 text-sm mb-2 leading-snug">{insight.title}</h4>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">{insight.description}</p>
            
            <div className="mt-auto pt-3 border-t border-gray-100">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono text-[11px] text-slate-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1.5 opacity-5 group-hover:opacity-10 transition-opacity"><Wrench size={32}/></div>
                    <span className="font-black text-slate-400 block mb-1 text-[9px] uppercase tracking-widest flex items-center gap-1">
                        <Wrench size={10}/> New Protocol
                    </span>
                    {insight.actionable_rule}
                </div>
            </div>
        </div>
    );
};

export const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Refinement': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'New Pattern': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'Coverage Fix': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Upset Insight': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Self Learning': return 'bg-teal-100 text-teal-700 border-teal-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full group">
            <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${getTypeColor(insight.type)}`}>
                    {insight.type || 'Insight'}
                </span>
                <div className="p-1.5 bg-gray-50 rounded-full text-gray-400 group-hover:text-indigo-500 transition-colors">
                    <Lightbulb size={14} /> 
                </div>
            </div>
            
            <h4 className="font-bold text-gray-800 text-sm mb-2 leading-tight">{insight.title}</h4>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed flex-grow">{insight.description}</p>
            
            <div className="pt-3 border-t border-gray-100 mt-auto space-y-3">
                 <div className="flex items-start gap-1.5 text-xs text-gray-500 font-medium">
                    <TrendingUp size={14} className="text-green-500 shrink-0 mt-0.5" /> 
                    <span>Impact: <span className="text-gray-800">{insight.impact}</span></span>
                </div>
                
                {insight.actionable_rule && (
                    <div className="bg-indigo-50/50 p-2.5 rounded border border-indigo-100 font-mono text-[10px] text-indigo-800 break-words relative">
                        <span className="absolute top-1.5 right-1.5 opacity-20"><Wrench size={12}/></span>
                        <span className="font-bold text-indigo-400 block mb-0.5 text-[9px] uppercase tracking-wider">Protocol Update</span>
                        {insight.actionable_rule}
                    </div>
                )}
            </div>
        </div>
    );
};


export const TacticalAuditView = ({ audit, category }: { audit: TacticalAudit, category: string }) => {
    const getTextColor = (valStr: string) => {
        const val = parseInt(valStr);
        if (isNaN(val)) return 'text-gray-400';
        if (val >= 80) return 'text-green-400';
        if (val >= 60) return 'text-amber-400';
        return 'text-red-400';
    };

    const getStarRating = (accuracyInput: string | number) => {
        const val = typeof accuracyInput === 'string' ? parseInt(accuracyInput) : accuracyInput;
        if (isNaN(val) || val <= 0) return 0;
        if (val < 50) return 1;
        if (val < 65) return 2;
        if (val < 75) return 3;
        if (val < 85) return 4;
        return 5;
    };

    const renderStars = (accuracyStr: string) => {
        const stars = getStarRating(accuracyStr);
        if (stars === 0) return null;
        return (
            <div className="flex text-amber-400 mt-1">
                {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={10} fill="currentColor" />
                ))}
            </div>
        );
    };

    const MetricBox = ({ metric, title, subMetrics }: { metric?: PerformanceMetric, title: string, subMetrics?: { label: string, metric?: PerformanceMetric }[], key?: any }) => {
        if (!metric) return null;
        return (
            <div className="bg-[#0f172a] border border-slate-800 rounded p-3 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</span>
                <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-black ${getTextColor(metric.accuracy)}`}>{metric.accuracy}</span>
                    <span className={`text-[10px] font-bold ${getTextColor(metric.accuracy)} opacity-80`}>({metric.correct}/{metric.total})</span>
                </div>
                {renderStars(metric.accuracy)}
                
                {subMetrics && subMetrics.length > 0 && (
                    <div className="mt-1.5 w-full space-y-0.5 border-t border-slate-800/50 pt-1.5">
                        {subMetrics.map((sm, i) => sm.metric ? (
                            <div key={i} className="flex justify-between items-center text-[9px] font-bold">
                                <span className="text-slate-500">{sm.label}:</span>
                                <div className="flex items-center gap-1">
                                    <span className={getTextColor(sm.metric.accuracy)}>{sm.metric.correct}/{sm.metric.total} ({sm.metric.accuracy})</span>
                                    {getStarRating(sm.metric.accuracy) > 0 && (
                                        <div className="flex text-amber-400">
                                            {Array.from({ length: getStarRating(sm.metric.accuracy) }).map((_, j) => (
                                                <Star key={j} size={8} fill="currentColor" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : null)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-[#0a0f1e] rounded-lg p-4 mb-6 shadow-lg border border-slate-800">
            <div className="flex items-center gap-2 mb-4 border-l-4 border-green-500 pl-2">
                <CheckCircle2 className="text-green-500" size={18} />
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    TACTICAL PERFORMANCE AUDIT 
                    <span className="bg-black px-2 py-0.5 rounded text-amber-400 text-[10px]">{category.replace('_', ' ').toUpperCase()}</span>
                </h3>
            </div>

            <div className="space-y-3">
                {/* Top Row: Main Metrics & Priorities */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <MetricBox title="Overall" metric={audit.overall} />
                    <MetricBox title="Slip" metric={audit.slip} />
                    {audit.priorities && Object.entries(audit.priorities).map(([pr, data]) => (
                        <MetricBox 
                            key={pr} 
                            title={`${pr} Perf`} 
                            metric={data.overall} 
                            subMetrics={[
                                { label: 'G1', metric: data.groups?.[1] },
                                { label: 'G2', metric: data.groups?.[2] },
                                { label: 'G3', metric: data.groups?.[3] }
                            ]}
                        />
                    ))}
                </div>

                {/* Middle Row: Groups & Algo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <MetricBox title="GROUP 1" metric={audit.groups?.[1]} />
                    <MetricBox title="GROUP 2" metric={audit.groups?.[2]} />
                    <MetricBox title="GROUP 3" metric={audit.groups?.[3]} />
                    <MetricBox title="ALGO ALONE" metric={audit.algoAlone || audit.algo} />
                </div>

                {audit.algoAloneByGroup && (
                    <div className="grid grid-cols-3 gap-2">
                        <MetricBox title="ALGO G1" metric={audit.algoAloneByGroup?.[1]} />
                        <MetricBox title="ALGO G2" metric={audit.algoAloneByGroup?.[2]} />
                        <MetricBox title="ALGO G3" metric={audit.algoAloneByGroup?.[3]} />
                    </div>
                )}

                {/* Bottom Row: Combos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <MetricBox title="ALGO+PHA" metric={audit.algoPha} />
                    <MetricBox title="ALGO+PHA+PROB" metric={audit.algoPhaProb} />
                    <MetricBox title="ALGO+PHA+EXT" metric={audit.algoPhaExt} />
                    <MetricBox title="SUB PATT" metric={audit.subPatt} />
                    <MetricBox title="ALGO+SUB" metric={audit.algoSub} />
                    <MetricBox title="ALGO+SUB+PHA" metric={audit.algoSubPha} />
                </div>
            </div>
        </div>
    );
};
