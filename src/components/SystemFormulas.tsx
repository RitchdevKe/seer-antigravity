
import React from 'react';
import { SUB_PATTERN_RULES, PATTERN_DESCRIPTIONS } from './Patterns';
import { Calculator, Grip, X, Activity, BarChart2 } from 'lucide-react';

export const FORMULA_DEFINITIONS = {
  pointSystem: {
    title: "Point System Calculation Protocol",
    subtitle: "Step-by-Step Logic for Calculated Prediction",
    description: "The Point System is a deterministic algorithm that assigns points to Home, Draw, and Away across 7 weighted metrics. The outcome with the highest cumulative score becomes the 'Calculated Prediction'.",
    components: [
      "1. MARKET ODDS (MO) (20 Pts Max): If Fav Odds <= 1.50: Fav 20. If 1.60-2.00: Fav 10, Draw 5, Dog 5. If 2.01-2.50: Fav 11, Draw 4, Dog 5. If both > 2.50: Home 7, Draw 6, Away 7.",
      "2. OFFENSE (GS) (20 Pts): If Diff > 0.5: Better 20. If 0.2 < Diff <= 0.5: Better 12, Other 8, Draw 0. If Diff <= 0.2: Home 7, Draw 6, Away 7.",
      "3. 1X2 RATING (15 Pts Max): Pool of 15 points. Split based on confidence rating. Primary gets calculated share.",
      "4. TEAM STRENGTH (TS) (15 Pts): Stronger team 15 pts. If Diff <= 0.2: Home 5, Draw 5, Away 5.",
      "5. DEFENSE (GA) (12 Pts): If Diff > 0.2: Better Defense 12. If Diff <= 0.2: All 4.",
      "6. FORM (L10) (8 Pts): If Diff > 1: Better 8. If Diff <= 1: Better 4, Draw 2, Worse 2.",
      "7. LAST ENCOUNTER (LE) (10 Pts): Winner 10, Loser 0. If Draw/NA: Draw 10, Others 0."
    ],
    formula: "TOTAL_SCORE (Max 100) = Σ(Metric_Points)"
  },
  distribution: {
    title: "Outcome Probability Distribution",
    subtitle: "Deriving the CONF % (e.g. 1:49% X:28% 2:23%)",
    description: "This formula determines the specific percentage chance for each outcome (1, X, 2) displayed as 'CONF'. It aggregates 6 independent signals using a weighted average model to ensure high-precision forecasting.",
    components: [
      "1. SUB-PATTERN HISTORY PERFERMANCE (PHA) (Weight 5.0): The historical win/draw/loss rate of the specific sub-pattern distributed into home away and draw.",
      "2. PAA prediction (Weight 6.5): Primary prediction gets 65% of the weight, hedge gets 35%.",
      "3. MARKET ODDS (Weight 3.5): The implied probability derived from live bookmaker odds (1/Decimal Odds).",
      "4. FLAG CONSENSUS (Weight 0.0): The aggregated probability derived from all active statistical flags.",
      "5. Sub patt prediction (Weight 2.0): Primary prediction gets 65% of the weight, hedge gets 35%",
      "6. Algo prediction (Weight 3.0): The normalized score converted into a probability distribution."
    ],
    formula: "P(x) = (P_PHA×5.0 + PAA_Pred×6.5 + P_Odds×3.5 + Sub-patt_Pred×2.0 + Algo_pred×3.0) / 20"
  },
  probability: {
    title: "Algorithmic Confidence Protocol",
    subtitle: "Weighted Consensus Model",
    description: "The 'Algo Confidence %' is not a simple probability; it is a normalized metric derived from the Weighted Probability Distribution (above). It scales the raw probability of the winning outcome relative to random chance (33%).",
    components: [
      "1. Calculate Weighted Sum Probability (MaxP) for the predicted outcome using the Distribution Formula.",
      "2. Compare MaxP against a random baseline of 0.33 (33%).",
      "3. Normalize the difference over the remaining range (0.67).",
      "4. Apply Confidence Boosters (e.g., if Points System & External Sources agree)."
    ],
    formula: "Confidence = ((Weighted_MaxP - 0.33) / 0.67) * 100"
  }
};

