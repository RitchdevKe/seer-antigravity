import React, { useState, useMemo } from 'react';
import { Match } from '../../types';
import { extractMLFeatures, generateSITags } from '../../utils/mlFeatureExtractor';
import { getActualResult, getFavoriteAndUnderdog } from '../../utils/matchProcessing';
import { Brain, Search, Filter, GitMerge } from 'lucide-react';

interface Props {
  matches: Match[];
}

interface TagStat {
  tag: string;
  total: number;
  favWins: number;
  draws: number;
  undWins: number;
}

const PATTERN_GROUPS: Record<string, string> = {
  'SIa': 'Match Odds Behavior',
  'SIb': 'PHA Percentages',
  'SIc': 'Sub Pattern Prediction',
  'SId': 'PAA Percentages',
  'SIe': 'Algo Probabilities',
  'SIf': 'SEER Percentages',
  'SIg': 'Team Strength Diff',
  'SIh': 'Hidden Strength',
  'SIi': 'PHA Tie (Volatility)',
  'SIj': 'Hidden Weakness',
  'SIk': 'Max Draw %',
  'SIl': 'Points Support',
  'SIm': 'Predictor DC Agreement',
  'SIn': 'Predictor Prim Agreement',
  'SIo': 'High Volatility',
  'SIp': 'Group Category',
  'SIq': 'Priority Category',
  'SIr': 'Draw Odds',
  'SIs': 'Fav Goal Diff (Raw)',
  'SIt': 'Und Goal Diff (Raw)',
  'SIu': 'Algo & Sub Agreement',
};

