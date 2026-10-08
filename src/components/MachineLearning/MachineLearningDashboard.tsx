import React, { useEffect, useState } from 'react';
import mlModel from '../../data/seer_intelligence_model.json';
import siPatternsRaw from '../../data/seer_patterns.json';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { BrainCircuit, Loader2, Sparkles, AlertCircle, Database, GitBranch, Target } from 'lucide-react';
import { Match } from '../../types';
import { getIntelligenceReport, IntelligenceReport, askGeminiIntelligence } from '../../services/seerIntelligenceEngine';
import { CompositeDecision } from '../../services/compositeIntelligenceEngine';
import { predictWithHybridML, MLPivotResult } from '../../utils/hybridMachineLearning';
import SeerIntelligence from '../SeerIntelligence';
import { useMLMatrix } from '../../context/MLMatrixContext';

const siPatterns = siPatternsRaw as Record<string, any>;

// Display name mapping for studies
const STUDY_LABELS: Record<string, string> = {
  study1_underdogLessThanDraw: '1. Underdog Odds < Draw Odds',
  study3_subPattern: '3. Sub Pattern Performance',
  study8_hiddenStrength: '8. Underdog Hidden Strength (GS=GA±2)',
  study9_phaTie: '9. PHA Volatility Tie',
  study10_hiddenWeakness: '10. Favorite Hidden Weakness (GS=GA±2)',
  study13_pointsSupport: '13. Match Points Support',
  study14_predictorsAgreeDC: '14. Predictors Agree on DC',
  study15_predictorsAgreePrim: '15. Predictors Agree on Primary',
  study16_allPercentagesBelow40: '16. Extreme Volatility (All < 40%)',
  study17_group: '17. Match Group Context',
  study18_category: '18. Match Category Context',
  study21_drawOddsBelow3: '21. Draw Odds < 3.0'
};

