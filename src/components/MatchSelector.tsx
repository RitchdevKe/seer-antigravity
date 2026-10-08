
import React, { useState } from 'react';
import { X, Target, ShieldCheck, Zap, DollarSign, ListOrdered, Divide, Trophy, MousePointerClick, ShieldAlert, ListFilter } from 'lucide-react';

export interface SelectionCriteria {
  title: string;
  icon: React.ReactNode;
  color: string;
  rules: string[];
}

export const DAILY_CRITERIA: SelectionCriteria[] = [
  {
    title: "BEST BET",
    icon: <ListOrdered size={18} />,
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
    rules: [
      "=== RULES ===",
      "1. Exactly 10 matches.",
      "2. unhedged matches",
      "3. Must be a bet on the market favorite.",
      "4. Odds must be 1.30 to 1.6",
      "6. Select based on the priority that has the highest accuracy rate.",
      "7. Demote matches where the market underdog market odds is <= 3.0",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "Top 12",
    icon: <Target size={18} />,
    color: "bg-green-50 border-green-200 text-green-800",
    rules: [
      "=== RULES ===",
      "1. Exactly 12 matches.",
      "2. All matches must be hedged (1X or X2).",
      "3. Must be a bet on the market favorite.",
      "4. Odds must be 2.0 to 2.40.",
      "5. Must be selected from the 'top10' tag on Live analysis.",
      "6. Select based on the priority that has the highest accuracy rate (PR1 > PR2 > PR3).",
      "7. Demote matches where the market underdog market odds is <= 3.",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 5 (PR5) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "Bankers Dlive",
    icon: <ShieldCheck size={18} />,
    color: "bg-purple-50 border-purple-200 text-purple-800",
    rules: [
      "=== RULES ===",
      "1. Maximum 10 matches.",
      "2. No hedge (straight 1 or 2).",
      "3. Must be a bet on the market favorite.",
      "4. Odds must be 1.50 to 2.00.",
      "5. Have their own tag of Bankers Dlive.",
      "6. Select based on the priority that has the highest accuracy rate.",
      "7. Demote matches where the market underdog market odds is < 3.0",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 5 (PR5) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "BOTB",
    icon: <ListOrdered size={18} />,
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
    rules: [
      "=== RULES ===",
      "1. Exactly 10 matches.",
      "2. 5 hedged matches, 5 unhedged matches",
      "3. Must be a bet on the market favorite.",
      "4. Odds must be 1.50 to 2.0 for unhedged and 2.00-2.4 for hedged",
      "5. Select based on the priority that has the highest accuracy rate.",
      "6. Demote matches where the market underdog market odds is <= 3.0",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 5 (PR5) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "Top 20",
    icon: <ListOrdered size={18} />,
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
    rules: [
      "=== RULES ===",
      "1. Exactly 20 matches.",
      "2. Half the matches should be hedged (10 hedged, 10 unhedged).",
      "3. Must be a bet on the market favorite.",
      "4. Odds must be >= 1.50.",
      "5. Must be selected from the 'top20' tag on Live analysis.",
      "6. Select based on the priority that has the highest accuracy rate.",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 5 (PR5) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "Bankers Jackpot",
    icon: <ShieldCheck size={18} />,
    color: "bg-purple-50 border-purple-200 text-purple-800",
    rules: [
      "=== RULES ===",
      "1. THIRD PRIORITY category.",
      "2. Maximum 5 matches.",
      "3. Eligible for hedged matches; will be unhedged to a straight bet when added to the slip.",
      "4. Odds must be >= 1.80 to 2.4",
      "5. Must be selected from 'bankers_jackpot' tag.",
      "6. Mutually exclusive with Value Picks.",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 5 (PR5) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "Value Bets",
    icon: <DollarSign size={18} />,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    rules: [
      "=== RULES ===",
      "1. Maximum 5 matches.",
      "2. Hedged matches (1X or X2).",
      "3. Both team odds must be >= 2.50.",
      "4. Must be selected from the 'value_bets' tag on Live analysis.",
      "5. Select based on the priority that has the highest accuracy rate.",
      "=== PRIORITY 1 (PR1) - FAVORITE ===",
      "1. PAA Support for market favorite (S.win) >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 2 (PR2) - UNDERDOG ===",
      "1. PAA Support for market underdog (Upset) >= 50%",
      "2. Probability confidence on Underdog >= 50%",
      "=== PRIORITY 3 (PR3) - FAVORITE ===",
      "1. PAA Support for market favorite (S.win) >= 45%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) - UNDERDOG ===",
      "1. PAA Support for market underdog (Upset) >= 45%",
      "2. Probability confidence on Underdog >= 45%",
      "=== PRIORITY 5 (PR5) - FAVORITE ===",
      "1. PAA Support for market favorite (S.win) >= 40%",
      "2. Probability confidence on market favorite >= 40%",
      "=== PRIORITY 6 (PR6) - UNDERDOG ===",
      "1. PAA Support for market underdog (Upset) >= 40%",
      "2. Probability confidence on Underdog >= 40%",
      "=== PRIORITY 7 (PR7) - FAVORITE ===",
      "1. PAA Support for market favorite (S.win) >= 40%",
      "=== PRIORITY 8 (PR8) - UNDERDOG ===",
      "1. PAA Support for market underdog (Upset) >= 40%"
    ]
  },
  {
    title: "Value Picks",
    icon: <MousePointerClick size={18} />,
    color: "bg-teal-50 border-teal-200 text-teal-800",
    rules: [
      "=== RULES ===",
      "1. Second PRIORITY category.",
      "2. Maximum 5 matches.",
      "3. Eligible for hedged matches; will be unhedged to a straight bet when added to the slip.",
      "4. Odds must be 2.00 to 2.40.",
      "5. Must be selected from 'value_picks' tag.",
      "6. Mutually exclusive with Value Picks.",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 5 (PR5) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "Banker Draws",
    icon: <Divide size={18} />,
    color: "bg-slate-50 border-slate-200 text-slate-800",
    rules: [
      "=== RULES ===",
      "1. Maximum 5 matches.",
      "2. Hedged (1X or X2, or straight X).",
      "3. Both home and away odds MUST be >= 2.00.",
      "4. Must be selected from the 'banker_draws' tag on Live analysis.",
      "5. Select based on the priority that has the highest accuracy rate.",
      "=== PRIORITY 1 (PR1) - ===",
      "1. PAA Support for Draw >= 30% AND Prob Draw >= 30%",
      "2. PAA Support for S.win >=40%",
      "3. MUST hedge towards Market favorite",
      "=== PRIORITY 2 (PR2) - ===",
      "1. PAA Support for Draw >= 30% AND Prob Draw >= 30%",
      "2. PAA Support for Underdog >30%",
      "3. MUST hedge towards Market underdog",
      "=== PRIORITY 3 (PR3) - ===",
      "1. PAA Support for Draw >= 30%",
      "2. If PAA Support for Underdog >=30% then hedge towards the underdog else hedge towards the market favorite.",
      "=== PRIORITY 4 (PR4) - ===",
      "1. Probability confidence on draw >= 30%",
      "2. If PAA Support for Underdog >=30% then hedge towards the underdog else hedge towards the market favorite."
    ]
  },
  {
    title: "Upsets",
    icon: <Zap size={18} />,
    color: "bg-orange-50 border-orange-200 text-orange-800",
    rules: [
      "=== RULES ===",
      "1. Maximum 5 matches.",
      "2. Strictly betting on the underdog.",
      "3. Odds: Any.",
      "5. Must be selected from the 'upsets' tag on Live analysis.",
      "6. Select based on the priority that has the highest accuracy rate",
      "=== PRIORITY 1 (PR1) ===",
      "1. PR1a: Sub Pattern Prim, Algo Prim, and Seer Prim support the Underdog.",
      "2. PR1b: Sub Pattern Prim and Seer Prim support the Underdog.",
      "3. PR1c: Sub Pattern Prim and Algo Prim support the Underdog.",
      "4. PR1d: Sub Pattern Prim supports the Underdog.",
      
      "=== PRIORITY 2 (PR2) ===",
      "1. PR2a: PAA Support on Upset, Seer Prediction on Upset, and Algo Support on Upset.",
      "2. PR2b: PAA Support on Upset and Seer Prediction on Upset.",
      "3. PR2c: Seer Prediction on Upset and Algo Support on Upset.",
      "4. PR2d: PAA Support on Upset and Algo Support on Upset.",
      "=== PRIORITY 3 (PR3) ===",
      "1. Draw Risk: Seer calculates >= 40% probability for a Draw.",
      "=== PRIORITY 4 (PR4) ===",
      "1. Sub Pattern Accuracy Audit (PAA) for Upset >= 30",
      "2. Seer score on Underdog must be >= 25%",
      "=== PRIORITY 5 (PR5) ===",
      "1. Match belongs to a banned:UPSET RISK Pattern or sub pattern.",
      "2. PAA Support on Upset is >= 25%",
      "3. Seer score on Underdog must be >= 25%",
      "=== PRIORITY 6 (PR6) ===",
      "1. When the 1X2 prediction supports the Underdog and 1X2 rating is >= 3/10",
      "2. Seer score on Underdog must be >= 25%",
      "=== PRIORITY 7 (PR7) ===",
      "1. 1X2 prediction supports the Underdog.",
      "2. Seer score on Underdog must be >= 25%",
      "=== PRIORITY 8 (PR8) ===",
      "1. Seer Prediction favors the underdog (Strictly when seer predicts 12)",
      "2. Seer score on Underdog must be >= 25%"
    ]
  }
];

export const JACKPOT_CRITERIA: SelectionCriteria[] = [
  {
    title: "Jackpot Slip (General)",
    icon: <Trophy size={18} />,
    color: "bg-amber-50 border-amber-200 text-amber-800",
    rules: [
      "=== RULES ===",
      "1. ALL matches in the jackpot MUST be predicted (e.g., all 16 for Mozzart 16).",
      "2. Total hedged matches MUST NOT exceed 50% of the total matches.",
      "3. Matches with 'mandatory_hedge: true' MUST remain hedged.",
      "4. Priority Flow: Value Bets > Value Picks > Bankers Jackpot > Banker Draws > Upsets > Unallocated > Uncategorized.",
      "5. Each category slip (except Unallocated/Uncategorized) has a MAX of 5 matches.",
      "6. Default prediction is based on the category it was selected from."
    ]
  },
  {
    title: "Value Bets (Jackpot)",
    icon: <DollarSign size={18} />,
    color: "bg-blue-50 border-blue-200 text-blue-800",
    rules: [
      "=== RULES ===",
      "1. Maximum 5 matches.",
      "2. Hedged matches (1X or X2).",
      "3. Both team odds must be >= 2.50.",
      "4. Must be selected from the 'value_bets' tag on Live analysis.",
      "5. Select based on the priority that has the highest accuracy rate.",
      "=== PRIORITY 1 (PR1) - FAVORITE ===",
      "1. PAA Support for market favorite (S.win) >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 2 (PR2) - UNDERDOG ===",
      "1. PAA Support for market underdog (Upset) >= 50%",
      "2. Probability confidence on Underdog >= 50%",
      "=== PRIORITY 3 (PR3) - FAVORITE ===",
      "1. PAA Support for market favorite (S.win) >= 45%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) - UNDERDOG ===",
      "1. PAA Support for market underdog (Upset) >= 45%",
      "2. Probability confidence on Underdog >= 45%",
      "=== PRIORITY 5 (PR5) - FAVORITE ===",
      "1. PAA Support for market favorite (S.win) >= 40%",
      "2. Probability confidence on market favorite >= 40%",
      "=== PRIORITY 6 (PR6) - UNDERDOG ===",
      "1. PAA Support for market underdog (Upset) >= 40%",
      "2. Probability confidence on Underdog >= 40%",
      "=== PRIORITY 7 (PR7) - FAVORITE ===",
      "1. PAA Support for market favorite (S.win) >= 40%",
      "=== PRIORITY 8 (PR8) - UNDERDOG ===",
      "1. PAA Support for market underdog (Upset) >= 40%"
    ]
  },
  {
    title: "Value Picks (Jackpot)",
    icon: <MousePointerClick size={18} />,
    color: "bg-teal-50 border-teal-200 text-teal-800",
    rules: [
      "=== RULES ===",
      "1. Second PRIORITY category.",
      "2. Maximum 5 matches.",
      "3. Eligible for hedged matches; will be unhedged to a straight bet when added to the slip.",
      "4. Odds must be 2.00 to 2.40.",
      "5. Must be selected from 'value_picks' tag.",
      "6. Mutually exclusive with Value Picks.",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 5 (PR5) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "Bankers (Jackpot)",
    icon: <ShieldCheck size={18} />,
    color: "bg-purple-50 border-purple-200 text-purple-800",
    rules: [
      "=== RULES ===",
      "1. THIRD PRIORITY category.",
      "2. Maximum 5 matches.",
      "3. Eligible for hedged matches; will be unhedged to a straight bet when added to the slip.",
      "4. Odds must be >= 1.80 to 2.4",
      "5. Must be selected from 'bankers_jackpot' tag.",
      "6. Mutually exclusive with Value Picks.",
      "=== PRIORITY 1 (PR1) ===",
      "1. PAA support on S.Win >= 60%",
      "2. Probability confidence on market favorite >= 60%",
      "=== PRIORITY 2 (PR2) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 50%",
      "=== PRIORITY 3 (PR3) ===",
      "1. PAA support on S.Win >= 50%",
      "2. Probability confidence on market favorite >= 45%",
      "=== PRIORITY 4 (PR4) ===",
      "1. PAA support on S.Win >= 50%",
      "=== PRIORITY 5 (PR5) ===",
      "1. PAA support on S.Win >= 40%"
    ]
  },
  {
    title: "Banker Draws (Jackpot)",
    icon: <Divide size={18} />,
    color: "bg-slate-50 border-slate-200 text-slate-800",
    rules: [
      "=== RULES ===",
      "1. Maximum 5 matches.",
      "2. Hedged (1X or X2, or straight X).",
      "3. Both home and away odds MUST be >= 2.00.",
      "4. Must be selected from the 'banker_draws' tag on Live analysis.",
      "5. Select based on the priority that has the highest accuracy rate.",
      "=== PRIORITY 1 (PR1) - ===",
      "1. PAA Support for Draw >= 30% AND Prob Draw >= 30%",
      "2. PAA Support for S.win >=40%",
      "3. MUST hedge towards Market favorite",
      "=== PRIORITY 2 (PR2) - ===",
      "1. PAA Support for Draw >= 30% AND Prob Draw >= 30%",
      "2. PAA Support for Underdog >30%",
      "3. MUST hedge towards Market underdog",
      "=== PRIORITY 3 (PR3) - ===",
      "1. PAA Support for Draw >= 30%",
      "2. If PAA Support for Underdog >=30% then hedge towards the underdog else hedge towards the market favorite.",
      "=== PRIORITY 4 (PR4) - ===",
      "1. Probability confidence on draw >= 30%",
      "2. If PAA Support for Underdog >=30% then hedge towards the underdog else hedge towards the market favorite."
    ]
  },
  {
    title: "Upsets (Jackpot)",
    icon: <Zap size={18} />,
    color: "bg-orange-50 border-orange-200 text-orange-800",
    rules: [
      "=== RULES ===",
      "1. Maximum 5 matches.",
      "2. Strictly betting on the underdog.",
      "3. Odds: Any.",
      "5. Must be selected from the 'upsets' tag on Live analysis.",
      "6. Select based on the priority that has the highest accuracy rate",
      "=== PRIORITY 1 (PR1) ===",
      "1. PR1a: Sub Pattern Prim, Algo Prim, and Seer Prim support the Underdog.",
      "2. PR1b: Sub Pattern Prim and Seer Prim support the Underdog.",
      "3. PR1c: Sub Pattern Prim and Algo Prim support the Underdog.",
      "4. PR1d: Sub Pattern Prim supports the Underdog.",
      "=== PRIORITY 2 (PR2) ===",
      "1. PR2a: PAA Support on Upset, Seer Prediction on Upset, and Algo Support on Upset.",
      "2. PR2b: PAA Support on Upset and Seer Prediction on Upset.",
      "3. PR2c: Seer Prediction on Upset and Algo Support on Upset.",
      "4. PR2d: PAA Support on Upset and Algo Support on Upset.",
      
      "=== PRIORITY 3 (PR3) ===",
      "1. Points Gap: Underdog has a +5 point lead over Favorite in scoring.",
      "=== PRIORITY 4 (PR4) ===",
      "1. Draw Risk: Seer calculates >= 40% probability for a Draw.",
      "=== PRIORITY 5 (PR5) ===",
      "1. Algo confidence of the underdog is >= 40%.",
      "=== PRIORITY 6 (PR6) ===",
      "1. Match carries a genuine 'Potential Upset' flag on the card."
    ]
  }
];

interface MatchSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const MatchSelector: React.FC<MatchSelectorProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'jackpot'>('daily');

  if (!isOpen) return null;

  const data = activeTab === 'daily' ? DAILY_CRITERIA : JACKPOT_CRITERIA;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <ListFilter className="text-white" size={24} />
            <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wide">Match Selection Protocols</h3>
                <p className="text-slate-400 text-xs font-medium">Priority-Based Rules Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 shrink-0 border-b border-slate-200">
            <button 
                onClick={() => setActiveTab('daily')} 
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'daily' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Daily Live Criteria
            </button>
            <button 
                onClick={() => setActiveTab('jackpot')} 
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'jackpot' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Jackpot Criteria
            </button>
        </div>

        {/* Content Grid */}
        <div className="overflow-y-auto p-6 bg-slate-50 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.map((item, idx) => (
                    <div key={idx} className={`rounded-lg border p-4 shadow-sm ${item.color} bg-opacity-50`}>
                        <div className="flex items-center gap-2 mb-3 border-b border-black/10 pb-2">
                            {item.icon}
                            <h4 className="font-bold text-sm uppercase">{item.title}</h4>
                        </div>
                        <ul className="space-y-2">
                            {item.rules.map((rule, rIdx) => {
                                const isHeader = rule.startsWith('===');
                                const isSubHeader = rule.startsWith('[');
                                return (
                                <li key={rIdx} className={`text-xs leading-relaxed flex items-start gap-1.5 ${isHeader ? 'font-black mt-3 text-black/70' : isSubHeader ? 'font-bold mt-1 text-black/60' : 'font-medium'}`}>
                                    {!isHeader && !isSubHeader && <span className="mt-1 w-1 h-1 rounded-full bg-current shrink-0"></span>}
                                    <span>{rule}</span>
                                </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 text-xs text-center text-slate-500 shrink-0">
            These criteria are the active rules used by the Gemini AI Engine. The AI acts as an auditor with 50% weight, strictly following Priority 1 (PR1) down to PR5.
        </div>
      </div>
    </div>
  );
};

export default MatchSelector;
