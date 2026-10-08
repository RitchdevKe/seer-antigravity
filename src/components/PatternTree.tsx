import React, { useState, useMemo, useEffect } from 'react';
import { X, ChevronDown, GitBranch, Zap, Target, TrendingUp, Shield, BarChart3, Loader2 } from 'lucide-react';
import { ML_BASE_PATTERNS_DESCRIPTIONS, getSubPatternDescription } from '../utils/mlFeatureExtractor';
import { supabase } from '../lib/supabase';
interface PatternTreeProps {
    mlData: any;
    onClose: () => void;
}

const SUB_PATTERN_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Color coding for outcome types
const OUTCOME_COLORS = {
    fav: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#10b981', label: 'M.FAV' },
    draw: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b', label: 'DRAW' },
    und: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444', label: 'UND' },
};

// Variable group classification
function getVariableGroup(num: number): 'fav' | 'draw' | 'und' {
    if ([1, 2, 3, 4, 8].includes(num)) return 'fav';
    if ([5, 6, 7].includes(num)) return 'draw';
    return 'und';
}

function StatPill({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: color + '99' }}>{label}</span>
            <span className="text-sm font-black" style={{ color }}>{value}</span>
            <div className="w-12 h-1 rounded-full bg-gray-800 mt-1 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-[9px] font-mono mt-0.5" style={{ color: color + 'cc' }}>{pct.toFixed(1)}%</span>
        </div>
    );
}

