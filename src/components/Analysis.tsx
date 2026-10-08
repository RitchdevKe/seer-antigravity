
import React, { useState, useMemo } from 'react';
import { SUB_PATTERN_RULES } from './Patterns';
import { Match } from '../types';
import { getActualResult, matchesPrediction, getFavoriteAndUnderdog } from '../utils/matchProcessing';
import { Target, Filter, Percent, Zap, ClipboardCheck, TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import PatternAuditModal from './PatternAuditModal';

interface AnalysisProps {
  matches: Match[];
}

const Analysis: React.FC<AnalysisProps> = ({ matches }) => {
  const activeMatches = useMemo(() => matches, [matches]); // Stable reference
  const [activeGroup, setActiveGroup] = useState(1);
  const [selectedPattern, setSelectedPattern] = useState<string>('all');
  const [phaRange, setPhaRange] = useState<string>('all');
  const [paaSWinRange, setPaaSWinRange] = useState<string>('all');
  const [paaDrawRange, setPaaDrawRange] = useState<string>('all');
  const [paaUpsetRange, setPaaUpsetRange] = useState<string>('all');
  const [showUpsetsOnly, setShowUpsetsOnly] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Get unique main patterns for the active group to populate dropdown
  const availablePatterns = useMemo(() => {
    const patterns = new Set<string>();
    SUB_PATTERN_RULES.forEach(rule => {
      if (rule.group === activeGroup) {
        patterns.add(rule.mainPattern);
      }
    });
    return Array.from(patterns).sort();
  }, [activeGroup]);

  // Reset selected pattern when group changes if it doesn't exist in new group
  useMemo(() => {
      if (selectedPattern !== 'all' && !availablePatterns.includes(selectedPattern)) {
          setSelectedPattern('all');
      }
  }, [activeGroup, availablePatterns, selectedPattern]);


  const strategyStats = useMemo(() => {
    // Structure: { RuleID: { total: 0, correct: 0, outcomes: { '1': 0, 'X': 0, '2': 0 }, matches: [], prediction: '' } }
    const stats: Record<string, any> = {};

    // Initialize all rules for active group
    SUB_PATTERN_RULES.forEach(rule => {
        if (rule.group === activeGroup) {
            if (selectedPattern !== 'all' && rule.mainPattern !== selectedPattern) {
                return;
            }

            stats[rule.id] = { 
                rule,
                total: 0, 
                paaTotal: 0,
                correct: 0, 
                outcomes: { '1': 0, 'X': 0, '2': 0, 'pending': 0 },
                favWin: 0,
                drawCount: 0,
                upsetWin: 0,
                matches: [],
                accuracy: 0
            };
        }
    });

    activeMatches.forEach(m => {
        const actual = getActualResult(m.result);
        
        // --- UPSET FILTER LOGIC ---
        if (showUpsetsOnly) {
            // Filter: Matches where the team with the highest MO (market odds) Won
            if (actual !== '1' && actual !== '2') return; 
            
            const moParts = m.mo?.split(',').map(s => parseFloat(s.trim())) || [];
            if (moParts.length < 3) return; // Cannot determine odds
            
            const o1 = moParts[0];
            const o2 = moParts[2];
            if (isNaN(o1) || isNaN(o2)) return;

            // Check if result matches the underdog (higher odds)
            const isUpset = (actual === '1' && o1 > o2) || (actual === '2' && o2 > o1);
            if (!isUpset) return;
        }
        // ---------------------------

        // Ensure we only count this match for the sub-pattern it was actually assigned to
        const assignedSubPattern = m.patternAnalysis?.subPattern;
        
        if (assignedSubPattern && stats[assignedSubPattern]) {
            const stat = stats[assignedSubPattern];
            const rule = stat.rule;

            stat.total += 1;
            
            // Re-evaluate prediction for static rules to reflect current config
            let pred = rule.prediction;
            if (pred === 'MO' || pred === 'Upset' || pred === 'PTS') {
                pred = m.patternAnalysis?.subPatternPrediction || pred;
            }
            
            if (actual !== 'pending') {
                stat.outcomes[actual] = (stat.outcomes[actual] || 0) + 1;
                if (matchesPrediction(pred, actual)) {
                    stat.correct += 1;
                }

                // PAA Logic: Fav Win, Draw, Upset
                const favInfo = getFavoriteAndUnderdog(m);

                if (favInfo) {
                    const { fav: moFav, underdog: moUnderdog } = favInfo;
                    stat.paaTotal++;
                    if (actual === moFav) stat.favWin++;
                    else if (actual === 'X') stat.drawCount++;
                    else if (actual === moUnderdog) stat.upsetWin++;
                }
            } else {
                stat.outcomes['pending'] = (stat.outcomes['pending'] || 0) + 1;
            }
        }
    });

    return Object.entries(stats)
        .map(([id, s]) => {
            // Calculate accuracy first
            const completed = s.total - s.outcomes.pending;
            const accuracy = completed > 0 ? Math.round((s.correct / completed) * 100) : 0;
            s.accuracy = accuracy;
            return [id, s] as [string, typeof s];
        })
        .filter(([_, s]) => {
            // 1. Basic Availability Check: Must have at least one match to be "loaded"
            if (s.total === 0) return false;

            // 2. PHA Range Filter
            if (phaRange !== 'all') {
                const acc = s.accuracy;
                if (phaRange === '<50') return acc < 50;
                if (phaRange === '50-60') return acc >= 50 && acc < 60;
                if (phaRange === '60-70') return acc >= 60 && acc < 70;
                if (phaRange === '70-80') return acc >= 70 && acc < 80;
                if (phaRange === '80-90') return acc >= 80 && acc < 90;
                if (phaRange === '90-100') return acc >= 90;
            }

            const getRangeFilter = (val: number, range: string) => {
                if (range === 'all') return true;
                if (range === '<20') return val < 20;
                if (range === '30-40') return val >= 30 && val < 40;
                if (range === '40-50') return val >= 40 && val < 50;
                if (range === '50-60') return val >= 50 && val < 60;
                if (range === '60-70') return val >= 60 && val < 70;
                if (range === '70-100') return val >= 70;
                // Add 20-30 if needed, but following requested list:
                if (range === '20-30') return val >= 20 && val < 30;
                return true;
            };

            // 3. PAA S.Win Filter
            if (paaSWinRange !== 'all') {
                const denom = s.paaTotal > 0 ? s.paaTotal : s.total;
                const rate = denom > 0 ? Math.round((s.favWin / denom) * 100) : 0;
                if (!getRangeFilter(rate, paaSWinRange)) return false;
            }

            // 4. PAA Draw Filter
            if (paaDrawRange !== 'all') {
                const denom = s.paaTotal > 0 ? s.paaTotal : s.total;
                const rate = denom > 0 ? Math.round((s.drawCount / denom) * 100) : 0;
                if (!getRangeFilter(rate, paaDrawRange)) return false;
            }

            // 5. PAA Upset Filter
            if (paaUpsetRange !== 'all') {
                const denom = s.paaTotal > 0 ? s.paaTotal : s.total;
                const rate = denom > 0 ? Math.round((s.upsetWin / denom) * 100) : 0;
                if (!getRangeFilter(rate, paaUpsetRange)) return false;
            }

            return true;
        })
        .sort((a, b) => {
            // Optional: Sort by accuracy descending if a range is selected? 
            // Or keep ID sort? Keeping ID sort for consistency with current behavior.
            return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' });
        }); 
  }, [activeMatches, activeGroup, selectedPattern, phaRange, paaSWinRange, paaDrawRange, paaUpsetRange, showUpsetsOnly]);

  return (
    <div className="bg-gray-50 rounded-lg p-4 min-h-[600px] w-full">
        {/* Header with Group Tabs and Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-200 pb-2 mb-4 gap-4 w-full">
            <div className="flex gap-2 text-sm overflow-x-auto w-full md:w-auto">
                {[1, 2, 3].map(g => (
                    <button 
                        key={g} 
                        onClick={() => setActiveGroup(g)}
                        className={`px-4 py-2 font-bold rounded-t-lg transition-colors whitespace-nowrap ${activeGroup === g ? 'bg-white text-indigo-600 border-t-2 border-indigo-600 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                        Group {g}
                    </button>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                {/* Pattern Audit Button */}
                <button
                    onClick={() => setIsAuditModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all border shadow-sm bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                    <ClipboardCheck size={14} className="text-indigo-500" />
                    <span>Audit Patterns</span>
                </button>

                {/* Upset Filter Toggle */}
                <button
                    onClick={() => setShowUpsetsOnly(!showUpsetsOnly)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all border shadow-sm ${showUpsetsOnly ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    title="Show matches where the underdog (highest odds) won"
                >
                    <Zap size={14} className={showUpsetsOnly ? "text-orange-500" : "text-gray-400"} />
                    <span>Upset Matches</span>
                </button>

                {/* Main Pattern Filter */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-gray-200 flex-1 sm:flex-none">
                    <Filter size={16} className="text-gray-400 shrink-0" />
                    <span className="text-xs font-bold text-gray-600 shrink-0">Pattern:</span>
                    <select 
                        value={selectedPattern} 
                        onChange={(e) => setSelectedPattern(e.target.value)}
                        className="text-xs font-bold text-indigo-700 bg-transparent outline-none border-b border-indigo-200 focus:border-indigo-500 px-2 py-1 w-full sm:w-32"
                    >
                        <option value="all">All Patterns</option>
                        {availablePatterns.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {/* PAA S.Win Filter */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-gray-200 flex-1 sm:flex-none">
                    <TrendingUp size={16} className="text-blue-400 shrink-0" />
                    <span className="text-xs font-bold text-gray-600 shrink-0">PAA.S:</span>
                    <select 
                        value={paaSWinRange} 
                        onChange={(e) => setPaaSWinRange(e.target.value)}
                        className="text-xs font-bold text-blue-700 bg-transparent outline-none border-b border-blue-200 focus:border-blue-500 px-2 py-1 w-full sm:w-28"
                    >
                        <option value="all">All S.Win</option>
                        <option value="<20">Below 20%</option>
                        <option value="20-30">20% - 30%</option>
                        <option value="30-40">30% - 40%</option>
                        <option value="40-50">40% - 50%</option>
                        <option value="50-60">50% - 60%</option>
                        <option value="60-70">60% - 70%</option>
                        <option value="70-100">70% - 100%</option>
                    </select>
                </div>

                {/* PAA Draw Filter */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-gray-200 flex-1 sm:flex-none">
                    <Activity size={16} className="text-yellow-400 shrink-0" />
                    <span className="text-xs font-bold text-gray-600 shrink-0">PAA.D:</span>
                    <select 
                        value={paaDrawRange} 
                        onChange={(e) => setPaaDrawRange(e.target.value)}
                        className="text-xs font-bold text-yellow-700 bg-transparent outline-none border-b border-yellow-200 focus:border-yellow-500 px-2 py-1 w-full sm:w-28"
                    >
                        <option value="all">All Draw</option>
                        <option value="<20">Below 20%</option>
                        <option value="20-30">20% - 30%</option>
                        <option value="30-40">30% - 40%</option>
                        <option value="40-50">40% - 50%</option>
                        <option value="50-60">50% - 60%</option>
                        <option value="60-70">60% - 70%</option>
                        <option value="70-100">70% - 100%</option>
                    </select>
                </div>

                {/* PAA Upset Filter */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-gray-200 flex-1 sm:flex-none">
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    <span className="text-xs font-bold text-gray-600 shrink-0">PAA.U:</span>
                    <select 
                        value={paaUpsetRange} 
                        onChange={(e) => setPaaUpsetRange(e.target.value)}
                        className="text-xs font-bold text-red-700 bg-transparent outline-none border-b border-red-200 focus:border-red-500 px-2 py-1 w-full sm:w-28"
                    >
                        <option value="all">All Upset</option>
                        <option value="<20">Below 20%</option>
                        <option value="20-30">20% - 30%</option>
                        <option value="30-40">30% - 40%</option>
                        <option value="40-50">40% - 50%</option>
                        <option value="50-60">50% - 60%</option>
                        <option value="60-70">60% - 70%</option>
                        <option value="70-100">70% - 100%</option>
                    </select>
                </div>

                {/* PHA Percentage Filter */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-gray-200 flex-1 sm:flex-none">
                    <Percent size={16} className="text-gray-400 shrink-0" />
                    <span className="text-xs font-bold text-gray-600 shrink-0">PHA:</span>
                    <select 
                        value={phaRange} 
                        onChange={(e) => setPhaRange(e.target.value)}
                        className="text-xs font-bold text-indigo-700 bg-transparent outline-none border-b border-indigo-200 focus:border-indigo-500 px-2 py-1 w-full sm:w-32"
                    >
                        <option value="all">All Ranges</option>
                        <option value="<50">Below 50%</option>
                        <option value="50-60">50% - 60%</option>
                        <option value="60-70">60% - 70%</option>
                        <option value="70-80">70% - 80%</option>
                        <option value="80-90">80% - 90%</option>
                        <option value="90-100">90% - 100%</option>
                    </select>
                </div>
            </div>
        </div>

        {strategyStats.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
                <Target className="w-16 h-16 mx-auto mb-3 opacity-20"/>
                <p className="text-sm">
                    {showUpsetsOnly 
                        ? `No upset matches found in Group ${activeGroup} matching filters.` 
                        : `No matches triggered rules in Group ${activeGroup} matching filters.`
                    }
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {strategyStats.map(([id, s]) => {
                    // Use pre-calculated accuracy
                    const finalAcc = s.accuracy;
                    
                    return (
                        <div key={id} className="bg-white rounded border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                            {/* Compact Header */}
                            <div className="bg-indigo-50 px-2 py-1.5 border-b border-indigo-100 flex justify-between items-start">
                                <div className="min-w-0 flex-1 pr-1">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="font-bold text-indigo-900 text-xs">{id}</h3>
                                        <span className="text-[10px] font-bold text-white bg-indigo-400 px-1 rounded-sm leading-tight">{s.rule.mainPattern}</span>
                                    </div>
                                    <div className="text-[10px] text-indigo-600 font-mono leading-tight whitespace-normal break-words mt-0.5 opacity-80" title={s.rule.riders.join('+')}>
                                        {s.rule.riders.length > 0 ? s.rule.riders.slice(0, 4).join('+') : <span className="text-gray-400 italic">No Riders</span>}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-black text-base text-indigo-800 leading-none">{s.rule.prediction === 'MO' ? 'MO' : s.rule.prediction}</div>
                                </div>
                            </div>
                            
                            <div className="p-2 space-y-2 flex-1 flex flex-col justify-between">
                                {/* Stats Row - Very Compact */}
                                <div className="flex justify-between items-center bg-gray-50 px-1.5 py-1 rounded border border-gray-100">
                                    <div className="text-center">
                                        <div className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-0.5">Tot</div>
                                        <div className="text-xs font-bold text-gray-800 leading-none">{s.total}</div>
                                    </div>
                                    <div className="h-5 w-px bg-gray-200"></div>
                                    <div className="text-center">
                                        <div className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-0.5">Cor</div>
                                        <div className="text-xs font-bold text-green-600 leading-none">{s.correct}</div>
                                    </div>
                                    <div className="h-5 w-px bg-gray-200"></div>
                                    <div className="text-center">
                                        <div className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-0.5">Acc</div>
                                        <div className={`text-xs font-bold leading-none ${finalAcc >= 60 ? 'text-green-600' : finalAcc >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {finalAcc}%
                                        </div>
                                    </div>
                                </div>

                                {/* Outcomes Breakdown - Compact Bars */}
                                <div className="space-y-1">
                                    {['1', 'X', '2'].map(outcome => {
                                        const count = s.outcomes[outcome] || 0;
                                        if (count === 0) return null;
                                        
                                        return (
                                            <div key={outcome} className="flex items-center text-[10px] leading-none">
                                                <span className="w-3 font-bold text-gray-500">{outcome}</span>
                                                <div className="flex-1 mx-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${outcome === '1' ? 'bg-blue-500' : outcome === 'X' ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                                        style={{ width: `${(count / s.total) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className="font-mono text-gray-400 w-3 text-right">{count}</span>
                                            </div>
                                        );
                                    })}
                                    {s.outcomes.pending > 0 && (
                                        <div className="flex items-center text-[10px] leading-none">
                                            <span className="w-3 font-bold text-gray-300">P</span>
                                            <div className="flex-1 mx-1.5"></div>
                                            <span className="font-mono text-gray-300 w-3 text-right">{s.outcomes.pending}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
        
        <PatternAuditModal 
            isOpen={isAuditModalOpen} 
            onClose={() => setIsAuditModalOpen(false)} 
            matches={matches} 
        />
    </div>
  );
};

export default Analysis;