export default function SeerIntelligenceUI({ matches }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [secondaryVariant, setSecondaryVariant] = useState<string | null>(null);

  // Process all matches and calculate tags + stats
  const { matchData, tagStats } = useMemo(() => {
    const data: { match: Match; tags: string[]; result: 'Fav' | 'Draw' | 'Underdog' | 'Unknown' }[] = [];
    const stats: Record<string, TagStat> = {};

    matches.forEach(m => {
      const features = extractMLFeatures(m);
      if (!features) return;
      const tags = generateSITags(features);
      
      const actual = getActualResult(m.result);
      let resCategory: 'Fav' | 'Draw' | 'Underdog' | 'Unknown' = 'Unknown';
      
      const favInfo = getFavoriteAndUnderdog(m);
      if (actual !== 'pending' && favInfo) {
        if (actual === 'X') resCategory = 'Draw';
        else if (actual === favInfo.fav) resCategory = 'Fav';
        else if (actual === favInfo.underdog) resCategory = 'Underdog';
      }

      data.push({ match: m, tags, result: resCategory });

      tags.forEach(tag => {
        if (!stats[tag]) {
          stats[tag] = { tag, total: 0, favWins: 0, draws: 0, undWins: 0 };
        }
        stats[tag].total++;
        if (resCategory === 'Fav') stats[tag].favWins++;
        if (resCategory === 'Draw') stats[tag].draws++;
        if (resCategory === 'Underdog') stats[tag].undWins++;
      });
    });

    return { matchData: data, tagStats: Object.values(stats).sort((a, b) => b.total - a.total) };
  }, [matches]);

  // Group stats by Pattern (SIa, SIb...)
  const groupedStats = useMemo(() => {
    const groups: Record<string, TagStat[]> = {};
    tagStats.forEach(stat => {
      const parent = stat.tag.replace(/[0-9]+$/, '');
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(stat);
    });
    Object.keys(groups).forEach(k => {
      groups[k].sort((a, b) => {
        const numA = parseInt(a.tag.replace(k, '')) || 0;
        const numB = parseInt(b.tag.replace(k, '')) || 0;
        return numA - numB;
      });
    });
    return groups;
  }, [tagStats]);

  // Calculate Sub-Tree (Intersections)
  const { intersectionStats, filteredMatches } = useMemo(() => {
    if (!selectedVariant) return { intersectionStats: [], filteredMatches: [] };
    
    // 1. Get matches that have the primary variant
    let subset = matchData.filter(d => d.tags.includes(selectedVariant));
    
    // 2. If secondary variant is selected, filter further
    if (secondaryVariant) {
        subset = subset.filter(d => d.tags.includes(secondaryVariant));
    }

    // 3. Calculate what other tags exist in this subset
    const iStats: Record<string, TagStat> = {};
    subset.forEach(d => {
      d.tags.forEach(tag => {
        if (tag === selectedVariant) return; // don't count itself
        if (!iStats[tag]) {
          iStats[tag] = { tag, total: 0, favWins: 0, draws: 0, undWins: 0 };
        }
        iStats[tag].total++;
        if (d.result === 'Fav') iStats[tag].favWins++;
        if (d.result === 'Draw') iStats[tag].draws++;
        if (d.result === 'Underdog') iStats[tag].undWins++;
      });
    });

    return { 
        filteredMatches: subset,
        intersectionStats: Object.values(iStats)
            .filter(s => s.total > 5) // Minimum 5 matches to show in intersection tree
            .sort((a, b) => b.total - a.total)
    };
  }, [selectedVariant, secondaryVariant, matchData]);

  const renderBar = (fav: number, draw: number, und: number, total: number) => {
    const favPct = total > 0 ? (fav / total) * 100 : 0;
    const drawPct = total > 0 ? (draw / total) * 100 : 0;
    const undPct = total > 0 ? (und / total) * 100 : 0;
    return (
        <div className="flex gap-1 h-6 relative group w-full">
            <div style={{ width: `${favPct}%` }} className="bg-emerald-500 h-full relative" title={`Fav: ${favPct.toFixed(1)}%`}>
            {favPct > 15 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">1</span>}
            </div>
            <div style={{ width: `${drawPct}%` }} className="bg-amber-500 h-full relative" title={`Draw: ${drawPct.toFixed(1)}%`}>
            {drawPct > 15 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">X</span>}
            </div>
            <div style={{ width: `${undPct}%` }} className="bg-rose-500 h-full relative" title={`Und: ${undPct.toFixed(1)}%`}>
            {undPct > 15 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">2</span>}
            </div>
        </div>
    );
  };

  return (
    <div className="bg-[#E4E3E0] min-h-screen p-4 md:p-8 text-[#141414] font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 border-b border-[#141414] pb-6 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <Brain size={32} className="text-indigo-600" />
                <h1 className="text-4xl md:text-5xl font-serif italic tracking-tight">SEER Intelligence Vision</h1>
            </div>
            <p className="text-sm font-mono uppercase tracking-widest opacity-60">
                Advanced Pattern Recognition & Variant Filtering
            </p>
          </div>
          <div className="text-right">
              <span className="font-mono text-3xl font-bold">{matchData.length}</span>
              <span className="block font-mono text-xs uppercase opacity-60">Total Matches Analyzed</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Column 1: Primary Pattern Groups */}
          <div className="lg:col-span-4 space-y-6">
            <h2 className="text-xl font-serif italic flex items-center gap-2">
              <Filter size={18} /> Primary Patterns
            </h2>
            
            <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(PATTERN_GROUPS).map(([prefix, title]) => {
                const variants = groupedStats[prefix];
                if (!variants || variants.length === 0) return null;

                return (
                  <div key={prefix} className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
                    <div className="bg-[#141414] text-[#E4E3E0] px-3 py-2 flex justify-between items-center">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">{prefix} - {title}</span>
                    </div>
                    <div className="divide-y divide-[#141414]/10">
                      {variants.map(v => {
                        const isSelected = selectedVariant === v.tag;
                        return (
                          <div 
                            key={v.tag}
                            onClick={() => {
                                setSelectedVariant(isSelected ? null : v.tag);
                                setSecondaryVariant(null);
                            }}
                            className={`p-2 grid grid-cols-12 items-center gap-2 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-[#141414]/5'}`}
                          >
                            <div className="col-span-3 font-mono font-bold text-xs">{v.tag}</div>
                            <div className="col-span-2 font-mono text-[10px] opacity-60 text-center">n={v.total}</div>
                            <div className="col-span-7">
                                {renderBar(v.favWins, v.draws, v.undWins, v.total)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: The Combination Tree (Sub-Patterns) */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-xl font-serif italic flex items-center gap-2">
              <GitMerge size={18} /> Combination Tree
            </h2>
            
            {!selectedVariant ? (
                <div className="text-center p-8 border-2 border-dashed border-[#141414]/30 rounded-lg">
                    <p className="font-mono text-sm opacity-60">Select a primary pattern to view overlapping variants.</p>
                </div>
            ) : (
                <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                    <div className="bg-indigo-600 text-white px-4 py-3 flex flex-col gap-1">
                        <span className="font-mono text-xs opacity-80 uppercase tracking-wider">Root Pattern</span>
                        <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-xl">{selectedVariant}</span>
                            <span className="font-mono text-sm">{filteredMatches.length} matches</span>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-b border-[#141414]/20">
                        <p className="font-mono text-xs opacity-60 mb-2 uppercase">When {selectedVariant} is combined with:</p>
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar pr-2 space-y-1">
                            {intersectionStats.slice(0, 50).map(v => {
                                const isSelected = secondaryVariant === v.tag;
                                return (
                                    <div 
                                        key={v.tag}
                                        onClick={() => setSecondaryVariant(isSelected ? null : v.tag)}
                                        className={`p-2 grid grid-cols-12 items-center gap-2 cursor-pointer border ${isSelected ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-transparent hover:border-[#141414]/20 bg-white'}`}
                                    >
                                        <div className="col-span-3 font-mono font-bold text-xs">+{v.tag}</div>
                                        <div className="col-span-2 font-mono text-[10px] opacity-60 text-center">n={v.total}</div>
                                        <div className="col-span-7">
                                            {renderBar(v.favWins, v.draws, v.undWins, v.total)}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* Column 3: Match List */}
          <div className="lg:col-span-3 space-y-6">
            <h2 className="text-xl font-serif italic flex items-center gap-2">
              <Search size={18} /> Filtered Matches
            </h2>
            
            {(!selectedVariant) ? (
              <div className="text-center p-8 border-2 border-dashed border-[#141414]/30 rounded-lg">
                <p className="font-mono text-sm opacity-60">Matches will appear here.</p>
              </div>
            ) : (
              <div>
                <div className="bg-[#141414] text-white font-mono px-3 py-2 text-[10px] font-bold shadow-[2px_2px_0px_0px_rgba(100,100,100,1)] mb-4">
                  Showing {filteredMatches.length} Matches
                </div>
                
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredMatches.slice(0, 100).map(({ match: m, result }, idx) => (
                    <div key={idx} className="bg-white p-2 border border-[#141414] text-xs font-mono hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold truncate pr-2">{m.teams}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] text-white font-bold shrink-0 ${
                          result === 'Fav' ? 'bg-emerald-500' :
                          result === 'Draw' ? 'bg-amber-500' :
                          result === 'Underdog' ? 'bg-rose-500' : 'bg-slate-400'
                        }`}>
                          {result}
                        </span>
                      </div>
                      <div className="flex justify-between opacity-60 text-[9px]">
                        <span>{m.date}</span>
                        <span>{m.mo}</span>
                      </div>
                    </div>
                  ))}
                  {filteredMatches.length > 100 && (
                      <div className="text-center p-2 font-mono text-[10px] opacity-60">
                          + {filteredMatches.length - 100} more matches
                      </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