export default function PatternTree({ mlData, onClose }: PatternTreeProps) {
    const [selectedPattern, setSelectedPattern] = useState<string>('');
    const [selectedSubPattern, setSelectedSubPattern] = useState<string | null>(null);

    const patternKeys = useMemo(() => Object.keys(ML_BASE_PATTERNS_DESCRIPTIONS), []);

    // Get base pattern data
    const baseData = useMemo(() => {
        if (!selectedPattern || !mlData?.basePatterns?.[selectedPattern]) return null;
        return mlData.basePatterns[selectedPattern];
    }, [selectedPattern, mlData]);

    // Get sub-pattern data for the selected base
    const subPatternsData = useMemo(() => {
        if (!selectedPattern || !mlData?.subPatterns) return [];
        return SUB_PATTERN_NUMBERS.map(num => {
            const key = `${selectedPattern}${num}`;
            const data = mlData.subPatterns[key];
            return {
                key,
                num,
                group: getVariableGroup(num),
                desc: getSubPatternDescription(selectedPattern, num),
                data: data || { total: 0, fav: 0, draw: 0, und: 0, favPct: 0, drawPct: 0, undPct: 0 }
            };
        });
    }, [selectedPattern, mlData]);

    const [fetchedCombos, setFetchedCombos] = useState<any[]>([]);
    const [isLoadingCombos, setIsLoadingCombos] = useState(false);

    useEffect(() => {
        if (!selectedSubPattern) {
            setFetchedCombos([]);
            return;
        }

        let isMounted = true;

        const fetchCombos = async () => {
            setIsLoadingCombos(true);
            try {
                const { data, error } = await supabase
                    .from('ml_matrix_data')
                    .select('*')
                    .eq('matrix_type', 'combos')
                    .ilike('item_key', `%${selectedSubPattern}%`)
                    .order('total_matches', { ascending: false })
                    .limit(50);
                
                if (data && isMounted) {
                    // Exact match filter since ilike `%SIa1%` could match `SIa10`
                    const exactMatches = data.filter(row => {
                         const tags = row.item_key.split('+');
                         return tags.includes(selectedSubPattern);
                    });

                    const formatted = exactMatches.map(row => {
                        const total = row.total_matches;
                        return {
                            key: row.item_key,
                            data: {
                                total,
                                fav: row.fav_wins,
                                draw: row.draws,
                                und: row.und_wins,
                                favPct: total > 0 ? (row.fav_wins / total) * 100 : 0,
                                drawPct: total > 0 ? (row.draws / total) * 100 : 0,
                                undPct: total > 0 ? (row.und_wins / total) * 100 : 0
                            }
                        };
                    });
                    setFetchedCombos(formatted);
                }
            } catch (err) {
                console.error(err);
            } finally {
                if (isMounted) setIsLoadingCombos(false);
            }
        };

        fetchCombos();
        return () => { isMounted = false; };
    }, [selectedSubPattern]);

    // Determine the dominant outcome for a data row
    const getDominant = (data: any): 'fav' | 'draw' | 'und' => {
        if (!data || data.total === 0) return 'fav';
        const max = Math.max(data.favPct, data.drawPct, data.undPct);
        if (max === data.favPct) return 'fav';
        if (max === data.drawPct) return 'draw';
        return 'und';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
            <div className="w-full max-w-6xl mx-4 mt-8 mb-8 max-h-[90vh] overflow-y-auto rounded-2xl" style={{
                background: 'linear-gradient(145deg, #0a0f1a 0%, #111827 50%, #0d1321 100%)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                boxShadow: '0 0 80px rgba(99, 102, 241, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
                {/* Header */}
                <div className="sticky top-0 z-20 p-5 border-b flex items-center justify-between" style={{
                    borderColor: 'rgba(99, 102, 241, 0.15)',
                    background: 'linear-gradient(to right, rgba(10, 15, 26, 0.95), rgba(17, 24, 39, 0.95))',
                    backdropFilter: 'blur(20px)'
                }}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                            <GitBranch size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight">Pattern Decision Tree</h2>
                            <p className="text-[11px] text-indigo-300/60 font-medium">Hierarchical flow: Base → Sub-Pattern → Combo breakdown</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Pattern Selector */}
                <div className="p-5">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block">Select Base Pattern</label>
                    <select
                        value={selectedPattern}
                        onChange={e => { setSelectedPattern(e.target.value); setSelectedSubPattern(null); }}
                        className="w-full p-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        style={{
                            background: 'rgba(99, 102, 241, 0.08)',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                            color: '#e0e7ff',
                            appearance: 'none'
                        }}
                    >
                        <option value="" style={{ background: '#111827' }}>— Choose a pattern to visualize —</option>
                        {patternKeys.map((key, i) => (
                            <option key={key} value={key} style={{ background: '#111827' }}>
                                {i + 1}. {key} — {ML_BASE_PATTERNS_DESCRIPTIONS[key]}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Base Pattern Root Node */}
                {baseData && selectedPattern && (
                    <div className="px-5 pb-3">
                        <div className="relative rounded-xl p-5 overflow-hidden" style={{
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            boxShadow: '0 0 30px rgba(99, 102, 241, 0.08)'
                        }}>
                            {/* Glow effect */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full" style={{ background: 'linear-gradient(to right, transparent, rgba(99, 102, 241, 0.6), transparent)' }} />

                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Zap size={14} className="text-indigo-400" />
                                        <span className="text-indigo-400 font-mono text-xs font-bold">{selectedPattern}</span>
                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}>ROOT</span>
                                    </div>
                                    <h3 className="text-white font-bold text-sm">{ML_BASE_PATTERNS_DESCRIPTIONS[selectedPattern]}</h3>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Volume</span>
                                        <span className="text-2xl font-black text-white">{baseData.total.toLocaleString()}</span>
                                    </div>
                                    <div className="h-10 w-px bg-gray-700/50" />
                                    <StatPill label="M.FAV" value={baseData.fav} pct={baseData.favPct} color="#10b981" />
                                    <StatPill label="DRAW" value={baseData.draw} pct={baseData.drawPct} color="#f59e0b" />
                                    <StatPill label="UND" value={baseData.und} pct={baseData.undPct} color="#ef4444" />
                                </div>
                            </div>
                        </div>

                        {/* Connector line */}
                        <div className="flex justify-center">
                            <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, rgba(99, 102, 241, 0.4), rgba(99, 102, 241, 0.1))' }} />
                        </div>
                    </div>
                )}

                {/* Sub-Patterns Grid */}
                {selectedPattern && subPatternsData.length > 0 && (
                    <div className="px-5 pb-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Target size={14} className="text-indigo-400/60" />
                            <span className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">Sub-Pattern Variations (1–12)</span>
                        </div>

                        {/* Group headers */}
                        {(['fav', 'draw', 'und'] as const).map(group => {
                            const groupItems = subPatternsData.filter(sp => sp.group === group);
                            const groupColor = OUTCOME_COLORS[group];
                            return (
                                <div key={group} className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full" style={{ background: groupColor.border }} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: groupColor.text + '99' }}>
                                            {groupColor.label} Thresholds
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {groupItems.map(sp => {
                                            const isSelected = selectedSubPattern === sp.key;
                                            const dominant = getDominant(sp.data);
                                            const dominantColor = OUTCOME_COLORS[dominant];
                                            const hasData = sp.data.total > 0;

                                            return (
                                                <button
                                                    key={sp.key}
                                                    onClick={() => setSelectedSubPattern(isSelected ? null : sp.key)}
                                                    className="text-left rounded-lg p-3 transition-all duration-200"
                                                    style={{
                                                        background: isSelected
                                                            ? `linear-gradient(135deg, ${groupColor.bg}, rgba(99, 102, 241, 0.1))`
                                                            : hasData ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                                                        border: `1px solid ${isSelected ? groupColor.border + '60' : hasData ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}`,
                                                        opacity: hasData ? 1 : 0.45,
                                                        boxShadow: isSelected ? `0 0 20px ${groupColor.border}20` : 'none'
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-black text-xs" style={{ color: groupColor.text }}>{sp.key}</span>
                                                            {isSelected && <ChevronDown size={12} className="text-indigo-400 animate-bounce" />}
                                                        </div>
                                                        <span className="text-white font-black text-sm">{sp.data.total.toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-[9px] text-gray-500 font-medium mb-2 leading-tight">{sp.desc}</p>
                                                    <div className="flex gap-3">
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <span className="text-[10px] font-bold text-emerald-400">{sp.data.favPct.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                            <span className="text-[10px] font-bold text-amber-400">{sp.data.drawPct.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                            <span className="text-[10px] font-bold text-rose-400">{sp.data.undPct.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                    {/* Mini bar chart */}
                                                    <div className="flex h-1 rounded-full overflow-hidden mt-2 bg-gray-800">
                                                        <div style={{ width: `${sp.data.favPct}%`, background: '#10b981' }} />
                                                        <div style={{ width: `${sp.data.drawPct}%`, background: '#f59e0b' }} />
                                                        <div style={{ width: `${sp.data.undPct}%`, background: '#ef4444' }} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Combos Expansion */}
                {selectedSubPattern && (
                    <div className="px-5 pb-6">
                        {/* Connector */}
                        <div className="flex justify-center mb-2">
                            <div className="w-px h-6" style={{ background: 'linear-gradient(to bottom, rgba(139, 92, 246, 0.4), rgba(139, 92, 246, 0.1))' }} />
                        </div>

                        <div className="rounded-xl overflow-hidden" style={{
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            background: 'rgba(139, 92, 246, 0.04)'
                        }}>
                            <div className="p-4 flex items-center justify-between" style={{
                                borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
                                background: 'rgba(139, 92, 246, 0.06)'
                            }}>
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={14} className="text-purple-400" />
                                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                        Exact Combos containing <span className="text-purple-300">{selectedSubPattern}</span>
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold text-purple-400/60">{fetchedCombos.length} combos</span>
                            </div>

                            {isLoadingCombos ? (
                                <div className="p-12 flex flex-col items-center justify-center text-purple-400/60">
                                    <Loader2 size={24} className="animate-spin mb-3 text-purple-400" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Mining Matrix for Combos...</span>
                                </div>
                            ) : fetchedCombos.length === 0 ? (
                                <div className="p-8 text-center text-gray-600 text-xs font-medium">No combos found for this sub-pattern.</div>
                            ) : (
                                <div className="max-h-[350px] overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 z-10" style={{ background: 'rgba(17, 24, 39, 0.98)' }}>
                                            <tr style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                                                <th className="px-4 py-2.5 text-left text-[9px] font-bold text-purple-400/60 uppercase tracking-widest">#</th>
                                                <th className="px-4 py-2.5 text-left text-[9px] font-bold text-purple-400/60 uppercase tracking-widest">Combo Tags</th>
                                                <th className="px-4 py-2.5 text-right text-[9px] font-bold text-purple-400/60 uppercase tracking-widest">Vol</th>
                                                <th className="px-4 py-2.5 text-right text-[9px] font-bold text-emerald-400/60 uppercase tracking-widest">M.Fav</th>
                                                <th className="px-4 py-2.5 text-right text-[9px] font-bold text-amber-400/60 uppercase tracking-widest">Draw</th>
                                                <th className="px-4 py-2.5 text-right text-[9px] font-bold text-rose-400/60 uppercase tracking-widest">Und</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fetchedCombos.map((combo, idx) => {
                                                const d = combo.data;
                                                const dominant = getDominant(d);
                                                return (
                                                    <tr key={combo.key} className="group" style={{
                                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                                                    }}>
                                                        <td className="px-4 py-2 text-gray-600 font-mono">{idx + 1}</td>
                                                        <td className="px-4 py-2 font-mono text-gray-400 break-all text-[10px] leading-relaxed max-w-[300px]">
                                                            {combo.key.split('+').map((tag, ti) => (
                                                                <span key={ti}>
                                                                    <span className={tag === selectedSubPattern ? 'text-purple-300 font-bold' : 'text-gray-500'}>{tag}</span>
                                                                    {ti < combo.key.split('+').length - 1 && <span className="text-gray-700 mx-0.5">+</span>}
                                                                </span>
                                                            ))}
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-black text-white">{d.total}</td>
                                                        <td className="px-4 py-2 text-right font-bold" style={{ color: d.favPct >= 60 ? '#10b981' : '#6b7280' }}>{d.favPct.toFixed(1)}%</td>
                                                        <td className="px-4 py-2 text-right font-bold" style={{ color: d.drawPct >= 35 ? '#f59e0b' : '#6b7280' }}>{d.drawPct.toFixed(1)}%</td>
                                                        <td className="px-4 py-2 text-right font-bold" style={{ color: d.undPct >= 40 ? '#ef4444' : '#6b7280' }}>{d.undPct.toFixed(1)}%</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!selectedPattern && (
                    <div className="flex flex-col items-center justify-center py-20 px-8">
                        <div className="p-4 rounded-2xl mb-4" style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                            <GitBranch size={32} className="text-indigo-500/50" />
                        </div>
                        <h3 className="text-gray-400 font-bold text-sm mb-1">Select a Pattern Above</h3>
                        <p className="text-gray-600 text-xs text-center max-w-sm">
                            Choose one of the 51 base patterns to visualize its decision tree — from root trigger through sub-pattern thresholds down to exact combo distributions.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
