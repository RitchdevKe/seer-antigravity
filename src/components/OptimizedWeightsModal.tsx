import React, { useState, useEffect } from 'react';
import { X, Calculator, ArrowRight, Target, Activity, Zap, Shield, AlertTriangle } from 'lucide-react';
import { Match } from '../types';
import { getOptimizedScoreDetailed, OptimizedScoreDetail } from '../utils/optimizedweights';
import {
  isProtectedPenalty,
  getProtectedFloor,
  saveProtectedPenaltyGuard,
  removeProtectedPenaltyGuard,
  isOutrightUpset
} from '../utils/opwPenaltyProtection';

interface OptimizedWeightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: Match;
    phaStatsMap: Record<string, any>;
    categoryId?: string;
    lockedScore?: OptimizedScoreDetail;
    dayOverride?: any;
}

export default function OptimizedWeightsModal({ isOpen, onClose, match, phaStatsMap, categoryId = 'top_10_value', lockedScore, dayOverride }: OptimizedWeightsModalProps) {
    const [, setGuardVersion] = useState(0);

    useEffect(() => {
        const handler = () => setGuardVersion(v => v + 1);
        window.addEventListener('opwProtectedGuardsUpdated', handler);
        return () => window.removeEventListener('opwProtectedGuardsUpdated', handler);
    }, []);

    if (!isOpen) return null;

    const details: OptimizedScoreDetail = lockedScore || (match as any).lockedOpwScore || getOptimizedScoreDetailed(match, categoryId, phaStatsMap, dayOverride);
    const isUpsetMatch = isOutrightUpset(match as any);

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-indigo-900 text-white p-4 flex justify-between items-center border-b border-indigo-800">
                    <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-wide">
                        <Calculator size={20} className="text-indigo-300" /> Optimized Weights Breakdown
                    </h2>
                    <button onClick={onClose} className="text-indigo-300 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 bg-gray-50 max-h-[80vh] overflow-y-auto">
                    {/* Upset Casualty Warning Banner */}
                    {isUpsetMatch && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
                            <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-950">
                                <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                                <span>Slip Upset Casualty (FT: {match.result || 'Upset'})</span>
                            </div>
                            <p className="text-[11px] text-rose-800 leading-relaxed">
                                This match was selected to the slip but failed due to an upset. Protect any active warning penalties below to lock their floor and prevent the continuous optimizer from ever relaxing them.
                            </p>
                        </div>
                    )}

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
                                const isNegative = rule.points < 0;
                                const isGuarded = isProtectedPenalty(rule.description);
                                const floor = getProtectedFloor(rule.description);

                                return (
                                    <div key={idx} className={`bg-white rounded-lg border p-3 flex justify-between items-center gap-2 ${isPositive ? 'border-green-200 shadow-sm' : 'border-rose-200 shadow-sm'}`}>
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="text-xs font-medium text-gray-800 leading-snug">{rule.description}</span>
                                            {isNegative && isGuarded && (
                                                <span className="text-[10px] text-amber-700 font-mono font-semibold flex items-center gap-1 mt-0.5">
                                                    <Shield size={10} className="text-amber-600" /> Locked Floor: ≤ {floor} pts
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {isNegative && (
                                                isGuarded ? (
                                                    <button
                                                        onClick={() => removeProtectedPenaltyGuard(rule.description)}
                                                        className="text-[10px] bg-amber-50 hover:bg-rose-50 text-amber-800 hover:text-rose-700 border border-amber-300 hover:border-rose-300 px-2 py-0.5 rounded font-bold transition flex items-center gap-1"
                                                        title="Click to remove protection guard"
                                                    >
                                                        <Shield size={11} className="text-amber-600" /> Protected
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => saveProtectedPenaltyGuard({
                                                            trigger: rule.description,
                                                            floorPoints: rule.points,
                                                            sourceMatch: match.teams,
                                                            reason: `Protected from match breakdown (${match.teams})`,
                                                            markedAt: new Date().toISOString()
                                                        })}
                                                        className="text-[10px] bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-300 hover:border-amber-400 px-2 py-0.5 rounded font-bold transition flex items-center gap-1 shadow-xs"
                                                        title="Lock this penalty: optimizer cannot relax it"
                                                    >
                                                        <Shield size={11} className="text-slate-500" /> Protect Guard
                                                    </button>
                                                )
                                            )}
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
