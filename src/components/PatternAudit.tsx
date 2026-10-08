import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, BarChart2, TrendingUp, AlertTriangle, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface PatternAuditProps {
  onBack: () => void;
}

interface AuditStats {
  subPattern: string;
  group: number;
  total: number;
  favWin: number;
  draw: number;
  upsetWin: number;
  favWinRate: number;
  drawRate: number;
  upsetWinRate: number;
}

const PatternAudit: React.FC<PatternAuditProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'fav' | 'draw' | 'upset'>('fav');
  const [selectedGroup, setSelectedGroup] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AuditStats; direction: 'asc' | 'desc' }>({
    key: 'favWinRate',
    direction: 'desc'
  });
  const [auditData, setAuditData] = useState<AuditStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditData();
  }, []);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pattern_accuracy_audit')
        .select('*');

      if (error) {
        console.error("Error fetching pattern audit:", error);
        return;
      }

      if (data) {
        const stats: AuditStats[] = data.map((d: any) => ({
          subPattern: d.sub_pattern,
          group: d.group_id,
          total: d.total,
          favWin: d.fav_win,
          draw: d.draw,
          upsetWin: d.upset_win,
          favWinRate: d.total > 0 ? (d.fav_win / d.total) * 100 : 0,
          drawRate: d.total > 0 ? (d.draw / d.total) * 100 : 0,
          upsetWinRate: d.total > 0 ? (d.upset_win / d.total) * 100 : 0,
        }));
        setAuditData(stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let data = auditData;
    if (selectedGroup !== 'all') {
      data = data.filter(d => d.group === selectedGroup);
    }
    
    if (searchTerm.trim()) {
      data = data.filter(d => d.subPattern.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key] ?? 0;
      const bValue = b[sortConfig.key] ?? 0;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [auditData, selectedGroup, sortConfig, searchTerm]);

  const handleSort = (key: keyof AuditStats) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ column }: { column: keyof AuditStats }) => {
    if (sortConfig.key !== column) return <Minus size={12} className="opacity-20" />;
    return sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans p-4 md:p-8 flex items-center justify-center">
         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-4">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity mb-4"
          >
            <ArrowLeft size={14} /> Back to Analysis
          </button>
          <h1 className="text-4xl md:text-6xl font-serif italic tracking-tight leading-none">
            Pattern Accuracy Audit
          </h1>
          <p className="mt-2 text-xs font-mono uppercase tracking-widest opacity-60">
            Historical Performance Analysis by Sub-Pattern
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <input 
             type="text" 
             placeholder="Search by Sub-Pattern..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="px-4 py-2 border border-[#141414] bg-white w-full max-w-xs text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
          />
          <div className="flex gap-2">
            {[1, 2, 3].map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`px-4 py-2 text-xs font-mono border border-[#141414] transition-all ${selectedGroup === g ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/10'}`}
              >
                GROUP {g}
              </button>
            ))}
            <button
              onClick={() => setSelectedGroup('all')}
              className={`px-4 py-2 text-xs font-mono border border-[#141414] transition-all ${selectedGroup === 'all' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/10'}`}
            >
              ALL GROUPS
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-6 flex border-b border-[#141414]">
        <button
          onClick={() => { setActiveTab('fav'); setSortConfig({ key: 'favWinRate', direction: 'desc' }); }}
          className={`px-6 py-3 text-sm font-mono uppercase tracking-wider transition-all flex items-center gap-2 border-r border-[#141414] ${activeTab === 'fav' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/5'}`}
        >
          <TrendingUp size={16} /> Straight Wins
        </button>
        <button
          onClick={() => { setActiveTab('draw'); setSortConfig({ key: 'drawRate', direction: 'desc' }); }}
          className={`px-6 py-3 text-sm font-mono uppercase tracking-wider transition-all flex items-center gap-2 border-r border-[#141414] ${activeTab === 'draw' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/5'}`}
        >
          <BarChart2 size={16} /> Draws
        </button>
        <button
          onClick={() => { setActiveTab('upset'); setSortConfig({ key: 'upsetWinRate', direction: 'desc' }); }}
          className={`px-6 py-3 text-sm font-mono uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'upset' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/5'}`}
        >
          <AlertTriangle size={16} /> Upsets
        </button>
      </div>

      {/* Data Grid */}
      <div className="max-w-7xl mx-auto bg-white border border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
        <div className="grid grid-cols-6 border-b border-[#141414] bg-[#141414]/5">
          <div className="p-4 text-[10px] font-mono uppercase tracking-tighter opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100" onClick={() => handleSort('subPattern')}>
            Sub-Pattern <SortIcon column="subPattern" />
          </div>
          <div className="p-4 text-[10px] font-mono uppercase tracking-tighter opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100" onClick={() => handleSort('group')}>
            Group <SortIcon column="group" />
          </div>
          <div className="p-4 text-[10px] font-mono uppercase tracking-tighter opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100" onClick={() => handleSort('total')}>
            Sample <SortIcon column="total" />
          </div>
          <div className="p-4 text-[10px] font-mono uppercase tracking-tighter opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100" onClick={() => handleSort('favWinRate')}>
            Fav Win % <SortIcon column="favWinRate" />
          </div>
          <div className="p-4 text-[10px] font-mono uppercase tracking-tighter opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100" onClick={() => handleSort('drawRate')}>
            Draw % <SortIcon column="drawRate" />
          </div>
          <div className="p-4 text-[10px] font-mono uppercase tracking-tighter opacity-50 flex items-center gap-1 cursor-pointer hover:opacity-100" onClick={() => handleSort('upsetWinRate')}>
            Upset % <SortIcon column="upsetWinRate" />
          </div>
        </div>

        <div className="divide-y divide-[#141414]">
          {filteredData.length > 0 ? (
            filteredData.map((row, idx) => (
              <div key={`${row.subPattern}_${row.group}`} className="grid grid-cols-6 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group">
                <div className="p-4 font-mono text-sm font-bold">{row.subPattern}</div>
                <div className="p-4 font-mono text-sm opacity-60 group-hover:opacity-100">{row.group}</div>
                <div className="p-4 font-mono text-sm opacity-60 group-hover:opacity-100">{row.total}</div>
                <div className={`p-4 font-mono text-sm font-bold ${activeTab === 'fav' ? 'text-emerald-600 group-hover:text-emerald-400' : ''}`}>
                  {row.favWinRate.toFixed(1)}%
                </div>
                <div className={`p-4 font-mono text-sm font-bold ${activeTab === 'draw' ? 'text-amber-600 group-hover:text-amber-400' : ''}`}>
                  {row.drawRate.toFixed(1)}%
                </div>
                <div className={`p-4 font-mono text-sm font-bold ${activeTab === 'upset' ? 'text-rose-600 group-hover:text-rose-400' : ''}`}>
                  {row.upsetWinRate.toFixed(1)}%
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center font-mono text-xs opacity-40 uppercase tracking-widest">
              No audit data available for this selection
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-[#141414] pt-8">
        <div>
          <h4 className="font-serif italic text-lg mb-2">Straight Wins</h4>
          <p className="text-xs opacity-60 leading-relaxed">
            Measures how often the sub-pattern results in a victory for the market favorite. High percentages here indicate "Safe" patterns for Bankers and Top 12 categories.
          </p>
        </div>
        <div>
          <h4 className="font-serif italic text-lg mb-2">Draw Potential</h4>
          <p className="text-xs opacity-60 leading-relaxed">
            Identifies patterns that frequently result in draws. Essential for "Banker Draws" and identifying when a "Straight Win" prediction needs a hedge.
          </p>
        </div>
        <div>
          <h4 className="font-serif italic text-lg mb-2">Upset Risk</h4>
          <p className="text-xs opacity-60 leading-relaxed">
            Tracks underdog victories. Patterns with high upset rates are "Risky" for favorites but "Golden" for Upset and Value Bet categories.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatternAudit;