export const MachineLearningDashboard: React.FC<{
  historicalMatches: Match[];
  liveMatches: Match[];
}> = ({ historicalMatches, liveMatches }) => {
  const matches = [...historicalMatches, ...liveMatches];
  const [activeTab, setActiveTab] = useState<'live' | 'global' | 'patterns' | 'matrix'>('live');
  const [testMatch, setTestMatch] = useState<Match | null>(null);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [mlResult, setMlResult] = useState<MLPivotResult | null>(null);
  const [geminiThinking, setGeminiThinking] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { mlData } = useMLMatrix();

  const trainedAt = (mlModel as any).metadata?.trainedAt;
  const totalMatchesAnalyzed = (mlModel as any).metadata?.totalMatchesAnalyzed;

  const handleTestMatch = async (match: Match) => {
    setTestMatch(match);
    setGeminiThinking('');
    const r = getIntelligenceReport(match);
    setReport(r);
    const m = predictWithHybridML(match, mlData);
    setMlResult(m);
  };

  const handleConsultGemini = async () => {
    if (!testMatch || !report) return;
    setIsLoading(true);
    try {
      const response = await askGeminiIntelligence(testMatch, report);
      setGeminiThinking(response);
    } catch (e) {
      console.error(e);
      setGeminiThinking('Failed to fetch response.');
    }
    setIsLoading(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-center gap-6 border-b pb-6">
        <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl shadow-lg">
          <Sparkles size={32} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">SEER Intelligence</h1>
          <p className="text-gray-500 text-lg mt-1">Machine Learning Module & Pattern Studies</p>
        </div>
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm w-full md:w-auto">
          <CardContent className="p-4 flex gap-4 items-center">
             <BrainCircuit size={32} className="text-emerald-500" />
             <div>
               <p className="text-sm font-bold text-emerald-900">Model Active</p>
               <p className="text-xs text-emerald-700">Trained on {totalMatchesAnalyzed} matches</p>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-full md:w-max flex-wrap">
        <button onClick={() => setActiveTab('live')} className={`px-4 py-2 text-sm font-semibold rounded-md flex items-center gap-2 transition ${activeTab === 'live' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><Target size={16} /> Live Engine</button>
        <button onClick={() => setActiveTab('matrix')} className={`px-4 py-2 text-sm font-semibold rounded-md flex items-center gap-2 transition ${activeTab === 'matrix' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><Database size={16} /> Matrix Data</button>
        <button onClick={() => setActiveTab('global')} className={`px-4 py-2 text-sm font-semibold rounded-md flex items-center gap-2 transition ${activeTab === 'global' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><Database size={16} /> Global Studies</button>
        <button onClick={() => setActiveTab('patterns')} className={`px-4 py-2 text-sm font-semibold rounded-md flex items-center gap-2 transition ${activeTab === 'patterns' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}><GitBranch size={16} /> Discovered SI Patterns</button>
      </div>

      {activeTab === 'live' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="md:col-span-1 space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            <h2 className="font-bold text-gray-700 flex items-center gap-2"><Target size={18} /> Test Live Match</h2>
            <p className="text-xs text-gray-500 mb-4">Select a match to run through the Intelligence Engine.</p>
            {matches.slice(0, 50).map(m => (
              <div 
                key={m.id} 
                onClick={() => handleTestMatch(m)}
                className={`p-4 text-sm border rounded-xl cursor-pointer transition-all ${testMatch?.id === m.id ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-300 shadow-sm transform scale-[1.02]' : 'hover:bg-gray-50 bg-white hover:border-gray-300'}`}
              >
                <div className="font-bold text-gray-800">{m.teams}</div>
                <div className="text-xs mt-2 flex justify-between items-center">
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{m.mo || m.odds || 'No odds'}</span>
                  <span className={`px-2 py-1 rounded font-semibold ${m.result ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{m.result ? `Res: ${m.result}` : 'Pending'}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="md:col-span-2 space-y-6">
            {!report ? (
              <div className="h-[600px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 bg-gray-50/50 rounded-2xl">
                <Sparkles size={48} className="mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a match to view SEER Intelligence analysis.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {report.siPatternMatch && (
                   <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl shadow-lg flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm"><GitBranch size={24} /></div>
                       <div>
                         <h3 className="font-black text-lg">SI Pattern Match!</h3>
                         <p className="text-sm text-amber-100">This match matches a known high-accuracy SI Pattern.</p>
                       </div>
                     </div>
                     <div className="text-right">
                        <p className="text-2xl font-black">{report.siPatternMatch}</p>
                        <p className="text-sm text-amber-100">{report.siPatternAccuracy?.toFixed(1)}% Historical Accuracy</p>
                     </div>
                   </div>
                )}


                <Card className="shadow-md border-gray-200 border-l-4 border-l-purple-500 bg-purple-50/30">
                  <CardHeader className="border-b border-purple-100 pb-3">
                    <CardTitle className="text-lg text-purple-900 flex items-center gap-2">
                      <Target size={20} className="text-purple-600" />
                      ML Final Verdict
                      <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full ${mlResult ? 'bg-indigo-100 text-indigo-700' : report.decisionLogic === 'SUPPORT' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {mlResult ? '🧠 HYBRID ML' : report.decisionLogic === 'SUPPORT' ? '🌳 TREE SUPPORT' : '⚡ PIVOT MODE'}
                      </span>
                      {!mlResult && report.compositeDecision && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          report.compositeDecision.tier === 'BASE' ? 'bg-blue-100 text-blue-700' :
                          report.compositeDecision.tier === 'EDGE_SINGLE' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {report.compositeDecision.tier === 'BASE' ? '🛡️ BASE' :
                           report.compositeDecision.tier === 'EDGE_SINGLE' ? '⚠️ EDGE' :
                           '🔴 COMPELLING'}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5 flex flex-col gap-5">
                     <div className="flex flex-col md:flex-row gap-6 items-center justify-around">
                       <div className="text-center">
                         <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-2">Primary Prediction</p>
                         <div className="text-4xl font-black text-purple-700 bg-white border-2 border-purple-200 rounded-xl px-8 py-3 shadow-sm inline-block">
                            {mlResult?.mlPrimaryPrediction ? `PRIM ${mlResult.mlPrimaryPrediction}` : report.recommendedPrediction}
                         </div>
                       </div>
                       <div className="h-16 w-px bg-purple-200 hidden md:block"></div>
                       <div className="text-center">
                         <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Recommended Hedge</p>
                         <div className="text-4xl font-black text-amber-600 bg-white border-2 border-amber-200 rounded-xl px-8 py-3 shadow-sm inline-block">
                             {mlResult?.mlPrediction ? `FIN ${mlResult.mlPrediction}` : report.recommendedHedge}
                          </div>
                        </div>
                        {(mlResult || report.compositeDecision) && (
                          <>
                            <div className="h-16 w-px bg-gray-200 hidden md:block"></div>
                            <div className="text-center">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Confidence</p>
                              <div className={`text-4xl font-black rounded-xl px-6 py-3 shadow-sm inline-block border-2 ${
                                (mlResult ? mlResult.mlConfidence : (report.compositeDecision?.confidence || 0)) >= 80 ? 'text-green-700 bg-green-50 border-green-200' :
                                (mlResult ? mlResult.mlConfidence : (report.compositeDecision?.confidence || 0)) >= 70 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                'text-red-700 bg-red-50 border-red-200'
                              }`}>
                                 {mlResult ? mlResult.mlConfidence : (report.compositeDecision?.confidence || 0)}%
                              </div>
                            </div>
                         </>
                       )}
                     </div>

                     {/* Composite Intelligence Hedging Section */}
                     {!mlResult && report.compositeDecision && report.compositeDecision.triggers.length > 0 && (
                       <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-4">
                         <p className="text-xs font-bold text-orange-700 uppercase tracking-widest mb-3 flex items-center gap-1">
                           🎯 Intelligence Hedging — Edge Triggers Detected
                         </p>
                         <div className="space-y-2 mb-3">
                           {report.compositeDecision.triggers.map((trigger, i) => (
                             <div key={i} className="flex items-start gap-2 bg-white border border-orange-100 rounded-lg p-2.5">
                               <span className="text-orange-500 mt-0.5 text-sm">▸</span>
                               <div>
                                 <p className="text-sm font-bold text-orange-800">{trigger.name}</p>
                                 <p className="text-xs text-orange-600">{trigger.description}</p>
                                 <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{trigger.evidence}</p>
                               </div>
                             </div>
                           ))}
                         </div>
                         <div className="space-y-1">
                           {report.compositeDecision.explanation.map((line, i) => (
                             <p key={i} className="text-xs text-gray-700">{line}</p>
                           ))}
                         </div>
                         <div className="mt-3 pt-3 border-t border-orange-200 flex gap-4 text-xs">
                           <span className="text-gray-500">Algo: <strong className="text-gray-700">{report.compositeDecision.rawPredictions.algo}</strong></span>
                           <span className="text-gray-500">Sub Pattern: <strong className="text-gray-700">{report.compositeDecision.rawPredictions.subPattern}</strong></span>
                           <span className="text-gray-500">SEER: <strong className="text-gray-700">{report.compositeDecision.rawPredictions.seer || 'N/A'}</strong></span>
                           <span className={`font-bold ${report.compositeDecision.algoSubAgree ? 'text-green-600' : 'text-red-500'}`}>
                             {report.compositeDecision.algoSubAgree ? '✅ Algo+Sub Agree' : '⚡ Algo+Sub Disagree'}
                           </span>
                         </div>
                       </div>
                     )}

                     {/* BASE mode — show agreement status */}
                     {!mlResult && report.compositeDecision && report.compositeDecision.tier === 'BASE' && (
                       <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-3">
                         <div className="flex items-center gap-2">
                           <span className="text-blue-500">🛡️</span>
                           <div className="text-xs">
                             {report.compositeDecision.explanation.map((line, i) => (
                               <p key={i} className="text-blue-800 font-medium">{line}</p>
                             ))}
                           </div>
                         </div>
                         <div className="mt-2 flex gap-4 text-xs text-gray-500">
                           <span>Algo: <strong>{report.compositeDecision.rawPredictions.algo}</strong></span>
                           <span>Sub: <strong>{report.compositeDecision.rawPredictions.subPattern}</strong></span>
                           <span className={`font-bold ${report.compositeDecision.algoSubAgree ? 'text-green-600' : 'text-amber-600'}`}>
                             {report.compositeDecision.algoSubAgree ? '✅ Agree (83% DC)' : '⚡ Disagree (Algo favored)'}
                           </span>
                         </div>
                       </div>
                     )}
                  </CardContent>
                </Card>

                {/* Decision Intelligence Explainability */}
                <Card className="shadow-sm border-gray-200">
                  <CardHeader className="bg-gray-50 border-b pb-3">
                    <CardTitle className="text-base text-gray-800 flex items-center gap-2">
                      <BrainCircuit size={18} className="text-indigo-500" />
                      Why This Prediction? — {mlResult ? 'Hybrid ML Breakdown' : 'Signal Breakdown'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {mlResult ? (
                      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <p className="text-sm text-indigo-900 font-medium leading-relaxed">
                          {mlResult.mlReasoning}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          {[
                            { label: 'Points Support', value: report.features.study13_pointsSupport || 'Unknown', icon: '📊' },
                            { label: 'TS Diff (Fav-Und)', value: report.features.study7_tsFavVsUnderdog !== null ? (report.features.study7_tsFavVsUnderdog > 0 ? `+${report.features.study7_tsFavVsUnderdog.toFixed(2)} Fav` : `${report.features.study7_tsFavVsUnderdog.toFixed(2)} Und`) : 'N/A', icon: '⚡' },
                            { label: 'Hidden Strength', value: report.features.study8_hiddenStrength ? `✅ Yes (${report.features.study8_underdogGoalDiff?.toFixed(2)})` : '❌ No', icon: '💪' },
                            { label: 'Hidden Weakness', value: report.features.study10_hiddenWeakness ? `⚠️ Yes (${report.features.study10_favGoalDiff?.toFixed(2)})` : '✅ No', icon: '🔽' },
                            { label: 'PAA Model', value: report.features.study4_paa ? `${report.siPatternLean === 'Fav' ? 'Fav' : report.features.study4_paa.underdog > report.features.study4_paa.fav ? 'Underdog' : report.features.study4_paa.draw > report.features.study4_paa.fav ? 'Draw' : 'Fav'} (${Math.max(report.features.study4_paa.fav, report.features.study4_paa.draw, report.features.study4_paa.underdog).toFixed(0)}%)` : 'N/A', icon: '🔮' },
                            { label: 'Algo Model', value: report.features.study5_algo ? `${report.features.study5_algo.underdog > report.features.study5_algo.fav ? 'Underdog' : report.features.study5_algo.draw > report.features.study5_algo.fav ? 'Draw' : 'Fav'} (${(Math.max(report.features.study5_algo.fav, report.features.study5_algo.draw, report.features.study5_algo.underdog) * 100).toFixed(0)}%)` : 'N/A', icon: '🤖' },
                            { label: 'Underdog Odds<Draw', value: report.features.study1_underdogLessThanDraw ? '⚠️ YES — Upset Risk' : '✅ No Risk', icon: '🎯' },
                            { label: 'Predictors Agree?', value: report.features.study15_predictorsAgreePrim ? '✅ Primary' : report.features.study14_predictorsAgreeDC ? '🤝 DC' : '❌ Disagree', icon: '🗳️' },
                          ].map((item, i) => (
                            <div key={i} className="p-3 bg-white border border-gray-100 rounded-lg">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">{item.icon} {item.label}</p>
                              <p className="text-sm font-semibold text-gray-700">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className={`p-3 rounded-lg text-sm font-medium ${report.decisionLogic === 'SUPPORT' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
                          {report.decisionLogic === 'SUPPORT'
                            ? `🌳 TREE SUPPORT: The historical decision tree found ${report.historicalInsights.length} matching studies. The tree lean (${report.siPatternLean}) is backed by historical data with sufficient sample size.`
                            : `⚡ PIVOT MODE: The tree leaf had insufficient data. Prediction is based on live signal convergence across Points, TS, PHA, Algo, PAA, SEER, and Agreement — the majority signals point to ${report.siPatternLean}.`
                          }
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-gray-200">
                  <CardHeader className="bg-gray-50 border-b pb-4">
                    <CardTitle className="text-lg text-gray-800">Overall Statistical Consensus</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 flex gap-4 text-center">
                    <div className="flex-1 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                      <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Favorite</p>
                      <p className="text-3xl font-black text-blue-700 mt-2">
                        {mlResult?.mlPercentages ? `${mlResult.mlPercentages.fav}%` : `${report.overallFavProb.toFixed(1)}%`}
                      </p>
                    </div>
                    <div className="flex-1 p-4 bg-gray-50/50 border border-gray-200 rounded-xl">
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">Draw</p>
                      <p className="text-3xl font-black text-gray-700 mt-2">
                        {mlResult?.mlPercentages ? `${mlResult.mlPercentages.draw}%` : `${report.overallDrawProb.toFixed(1)}%`}
                      </p>
                    </div>
                    <div className="flex-1 p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
                      <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">Underdog</p>
                      <p className="text-3xl font-black text-orange-700 mt-2">
                        {mlResult?.mlPercentages ? `${mlResult.mlPercentages.underdog}%` : `${report.overallUndProb.toFixed(1)}%`}
                      </p>
                    </div>
                  </CardContent>
                </Card>


                <Card className="shadow-sm border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b pb-4 flex flex-row justify-between items-center">
                    <CardTitle className="text-lg text-indigo-900 flex items-center gap-2"><Sparkles size={18} className="text-indigo-500" /> Gemini Intelligence AI</CardTitle>
                    <button 
                      onClick={handleConsultGemini}
                      disabled={isLoading}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                      Consult AI
                    </button>
                  </CardHeader>
                  <CardContent className="pt-6 min-h-[120px]">
                    {geminiThinking ? (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-medium">
                        {geminiThinking}
                      </div>
                    ) : (
                      <div className="h-24 flex items-center justify-center text-sm text-indigo-400 gap-2">
                        <AlertCircle size={16} /> Click 'Consult AI' to generate the thinking process and final prediction.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-gray-200 overflow-hidden bg-white">
                  <CardHeader className="bg-gray-50 border-b pb-4">
                    <CardTitle className="text-lg text-gray-800">Matched Historical Studies ({report.historicalInsights.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                          <tr>
                            <th className="p-4">Study</th>
                            <th className="p-4">Condition</th>
                            <th className="p-4 text-right">Fav %</th>
                            <th className="p-4 text-right">Draw %</th>
                            <th className="p-4 text-right">Und %</th>
                            <th className="p-4 text-right">Sample</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {report.historicalInsights.map((insight, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="p-4 font-semibold text-gray-800">{insight.study}</td>
                              <td className="p-4 text-gray-600"><span className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">{insight.condition}</span></td>
                              <td className="p-4 text-right font-bold text-blue-600">{insight.favPct.toFixed(1)}%</td>
                              <td className="p-4 text-right font-bold text-gray-500">{insight.drawPct.toFixed(1)}%</td>
                              <td className="p-4 text-right font-bold text-orange-600">{insight.underdogPct.toFixed(1)}%</td>
                              <td className="p-4 text-right text-gray-400 font-mono text-xs">{insight.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'global' && (
        <div className="animate-in fade-in duration-500 space-y-6">
          <Card className="shadow-sm border-gray-200 bg-white">
            <CardHeader className="bg-gray-50 border-b pb-4">
              <CardTitle className="text-xl text-gray-800 flex items-center gap-2"><Database size={20} className="text-blue-500" /> Global Feature Studies Database</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-blue-50/50 text-gray-600 uppercase text-[11px] font-bold tracking-wider">
                    <tr>
                      <th className="p-4">Data Point / Study</th>
                      <th className="p-4">Condition Evaluated</th>
                      <th className="p-4 text-right">Favorite Win</th>
                      <th className="p-4 text-right">Draw</th>
                      <th className="p-4 text-right">Underdog Win</th>
                      <th className="p-4 text-right">Total Matches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(mlModel).map(([studyKey, studyData]) => {
                      if (studyKey === 'metadata') return null;
                      
                      return Object.entries(studyData as Record<string, any>)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([condition, stats], idx) => {
                           const favP = (stats.fav / stats.total) * 100;
                           const drawP = (stats.draw / stats.total) * 100;
                           const undP = (stats.underdog / stats.total) * 100;

                           const label = STUDY_LABELS[studyKey] || studyKey;

                           return (
                             <tr key={`${studyKey}-${condition}`} className="hover:bg-blue-50/30 transition-colors">
                               <td className="p-4 font-semibold text-gray-800">{idx === 0 ? label : ''}</td>
                               <td className="p-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono text-xs border border-gray-200">{condition}</span></td>
                               <td className="p-4 text-right font-bold text-blue-600">{favP.toFixed(1)}%</td>
                               <td className="p-4 text-right font-bold text-gray-500">{drawP.toFixed(1)}%</td>
                               <td className="p-4 text-right font-bold text-orange-600">{undP.toFixed(1)}%</td>
                               <td className="p-4 text-right font-mono text-gray-400 text-xs">{stats.total}</td>
                             </tr>
                           )
                        });
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="animate-in fade-in duration-500">
           <SeerIntelligence historicalMatches={historicalMatches} liveMatches={liveMatches} />
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="animate-in fade-in duration-500 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
             {Object.entries(siPatterns).map(([patternId, pattern]) => (
                <Card key={patternId} className="hover:shadow-md transition-shadow border-amber-200 bg-gradient-to-b from-white to-amber-50/30">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                       <div>
                         <h3 className="font-black text-2xl text-amber-700">{pattern.name}</h3>
                         <p className="text-xs font-bold text-amber-900/60 uppercase tracking-wider">{pattern.lean} Lean</p>
                       </div>
                       <div className="px-2 py-1 bg-amber-100 text-amber-700 font-bold rounded-lg text-sm">
                         {pattern.accuracy.toFixed(1)}%
                       </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs">
                         <span className="text-gray-500">Sample Size</span>
                         <span className="font-mono font-bold text-gray-700">{pattern.totalMatches} matches</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
                         <div style={{ width: `${pattern.favPct}%` }} className="bg-blue-500" title={`Favorite: ${pattern.favPct.toFixed(1)}%`} />
                         <div style={{ width: `${pattern.drawPct}%` }} className="bg-gray-400" title={`Draw: ${pattern.drawPct.toFixed(1)}%`} />
                         <div style={{ width: `${pattern.undPct}%` }} className="bg-orange-500" title={`Underdog: ${pattern.undPct.toFixed(1)}%`} />
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-amber-100/50">
                       <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Defining Features</p>
                       <div className="flex flex-wrap gap-1">
                          {Object.entries(pattern.features)
                             .filter(([_, v]) => v !== null && v !== 'N/A' && v !== false)
                             .slice(0, 3)
                             .map(([k, v]) => (
                                <span key={k} className="px-1.5 py-0.5 bg-white border border-amber-200 text-amber-800 text-[9px] rounded font-mono truncate max-w-full">
                                  {k.replace('study', '').replace(/_/g, ' ').substring(0, 15)}: {String(v)}
                                </span>
                          ))}
                          {Object.entries(pattern.features).filter(([_, v]) => v !== null && v !== 'N/A' && v !== false).length > 3 && (
                             <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] rounded font-bold">+{Object.entries(pattern.features).filter(([_, v]) => v !== null && v !== 'N/A' && v !== false).length - 3}</span>
                          )}
                       </div>
                    </div>
                  </CardContent>
                </Card>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};
