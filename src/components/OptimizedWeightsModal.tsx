import React from 'react';
import { X, Calculator, ArrowRight, Target, Activity, Zap } from 'lucide-react';
import { Match } from '../types';
import { getOptimizedScoreDetailed, getMatchDayOfWeek, OptimizedScoreDetail } from '../utils/optimizedweights';

interface OptimizedWeightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: Match;
    phaStatsMap: Record<string, any>;
    categoryId?: string;
    lockedScore?: OptimizedScoreDetail;
    dayOverride?: any;
}

export default function OptimizedWeightsModal({ isOpen, onClose, match, phaStatsMap, categoryId = 'top_12_value', lockedScore, dayOverride }: OptimizedWeightsModalProps) {
    if (!isOpen) return null;

    const activeDay = dayOverride || getMatchDayOfWeek(match);
    const liveScore = phaStatsMap ? getOptimizedScoreDetailed(match, categoryId, phaStatsMap, activeDay) : null;
    const details: OptimizedScoreDetail = liveScore || lockedScore || (match as any).lockedOpwScore;
    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div 
              className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-indigo-900 text-white p-3.5 sm:p-4 flex justify-between items-center border-b border-indigo-800 shrink-0">
                    <h2 className="text-base sm:text-lg font-black flex items-center gap-2 uppercase tracking-wide">
                        <Calculator size={18} className="text-indigo-300" /> Optimized Weights Breakdown
                    </h2>
                    <button onClick={onClose} className="text-indigo-300 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full" aria-label="Close modal">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 sm:p-6 bg-gray-50 overflow-y-auto flex-1">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold text-gray-500 uppercase">Base Strategy Point</span>
                            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">{categoryId}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 mb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <Activity size={16} className="text-indigo-500"/>
                                <span className="text-sm font-semibold text-gray-700">
                                    {details.baseInfo.isUnderdogBase ? 'Underdog PHA %' : 'Market Fav PHA %'}
                                </span>
                            </div>
                            <span className="font-bold text-gray-900">{details.baseInfo.phaPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Target size={16} className="text-green-500"/>
                                <span className="text-sm font-semibold text-gray-700">Base Weight</span>
                            </div>
                            <span className="text-lg font-black text-indigo-600">+{details.baseInfo.points} pts</span>
                        </div>
                    </div>

                    <h3 className="text-xs font-black text-gray-500 uppercase mb-3 flex items-center gap-2 pl-1">
                        <Zap size={14} className="text-amber-500" /> Active Penalties & Bonuses
                    </h3>
                    
                    {details.rulesHit.length === 0 ? (
                        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400 text-sm font-medium">
                            No rules applied to this match.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {details.rulesHit.map((rule, idx) => {
                                const isPositive = rule.points > 0;

                                return (
                                    <div key={idx} className={`bg-white rounded-lg border p-3 flex justify-between items-center gap-2 ${isPositive ? 'border-green-200 shadow-sm' : 'border-rose-200 shadow-sm'}`}>
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="text-xs font-medium text-gray-800 leading-snug">{rule.description}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-sm font-black flex items-center gap-0.5 min-w-[40px] justify-end ${isPositive ? 'text-green-600' : 'text-rose-600'}`}>
                                                {isPositive ? '+' : ''}{rule.points}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-6 bg-gray-900 rounded-lg p-4 flex justify-between items-center shadow-md">
                        <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Final Optimized Weight</span>
                        <div className="flex items-center gap-2">
                            <ArrowRight size={16} className="text-gray-500" />
                            <span className="text-2xl font-black text-white">{details.totalScore}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