export const SystemFormulasView: React.FC = () => {
  return (
    <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-indigo-200">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-indigo-900 mb-2">System Formulas Registry</h3>
                <p className="text-sm text-gray-600">
                    This registry defines the static rule-based logic used by the SEER.AI Algorithm.
                    These rules (SubPatterns) override probabilistic models when specific conditions are met.
                </p>
            </div>

            {/* Formula Definitions Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {/* Point System Formula */}
                <div className="bg-indigo-50/50 p-5 rounded-lg border border-indigo-100 flex flex-col">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Grip size={20}/></div>
                        <div>
                            <h4 className="font-black text-indigo-900 text-sm uppercase tracking-wide">{FORMULA_DEFINITIONS.pointSystem.title}</h4>
                            <p className="text-indigo-600 text-[10px] font-bold">{FORMULA_DEFINITIONS.pointSystem.subtitle}</p>
                        </div>
                    </div>
                    
                    <p className="text-gray-700 text-xs mb-4 leading-relaxed font-medium border-b border-indigo-200 pb-2">
                        {FORMULA_DEFINITIONS.pointSystem.description}
                    </p>

                    <div className="space-y-2 mb-4 bg-white p-3 rounded border border-indigo-100 h-64 overflow-y-auto flex-grow">
                        {FORMULA_DEFINITIONS.pointSystem.components.map((step, idx) => (
                            <p key={idx} className="text-[10px] text-gray-700 font-mono flex gap-2 leading-relaxed">
                                <span className="text-indigo-500 font-bold shrink-0">•</span> {step}
                            </p>
                        ))}
                    </div>

                    <div className="bg-indigo-900 text-white p-3 rounded font-mono text-[10px] shadow-inner text-center mt-auto">
                        {FORMULA_DEFINITIONS.pointSystem.formula}
                    </div>
                </div>

                {/* Distribution Formula (New) */}
                <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-100 flex flex-col">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><BarChart2 size={20}/></div>
                        <div>
                            <h4 className="font-black text-blue-900 text-sm uppercase tracking-wide">{FORMULA_DEFINITIONS.distribution.title}</h4>
                            <p className="text-blue-600 text-[10px] font-bold">{FORMULA_DEFINITIONS.distribution.subtitle}</p>
                        </div>
                    </div>
                    
                    <p className="text-gray-700 text-xs mb-4 leading-relaxed font-medium border-b border-blue-200 pb-2">
                        {FORMULA_DEFINITIONS.distribution.description}
                    </p>

                    <div className="space-y-2 mb-4 bg-white p-3 rounded border border-blue-100 h-64 overflow-y-auto flex-grow">
                        {FORMULA_DEFINITIONS.distribution.components.map((step, idx) => (
                            <p key={idx} className="text-[10px] text-gray-700 font-mono flex gap-2 leading-relaxed">
                                <span className="text-blue-500 font-bold shrink-0">•</span> {step}
                            </p>
                        ))}
                    </div>

                    <div className="bg-blue-900 text-white p-3 rounded font-mono text-[10px] shadow-inner text-center mt-auto">
                        {FORMULA_DEFINITIONS.distribution.formula}
                    </div>
                </div>

                {/* Probability Confidence Formula */}
                <div className="bg-teal-50/50 p-5 rounded-lg border border-teal-100 flex flex-col">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-teal-100 text-teal-600 rounded-lg"><Activity size={20}/></div>
                        <div>
                            <h4 className="font-black text-teal-900 text-sm uppercase tracking-wide">{FORMULA_DEFINITIONS.probability.title}</h4>
                            <p className="text-teal-600 text-[10px] font-bold">{FORMULA_DEFINITIONS.probability.subtitle}</p>
                        </div>
                    </div>
                    
                    <p className="text-gray-700 text-xs mb-4 leading-relaxed font-medium border-b border-teal-200 pb-2">
                        {FORMULA_DEFINITIONS.probability.description}
                    </p>

                    <div className="space-y-2 mb-4 bg-white p-3 rounded border border-teal-100 h-64 overflow-y-auto flex-grow">
                        {FORMULA_DEFINITIONS.probability.components.map((step, idx) => (
                            <p key={idx} className="text-[10px] text-gray-700 font-mono flex gap-2 leading-relaxed">
                                <span className="text-teal-500 font-bold shrink-0">•</span> {step}
                            </p>
                        ))}
                    </div>

                    <div className="bg-teal-900 text-white p-3 rounded font-mono text-[10px] shadow-inner text-center mt-auto">
                        {FORMULA_DEFINITIONS.probability.formula}
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Active Sub-Pattern Rules</h3>
                {[1, 2, 3].map(group => {
                    const rules = SUB_PATTERN_RULES.filter(r => r.group === group);
                    if (rules.length === 0) return null;

                    return (
                        <div key={group}>
                            <h4 className="font-black text-gray-800 text-lg mb-3 border-b pb-2 flex items-center gap-2">
                                <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">G{group}</span>
                                Group {group} Protocols
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rules.map(rule => (
                                    <div key={rule.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow bg-gray-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">{rule.id}</span>
                                            <span className={`font-black text-sm px-2 py-1 rounded ${
                                                rule.prediction === '1' ? 'bg-blue-100 text-blue-700' :
                                                rule.prediction === '2' ? 'bg-red-100 text-red-700' :
                                                rule.prediction === 'X' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-200 text-gray-700'
                                            }`}>{rule.prediction}</span>
                                        </div>
                                        <div className="mb-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Main Pattern</span>
                                            <div className="font-bold text-gray-700 text-sm">{rule.mainPattern}</div>
                                            <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{PATTERN_DESCRIPTIONS[rule.mainPattern]}</div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Triggers (Riders)</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {rule.riders.length > 0 ? rule.riders.slice(0, 4).map(r => (
                                                    <span key={r} className="text-[10px] font-mono bg-white border border-gray-300 px-1.5 py-0.5 rounded text-gray-600">{r}</span>
                                                )) : <span className="text-[10px] text-gray-400 italic">None</span>}
                                                {rule.riders.length > 4 && <span className="text-[10px] text-gray-400">+{rule.riders.length - 4} more</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    </div>
  );
};