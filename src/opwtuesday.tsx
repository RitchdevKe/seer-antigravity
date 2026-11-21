import React, { useState, useMemo } from 'react';
import { Match } from './types';
import { DayMetadata, DAY_METADATA } from './utils/opwDayMetadata';
import { sanitizeRulePolarity, populateCategoryWithMasterRules, buildValueBetsRulesFromT12 } from './utils/opwCatalog';
import { 
    OptimizedCategorySettings, 
    MatchEvaluationStats,
    isClose,
    evaluateAllCatalogTriggers
} from './utils/opwCommon';
import { Calendar, Trophy, Sliders, CheckCircle2 } from 'lucide-react';

export interface TuesdayRuleItem {
  description: string;
  points: number;
}

// ----------------------------------------------------------------------------
// Category: Top 12 Value | Target Objective: 'mfav_draw'
// ----------------------------------------------------------------------------
export const TUESDAY_TOP_12_RULES: TuesdayRuleItem[] = sanitizeRulePolarity([
  { description: "Algo supports Mfav >=45% to <50%", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Mfav GS > Underdog GS with >= 0.3", points: 20 }, // Calibrated Rules (Top 12 Value): +20 pts
  { description: "Underdog GS > Mfav GS with >= 0.3", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Odds for underdog <= odds for draw but >= 3.0", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Seer score on draw <= 20%", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Seer score on draw >= 35% to <40%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Seer score on draw >= 40%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Seer score on Mfav <40%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Seer score on Mfav =>40%  to <50%", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Seer score on Mfav =>50%  to <60%", points: 20 }, // Calibrated Rules (Top 12 Value): +20 pts
  { description: "Seer score on Mfav =>60%  to <70%", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Seer score on Mfav =>70%", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Algo Mfav support =>50 to <55%", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Algo Mfav support =>55 to <60%", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Algo Mfav support =>60", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Seer score on underdog >= 45%", points: -25 }, // Calibrated Rules (Top 12 Value): -25 pts
  { description: "Seer primary predicts on underdog", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Algo support for Mfav > 50%", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Algo support for Mfav is 45-50%", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Algo for Mfav support <40%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Algo final prediction is 1X/X2", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Algo primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 10 }, // Calibrated Rules (Top 12 Value): +10 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 }, // Calibrated Rules (Top 12 Value): +15 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: 15 }, // Calibrated Rules (Top 12 Value): +15 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -10 }, // Calibrated Rules (Top 12 Value): -10 pts
  { description: "Sub pattern primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "1X2 Rating =>7", points: 15 }, // Calibrated Rules (Top 12 Value): +15 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -10 }, // Calibrated Rules (Top 12 Value): -10 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -25 }, // Calibrated Rules (Top 12 Value): -25 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "TS difference <= 0.1", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog has hidden strength", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog has hidden weakness", points: -30 }, // Calibrated Rules (Top 12 Value): -30 pts
  { description: "M.fav has hidden strength", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "M.fav has hidden weakness", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Underdog has >= 5 more points on point system", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 25 }, // Calibrated Rules (Top 12 Value): +25 pts
  { description: "Both teams GS < 1.0", points: -30 }, // Calibrated Rules (Top 12 Value): -30 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Both team GS => 1.8", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Both teams GA >= 1.5", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav GS = Und Gs +-0.2", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "A match has GS=GS=GA=GA", points: -10 }, // Calibrated Rules (Top 12 Value): -10 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // Calibrated Rules (Top 12 Value): +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // Calibrated Rules (Top 12 Value): -15 pts
  { description: "Underdog odds <= 2.80", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Odds for draw is < 3.0", points: -20 }, // Calibrated Rules (Top 12 Value): -20 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE : Underdog won the last encounter", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE Underdog won with 2+ goals", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog was away on LE and Won", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: -30 }, // Calibrated Rules (Top 12 Value): -30 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -20 }, // Calibrated Rules (Top 12 Value): -20 pts
  { description: "Match is for Tournament", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Match is for Carabao Cup", points: -15 }, // Calibrated Rules (Top 12 Value): -15 pts
  { description: "Mfav is playing at home", points: 25 }, // Calibrated Rules (Top 12 Value): +25 pts
  { description: "Youth League U19", points: -5 },
  { description: "Youth League U20", points: -5 },
  { description: "Youth League U21", points: -5 },
  { description: "Youth League U23", points: 5 },
  { description: "Match has BB, T12, or BD opw < 10%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "TS difference >= 1.0", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -25 }, // Calibrated Rules (Top 12 Value): -25 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -25 }, // Calibrated Rules (Top 12 Value): -25 pts
  { description: "LE was a draw", points: -30 }, // Calibrated Rules (Top 12 Value): -30 pts
  { description: "Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE was a draw + Mfav has hidden strength", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: -5 }, // Calibrated Rules (Top 12 Value): +10 pts
  { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Both team L10 <= 5", points: -10 }, // Calibrated Rules (Top 12 Value): -10 pts
  { description: "1X2 pred supports the underdog", points: -30 }, // Calibrated Rules (Top 12 Value): -30 pts
  { description: "1X2 supports the underdog", points: -15 }, // Calibrated Rules (Top 12 Value): -15 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: -10 }, // Calibrated Rules (Top 12 Value): -10 pts
  { description: "1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "1X2 Rating 5.0 to 7.0", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "PAA Win probability >= 50%", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "PAA Win probability < 35%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "PHA Draw probability >= 35%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "PHA Underdog probability >= 35%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "SubPattern is G2E5", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -30 }, // Calibrated Rules (Top 12 Value): -30 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 }, // Calibrated Rules (Top 12 Value): -20 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: -25 }, // Calibrated Rules (Top 12 Value): -25 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -30 }, // Calibrated Rules (Top 12 Value): -30 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Match has Banned:Upset risk tag", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Match has Banned:Draw risk tag", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav L10 > Und L10 with >=3 points", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Mfav L10(wins) >5 to 7", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav L10(wins) >7", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Underdog L10(wins) >5 to 7", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog L10(wins) >7", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav was home and won last Encounter >3 goal", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Mfav was Away and won last Encounter >3 goal", points: 10 }, // Calibrated Rules (Top 12 Value): +10 pts
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules (Top 12 Value): +10 pts
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 25 }, // Calibrated Rules (Top 12 Value): +25 pts
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 15 }, // Calibrated Rules (Top 12 Value): +15 pts
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules (Top 12 Value): +10 pts
  { description: "PHA for Mfav <40%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog odds >3.0", points: 5 }, // Calibrated Rules (Top 12 Value): +20 pts
  { description: "Underdog odds <=2.7", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav odds >= 2.5", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Both team TS =< 1.0", points: -10 }, // Calibrated Rules (Top 12 Value): -10 pts
  { description: "MFav TS <=1.2", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "PHA on draw =>30%", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "M.fav has hidden strength+Underdog has hidden strength", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 5 }, // Calibrated Rules (Top 12 Value): +5 pts
  { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -10 }, // Calibrated Rules (Top 12 Value): -10 pts
  { description: "Underdog L10 <= 2", points: 15 }, // Calibrated Rules (Top 12 Value): +15 pts
  { description: "Match has PHA TIE tag", points: -10 }, // Calibrated Rules (Top 12 Value): -10 pts
  { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: -30 }, // Calibrated Rules (Top 12 Value): -30 pts
  { description: "Points for Draw =>30 on the point system", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: 30 }, // Calibrated Rules (Top 12 Value): +30 pts
  { description: "Underdog is at home", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog has hidden strength+Underdog is at home", points: -5 }, // Calibrated Rules (Top 12 Value): -5 pts
  { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -15 }, // Calibrated Rules (Top 12 Value): -15 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0", points: -5 },
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav", points: -5 },
], 'top_12_value', { preserveExact: true });

// ----------------------------------------------------------------------------
// Category: Best Bets | Target Objective: 'mfav_only'
// ----------------------------------------------------------------------------
export const TUESDAY_BEST_BET_RULES: TuesdayRuleItem[] = sanitizeRulePolarity([
  { description: "Algo supports Mfav >=45% to <50%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Mfav GS > Underdog GS with >= 0.3", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Underdog GS > Mfav GS with >= 0.3", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Odds for underdog <= odds for draw but >= 3.0", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Seer score on draw <= 20%", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "Seer score on draw >= 35% to <40%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Seer score on draw >= 40%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Seer score on Mfav <40%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Seer score on Mfav =>40%  to <50%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Seer score on Mfav =>50%  to <60%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Seer score on Mfav =>60%  to <70%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Seer score on Mfav =>70%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Algo Mfav support =>50 to <55%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Algo Mfav support =>55 to <60%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Algo Mfav support =>60", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Seer score on underdog >= 45%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Seer primary predicts on underdog", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Algo support for Mfav > 50%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Algo support for Mfav is 45-50%", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Algo for Mfav support <40%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Algo final prediction is 1X/X2", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Algo primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Sub pattern primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "1X2 Rating =>7", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "TS difference <= 0.1", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog has hidden strength", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog has hidden weakness", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "M.fav has hidden strength", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "M.fav has hidden weakness", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Underdog has >= 5 more points on point system", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Both teams GS < 1.0", points: -10 }, // Calibrated Rules (Best Bets): -10 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: -10 }, // Calibrated Rules (Best Bets): -10 pts
  { description: "Both team GS => 1.8", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: -10 }, // Calibrated Rules (Best Bets): -10 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Both teams GA >= 1.5", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav GS = Und Gs +-0.2", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "A match has GS=GS=GA=GA", points: -10 }, // Calibrated Rules (Best Bets): -10 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Underdog odds <= 2.80", points: -30 }, // Calibrated Rules (Best Bets): -30 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Odds for draw is < 3.0", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -10 }, // Calibrated Rules (Best Bets): -10 pts
  { description: "LE : Underdog won the last encounter", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "LE Underdog won with 2+ goals", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog was away on LE and Won", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "Match is for Tournament", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Match is for Carabao Cup", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Mfav is playing at home", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Youth League U19", points: -5 },
  { description: "Youth League U20", points: -5 },
  { description: "Youth League U21", points: -5 },
  { description: "Youth League U23", points: 5 },
  { description: "Match has BB, T12, or BD opw < 10%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "TS difference >= 1.0", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "LE was a draw", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "LE was a draw + Mfav has hidden strength", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: -5 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Both team L10 <= 5", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "1X2 pred supports the underdog", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "1X2 supports the underdog", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "1X2 Rating 5.0 to 7.0", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "PAA Win probability >= 50%", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "PAA Win probability < 35%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "PHA Draw probability >= 35%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "PHA Underdog probability >= 35%", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "SubPattern is G2E5", points: -30 }, // Calibrated Rules (Best Bets): -30 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Match has Banned:Upset risk tag", points: -30 }, // Calibrated Rules (Best Bets): -30 pts
  { description: "Match has Banned:Draw risk tag", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav L10 > Und L10 with >=3 points", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav L10(wins) >5 to 7", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav L10(wins) >7", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Underdog L10(wins) >5 to 7", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog L10(wins) >7", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav was home and won last Encounter >3 goal", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "Mfav was Away and won last Encounter >3 goal", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules (Best Bets): +10 pts
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 15 }, // Calibrated Rules (Best Bets): +15 pts
  { description: "PHA for Mfav <40%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog odds >3.0", points: 5 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Underdog odds <=2.7", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "Mfav odds >= 2.5", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "Both team TS =< 1.0", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "MFav TS <=1.2", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "PHA on draw =>30%", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "M.fav has hidden strength+Underdog has hidden strength", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -15 }, // Calibrated Rules (Best Bets): -15 pts
  { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog L10 <= 2", points: 5 }, // Calibrated Rules (Best Bets): +5 pts
  { description: "Match has PHA TIE tag", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: -20 }, // Calibrated Rules (Best Bets): -20 pts
  { description: "Points for Draw =>30 on the point system", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: 30 }, // Calibrated Rules (Best Bets): +30 pts
  { description: "Underdog is at home", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog has hidden strength+Underdog is at home", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -5 }, // Calibrated Rules (Best Bets): -5 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0", points: -5 },
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav", points: -5 },
], 'best_bet', { preserveExact: true });

// ----------------------------------------------------------------------------
// Category: Bankers Dlive | Target Objective: 'mfav_only'
// ----------------------------------------------------------------------------
export const TUESDAY_BANKERS_DLIVE_RULES: TuesdayRuleItem[] = sanitizeRulePolarity([
  { description: "Algo supports Mfav >=45% to <50%", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav GS > Underdog GS with >= 0.3", points: 20 }, // Calibrated Rules (Bankers Dlive): +20 pts
  { description: "Underdog GS > Mfav GS with >= 0.3", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Odds for underdog <= odds for draw but >= 3.0", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: -10 }, // Calibrated Rules (Bankers Dlive): -10 pts
  { description: "Seer score on draw <= 20%", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Seer score on draw >= 35% to <40%", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Seer score on draw >= 40%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Seer score on Mfav <40%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Seer score on Mfav =>40%  to <50%", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Seer score on Mfav =>50%  to <60%", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Seer score on Mfav =>60%  to <70%", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Seer score on Mfav =>70%", points: 25 }, // Calibrated Rules (Bankers Dlive): +25 pts
  { description: "Algo Mfav support =>50 to <55%", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Algo Mfav support =>55 to <60%", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Algo Mfav support =>60", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Seer score on underdog >= 45%", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Seer primary predicts on underdog", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Algo support for Mfav > 50%", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Algo support for Mfav is 45-50%", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Algo for Mfav support <40%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Algo final prediction is 1X/X2", points: 25 }, // Calibrated Rules (Bankers Dlive): +25 pts
  { description: "Algo primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 }, // Calibrated Rules (Bankers Dlive): +15 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Sub pattern primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "1X2 Rating =>7", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 15 }, // Calibrated Rules (Bankers Dlive): +15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "TS difference <= 0.1", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Underdog has hidden strength", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog has hidden weakness", points: -25 }, // Calibrated Rules (Bankers Dlive): -25 pts
  { description: "M.fav has hidden strength", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "M.fav has hidden weakness", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Underdog has >= 5 more points on point system", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Both teams GS < 1.0", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both team GS => 1.8", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both teams GA >= 1.5", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 25 }, // Calibrated Rules (Bankers Dlive): +25 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav GS = Und Gs +-0.2", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 25 }, // Calibrated Rules (Bankers Dlive): +25 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 10 }, // Calibrated Rules (Bankers Dlive): +10 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "A match has GS=GS=GA=GA", points: -10 }, // Calibrated Rules (Bankers Dlive): -10 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // Calibrated Rules (Bankers Dlive): +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Underdog odds <= 2.80", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Odds for draw is < 3.0", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -10 }, // Calibrated Rules (Bankers Dlive): -10 pts
  { description: "LE : Underdog won the last encounter", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "LE Underdog won with 2+ goals", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog was away on LE and Won", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: -25 }, // Calibrated Rules (Bankers Dlive): -25 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Match is for Tournament", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Match is for Carabao Cup", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Mfav is playing at home", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Youth League U19", points: -25 },
  { description: "Youth League U20", points: -25 },
  { description: "Youth League U21", points: -25 },
  { description: "Youth League U23", points: 5 },
  { description: "Match has BB, T12, or BD opw < 10%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "TS difference >= 1.0", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -20 }, // Calibrated Rules (Bankers Dlive): -20 pts
  { description: "LE was a draw", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "LE was a draw + Mfav has hidden strength", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: -5 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 10 }, // Calibrated Rules (Bankers Dlive): +10 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both team L10 <= 5", points: -10 }, // Calibrated Rules (Bankers Dlive): -10 pts
  { description: "1X2 pred supports the underdog", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "1X2 supports the underdog", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "1X2 Rating 5.0 to 7.0", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 25 }, // Calibrated Rules (Bankers Dlive): +25 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "PAA Win probability >= 50%", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "PAA Win probability < 35%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "PHA Draw probability >= 35%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "PHA Underdog probability >= 35%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "SubPattern is G2E5", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // Calibrated Rules (Bankers Dlive): -20 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -20 }, // Calibrated Rules (Bankers Dlive): -20 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -20 }, // Calibrated Rules (Bankers Dlive): -20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // Calibrated Rules (Bankers Dlive): -20 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Match has Banned:Upset risk tag", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Match has Banned:Draw risk tag", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav L10(wins) >5 to 7", points: 20 }, // Calibrated Rules (Bankers Dlive): +20 pts
  { description: "Mfav L10(wins) >7", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Underdog L10(wins) >5 to 7", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog L10(wins) >7", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 10 }, // Calibrated Rules (Bankers Dlive): +10 pts
  { description: "Mfav was home and won last Encounter >3 goal", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav was Away and won last Encounter >3 goal", points: 25 }, // Calibrated Rules (Bankers Dlive): +25 pts
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 15 }, // Calibrated Rules (Bankers Dlive): +15 pts
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 5 }, // Calibrated Rules (Bankers Dlive): +5 pts
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules (Bankers Dlive): +10 pts
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 20 }, // Calibrated Rules (Bankers Dlive): +20 pts
  { description: "PHA for Mfav <40%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog odds >3.0", points: 5 }, // Calibrated Rules (Bankers Dlive): +25 pts
  { description: "Underdog odds <=2.7", points: -20 }, // Calibrated Rules (Bankers Dlive): -20 pts
  { description: "Mfav odds >= 2.5", points: -15 }, // Calibrated Rules (Bankers Dlive): -15 pts
  { description: "Both team TS =< 1.0", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "MFav TS <=1.2", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "PHA on draw =>30%", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "M.fav has hidden strength+Underdog has hidden strength", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog L10 <= 2", points: 30 }, // Calibrated Rules (Bankers Dlive): +30 pts
  { description: "Match has PHA TIE tag", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: -20 }, // Calibrated Rules (Bankers Dlive): -20 pts
  { description: "Points for Draw =>30 on the point system", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: 25 }, // Calibrated Rules (Bankers Dlive): +25 pts
  { description: "Underdog is at home", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog has hidden strength+Underdog is at home", points: -5 }, // Calibrated Rules (Bankers Dlive): -5 pts
  { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -30 }, // Calibrated Rules (Bankers Dlive): -30 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0", points: -5 },
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav", points: -5 },
], 'bankers_dlive', { preserveExact: true });

// ----------------------------------------------------------------------------
// Category: Bankers Jackpot | Target Objective: 'mfav_only'
// ----------------------------------------------------------------------------
export const TUESDAY_BANKERS_JACKPOT_RULES: TuesdayRuleItem[] = sanitizeRulePolarity([
  { description: "Algo supports Mfav >=45% to <50%", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Mfav GS > Underdog GS with >= 0.3", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Underdog GS > Mfav GS with >= 0.3", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Odds for underdog <= odds for draw but >= 3.0", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Seer score on draw <= 20%", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Seer score on draw >= 35% to <40%", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Seer score on draw >= 40%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Seer score on Mfav <40%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Seer score on Mfav =>40%  to <50%", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Seer score on Mfav =>50%  to <60%", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Seer score on Mfav =>60%  to <70%", points: 10 }, // Calibrated Rules (Bankers Jackpot): +10 pts
  { description: "Seer score on Mfav =>70%", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Algo Mfav support =>50 to <55%", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Algo Mfav support =>55 to <60%", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Algo Mfav support =>60", points: 20 }, // Calibrated Rules (Bankers Jackpot): +20 pts
  { description: "Seer score on underdog >= 45%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Seer primary predicts on underdog", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Algo support for Mfav > 50%", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Algo support for Mfav is 45-50%", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Algo for Mfav support <40%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Algo final prediction is 1X/X2", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Algo primary prediction supports the underdog", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 25 }, // Calibrated Rules (Bankers Jackpot): +25 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: 20 }, // Calibrated Rules (Bankers Jackpot): +20 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -20 }, // Calibrated Rules (Bankers Jackpot): -20 pts
  { description: "Sub pattern primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "1X2 Rating =>7", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 10 }, // Calibrated Rules (Bankers Jackpot): +10 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -25 }, // Calibrated Rules (Bankers Jackpot): -25 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "TS difference <= 0.1", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Underdog has hidden strength", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Underdog has hidden weakness", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "M.fav has hidden strength", points: 10 }, // Calibrated Rules (Bankers Jackpot): +10 pts
  { description: "M.fav has hidden weakness", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Underdog has >= 5 more points on point system", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Both teams GS < 1.0", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Both team GS => 1.8", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Both teams GA >= 1.5", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 20 }, // Calibrated Rules (Bankers Jackpot): +20 pts
  { description: "Mfav GS = Und Gs +-0.2", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 20 }, // Calibrated Rules (Bankers Jackpot): +20 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "A match has GS=GS=GA=GA", points: -10 }, // Calibrated Rules (Bankers Jackpot): -10 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Underdog odds <= 2.80", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Odds for draw is < 3.0", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -10 }, // Calibrated Rules (Bankers Jackpot): -10 pts
  { description: "LE : Underdog won the last encounter", points: -20 }, // Calibrated Rules (Bankers Jackpot): -20 pts
  { description: "LE Underdog won with 2+ goals", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Underdog was away on LE and Won", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Match is for Tournament", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Match is for Carabao Cup", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Mfav is playing at home", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Youth League U19", points: -15 },
  { description: "Youth League U20", points: -15 },
  { description: "Youth League U21", points: -15 },
  { description: "Youth League U23", points: 5 },
  { description: "Match has BB, T12, or BD opw < 10%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "TS difference >= 1.0", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -20 }, // Calibrated Rules (Bankers Jackpot): -20 pts
  { description: "LE was a draw", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "LE was a draw + Mfav has hidden strength", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Bankers Jackpot): -25 pts
  { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: -5 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Both team L10 <= 5", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "1X2 pred supports the underdog", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "1X2 supports the underdog", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "1X2 Rating 5.0 to 7.0", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "PAA Win probability >= 50%", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "PAA Win probability < 35%", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "PHA Draw probability >= 35%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "PHA Underdog probability >= 35%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "SubPattern is G2E5", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -20 }, // Calibrated Rules (Bankers Jackpot): -20 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -20 }, // Calibrated Rules (Bankers Jackpot): -20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Pha Underdog and Pha draw both >20%", points: -25 }, // Calibrated Rules (Bankers Jackpot): -25 pts
  { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Match has Banned:Upset risk tag", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Match has Banned:Draw risk tag", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Mfav L10 > Und L10 with >=3 points", points: 20 }, // Calibrated Rules (Bankers Jackpot): +20 pts
  { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Mfav L10(wins) >5 to 7", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Mfav L10(wins) >7", points: 25 }, // Calibrated Rules (Bankers Jackpot): +25 pts
  { description: "Underdog L10(wins) >5 to 7", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Underdog L10(wins) >7", points: -10 }, // Calibrated Rules (Bankers Jackpot): -10 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Mfav was home and won last Encounter <=1 goal", points: -10 }, // Calibrated Rules (Bankers Jackpot): -10 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Mfav was home and won last Encounter >3 goal", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Mfav was Away and won last Encounter >3 goal", points: 10 }, // Calibrated Rules (Bankers Jackpot): +10 pts
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 15 }, // Calibrated Rules (Bankers Jackpot): +15 pts
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules (Bankers Jackpot): +10 pts
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 5 }, // Calibrated Rules (Bankers Jackpot): +5 pts
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules (Bankers Jackpot): +10 pts
  { description: "PHA for Mfav <40%", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Underdog odds >3.0", points: 5 }, // Calibrated Rules (Bankers Jackpot): +10 pts
  { description: "Underdog odds <=2.7", points: -20 }, // Calibrated Rules (Bankers Jackpot): -20 pts
  { description: "Mfav odds >= 2.5", points: -15 }, // Calibrated Rules (Bankers Jackpot): -15 pts
  { description: "Both team TS =< 1.0", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "MFav TS <=1.2", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "PHA on draw =>30%", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "M.fav has hidden strength+Underdog has hidden strength", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -20 }, // Calibrated Rules (Bankers Jackpot): -20 pts
  { description: "Underdog L10 <= 2", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Match has PHA TIE tag", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: -20 }, // Calibrated Rules (Bankers Jackpot): -20 pts
  { description: "Points for Draw =>30 on the point system", points: -25 }, // Calibrated Rules (Bankers Jackpot): -25 pts
  { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: 30 }, // Calibrated Rules (Bankers Jackpot): +30 pts
  { description: "Underdog is at home", points: -5 }, // Calibrated Rules (Bankers Jackpot): -5 pts
  { description: "Underdog has hidden strength+Underdog is at home", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -30 }, // Calibrated Rules (Bankers Jackpot): -30 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0", points: -5 },
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav", points: -5 },
], 'bankers_jackpot', { preserveExact: true });

// ----------------------------------------------------------------------------
// Category: Value Picks | Target Objective: 'mfav_only'
// ----------------------------------------------------------------------------
export const TUESDAY_VALUE_PICKS_RULES: TuesdayRuleItem[] = sanitizeRulePolarity([
  { description: "Algo supports Mfav >=45% to <50%", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav GS > Underdog GS with >= 0.3", points: 25 }, // Calibrated Rules (Value Picks): +25 pts
  { description: "Underdog GS > Mfav GS with >= 0.3", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Odds for underdog <= odds for draw but >= 3.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Seer score on draw <= 20%", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Seer score on draw >= 35% to <40%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Seer score on draw >= 40%", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Seer score on Mfav <40%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Seer score on Mfav =>40%  to <50%", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Seer score on Mfav =>50%  to <60%", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Seer score on Mfav =>60%  to <70%", points: 20 }, // Calibrated Rules (Value Picks): +20 pts
  { description: "Seer score on Mfav =>70%", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Algo Mfav support =>50 to <55%", points: 10 }, // Calibrated Rules (Value Picks): +10 pts
  { description: "Algo Mfav support =>55 to <60%", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Algo Mfav support =>60", points: 15 }, // Calibrated Rules (Value Picks): +15 pts
  { description: "Seer score on underdog >= 45%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Seer primary predicts on underdog", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Algo support for Mfav > 50%", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Algo support for Mfav is 45-50%", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Algo for Mfav support <40%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Algo final prediction is 1X/X2", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Algo primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 }, // Calibrated Rules (Value Picks): +15 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: 10 }, // Calibrated Rules (Value Picks): +10 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -20 }, // Calibrated Rules (Value Picks): -20 pts
  { description: "Sub pattern primary prediction supports the underdog", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "1X2 Rating =>7", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -25 }, // Calibrated Rules (Value Picks): -25 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "TS difference <= 0.1", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog has hidden strength", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog has hidden weakness", points: -15 }, // Calibrated Rules (Value Picks): -15 pts
  { description: "M.fav has hidden strength", points: 20 }, // Calibrated Rules (Value Picks): +20 pts
  { description: "M.fav has hidden weakness", points: 20 }, // Calibrated Rules (Value Picks): +20 pts
  { description: "Underdog has >= 5 more points on point system", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Both teams GS < 1.0", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Both team GS => 1.8", points: 25 }, // Calibrated Rules (Value Picks): +25 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Both teams GA >= 1.5", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 15 }, // Calibrated Rules (Value Picks): +15 pts
  { description: "Mfav GS = Und Gs +-0.2", points: 25 }, // Calibrated Rules (Value Picks): +25 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 20 }, // Calibrated Rules (Value Picks): +20 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -10 }, // Calibrated Rules (Value Picks): -10 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "A match has GS=GS=GA=GA", points: -10 }, // Calibrated Rules (Value Picks): -10 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // Calibrated Rules (Value Picks): +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // Calibrated Rules (Value Picks): -15 pts
  { description: "Underdog odds <= 2.80", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Odds for draw is < 3.0", points: -25 }, // Calibrated Rules (Value Picks): -25 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "LE : Underdog won the last encounter", points: -20 }, // Calibrated Rules (Value Picks): -20 pts
  { description: "LE Underdog won with 2+ goals", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog was away on LE and Won", points: -25 }, // Calibrated Rules (Value Picks): -25 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Match is for Tournament", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Match is for Carabao Cup", points: -15 }, // Calibrated Rules (Value Picks): -15 pts
  { description: "Mfav is playing at home", points: 25 }, // Calibrated Rules (Value Picks): +25 pts
  { description: "Youth League U19", points: -5 },
  { description: "Youth League U20", points: -5 },
  { description: "Youth League U21", points: -5 },
  { description: "Youth League U23", points: 5 },
  { description: "Match has BB, T12, or BD opw < 10%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "TS difference >= 1.0", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -15 }, // Calibrated Rules (Value Picks): -15 pts
  { description: "LE was a draw", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "LE was a draw + Mfav has hidden strength", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: -5 }, // Calibrated Rules (Value Picks): -10 pts
  { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Both team L10 <= 5", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "1X2 pred supports the underdog", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "1X2 supports the underdog", points: -15 }, // Calibrated Rules (Value Picks): -15 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "1X2 Rating 5.0 to 7.0", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 15 }, // Calibrated Rules (Value Picks): +15 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "PAA Win probability >= 50%", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "PAA Win probability < 35%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "PHA Draw probability >= 35%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "PHA Underdog probability >= 35%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "SubPattern is G2E5", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -10 }, // Calibrated Rules (Value Picks): -10 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: -10 }, // Calibrated Rules (Value Picks): -10 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -15 }, // Calibrated Rules (Value Picks): -15 pts
  { description: "Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Match has Banned:Upset risk tag", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Match has Banned:Draw risk tag", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav L10 > Und L10 with >=3 points", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav L10(wins) >5 to 7", points: 25 }, // Calibrated Rules (Value Picks): +25 pts
  { description: "Mfav L10(wins) >7", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Underdog L10(wins) >5 to 7", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Underdog L10(wins) >7", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Mfav was home and won last Encounter >3 goal", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav was Away and won last Encounter >3 goal", points: 10 }, // Calibrated Rules (Value Picks): +10 pts
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules (Value Picks): +10 pts
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 15 }, // Calibrated Rules (Value Picks): +15 pts
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules (Value Picks): +10 pts
  { description: "PHA for Mfav <40%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog odds >3.0", points: 5 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Underdog odds <=2.7", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav odds >= 2.5", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Both team TS =< 1.0", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "MFav TS <=1.2", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "PHA on draw =>30%", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "M.fav has hidden strength+Underdog has hidden strength", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -25 }, // Calibrated Rules (Value Picks): -25 pts
  { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -25 }, // Calibrated Rules (Value Picks): -25 pts
  { description: "Underdog L10 <= 2", points: 5 }, // Calibrated Rules (Value Picks): +5 pts
  { description: "Match has PHA TIE tag", points: -20 }, // Calibrated Rules (Value Picks): -20 pts
  { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: -30 }, // Calibrated Rules (Value Picks): -30 pts
  { description: "Points for Draw =>30 on the point system", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: 30 }, // Calibrated Rules (Value Picks): +30 pts
  { description: "Underdog is at home", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog has hidden strength+Underdog is at home", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -5 }, // Calibrated Rules (Value Picks): -5 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0", points: -5 },
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav", points: -5 },
], 'value_picks', { preserveExact: true });

// ----------------------------------------------------------------------------
// Category: Underdog Upsets | Target Objective: 'underdog_only'
// ----------------------------------------------------------------------------
export const TUESDAY_UPSETS_RULES: TuesdayRuleItem[] = sanitizeRulePolarity([
  { description: "Algo supports Mfav >=45% to <50%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav GS > Underdog GS with >= 0.3", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Underdog GS > Mfav GS with >= 0.3", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Odds for underdog <= odds for draw but >= 3.0", points: 25 }, // Calibrated Rules (Upsets): +25 pts
  { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Seer score on draw <= 20%", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Seer score on draw >= 35% to <40%", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Seer score on draw >= 40%", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Seer score on Mfav <40%", points: 20 }, // Calibrated Rules (Upsets): +20 pts
  { description: "Seer score on Mfav =>40%  to <50%", points: -30 }, // Calibrated Rules (Upsets): -30 pts
  { description: "Seer score on Mfav =>50%  to <60%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Seer score on Mfav =>60%  to <70%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Seer score on Mfav =>70%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Algo Mfav support =>50 to <55%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Algo Mfav support =>55 to <60%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Algo Mfav support =>60", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Seer score on underdog >= 45%", points: 10 }, // Calibrated Rules (Upsets): +10 pts
  { description: "Seer primary predicts on underdog", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Algo support for Mfav > 50%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Algo support for Mfav is 45-50%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Algo for Mfav support <40%", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Algo final prediction is 1X/X2", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Algo primary prediction supports the underdog", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: -15 }, // Calibrated Rules (Upsets): -15 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: -10 }, // Calibrated Rules (Upsets): -10 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Sub pattern primary prediction supports the underdog", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "1X2 Rating =>7", points: -25 }, // Calibrated Rules (Upsets): -25 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "TS difference <= 0.1", points: 10 }, // Calibrated Rules (Upsets): +10 pts
  { description: "Underdog has hidden strength", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Underdog has hidden weakness", points: -20 }, // Calibrated Rules (Upsets): -20 pts
  { description: "M.fav has hidden strength", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "M.fav has hidden weakness", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Underdog has >= 5 more points on point system", points: 10 }, // Calibrated Rules (Upsets): +10 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: -30 }, // Calibrated Rules (Upsets): -30 pts
  { description: "Both teams GS < 1.0", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Both team GS => 1.8", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Both teams GA >= 1.5", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Mfav GS = Und Gs +-0.2", points: 25 }, // Calibrated Rules (Upsets): +25 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: -30 }, // Calibrated Rules (Upsets): -30 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: 25 }, // Calibrated Rules (Upsets): +25 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: 10 }, // Calibrated Rules (Upsets): +10 pts
  { description: "A match has GS=GS=GA=GA", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: -15 }, // Calibrated Rules (Upsets): -15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Underdog odds <= 2.80", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Odds for draw is < 3.0", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "LE : Underdog won the last encounter", points: 25 }, // Calibrated Rules (Upsets): +25 pts
  { description: "LE Underdog won with 2+ goals", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Underdog was away on LE and Won", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Match is for Tournament", points: -10 }, // Calibrated Rules (Upsets): -10 pts
  { description: "Match is for Carabao Cup", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Mfav is playing at home", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Youth League U19", points: 30 },
  { description: "Youth League U20", points: 30 },
  { description: "Youth League U21", points: 30 },
  { description: "Youth League U23", points: 5 },
  { description: "Match has BB, T12, or BD opw < 10%", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "TS difference >= 1.0", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: 25 }, // Calibrated Rules (Upsets): +25 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "LE was a draw", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Mfav L10 = Und L10", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "LE was a draw + Mfav has hidden strength", points: 20 }, // Calibrated Rules (Upsets): +20 pts
  { description: "Underdog has higher L10 than Mfav", points: 10 }, // Calibrated Rules (Upsets): +10 pts
  { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: 20 }, // Calibrated Rules (Upsets): +20 pts
  { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Both team L10 <= 5", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "1X2 pred supports the underdog", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "1X2 supports the underdog", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "1X2 Rating < 3.0", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "1X2 Rating 5.0 to 7.0", points: -25 }, // Calibrated Rules (Upsets): -25 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: -30 }, // Calibrated Rules (Upsets): -30 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "PAA Win probability >= 50%", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "PAA Win probability < 35%", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "PHA Draw probability >= 35%", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "PHA Underdog probability >= 35%", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "SubPattern is G2E5", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: 20 }, // Calibrated Rules (Upsets): +20 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: 25 }, // Calibrated Rules (Upsets): +25 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Pha Underdog and Pha draw both >20%", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -30 }, // Calibrated Rules (Upsets): -30 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Match has Banned:Upset risk tag", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Match has Banned:Draw risk tag", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: 20 }, // Calibrated Rules (Upsets): +20 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Mfav L10 > Und L10 with >=3 points", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav L10(wins) >5 to 7", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav L10(wins) >7", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Underdog L10(wins) >5 to 7", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Underdog L10(wins) >7", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Mfav was home and won last Encounter <=1 goal", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: -30 }, // Calibrated Rules (Upsets): -30 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav was home and won last Encounter >3 goal", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav was Away and won last Encounter >3 goal", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: -15 }, // Calibrated Rules (Upsets): -15 pts
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: -30 }, // Calibrated Rules (Upsets): -30 pts
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 }, // Calibrated Rules (Upsets): -10 pts
  { description: "PHA for Mfav <40%", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Underdog odds >3.0", points: 5 }, // Calibrated Rules (Upsets): +25 pts
  { description: "Underdog odds <=2.7", points: -10 }, // Calibrated Rules (Upsets): -10 pts
  { description: "Mfav odds >= 2.5", points: -15 }, // Calibrated Rules (Upsets): -15 pts
  { description: "Both team TS =< 1.0", points: 10 }, // Calibrated Rules (Upsets): +10 pts
  { description: "MFav TS <=1.2", points: 25 }, // Calibrated Rules (Upsets): +25 pts
  { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "PHA on draw =>30%", points: 20 }, // Calibrated Rules (Upsets): +20 pts
  { description: "M.fav has hidden strength+Underdog has hidden strength", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: -30 }, // Calibrated Rules (Upsets): -30 pts
  { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Underdog L10 <= 2", points: -5 }, // Calibrated Rules (Upsets): -5 pts
  { description: "Match has PHA TIE tag", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Points for Draw =>30 on the point system", points: 5 }, // Calibrated Rules (Upsets): +5 pts
  { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: -10 }, // Calibrated Rules (Upsets): -10 pts
  { description: "Underdog is at home", points: 15 }, // Calibrated Rules (Upsets): +15 pts
  { description: "Underdog has hidden strength+Underdog is at home", points: 20 }, // Calibrated Rules (Upsets): +20 pts
  { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: 30 }, // Calibrated Rules (Upsets): +30 pts
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0", points: 5 },
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav", points: 5 },
], 'upsets', { preserveExact: true });

// ----------------------------------------------------------------------------
// Category: Best of the Best | Target Objective: 'mfav_only'
// ----------------------------------------------------------------------------
export const TUESDAY_BOTB_RULES: TuesdayRuleItem[] = sanitizeRulePolarity([
{ description: "Low Favorite Odds (< 1.80)", points: 20 }, // Calibrated Rules: +20 pts
  { description: "Algo support for Mfav > 50%", points: 20 }, // Calibrated Rules: +20 pts
  { description: "Odds difference >= 1.50", points: 20 }, // Calibrated Rules: +20 pts
  { description: "Underdog odds <= 2.80", points: -30 }, // Calibrated Rules: -30 pts
  { description: "Seer score on underdog >= 45%", points: -20 }, // Calibrated Rules: -20 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules: -5 pts
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 }, // Calibrated Rules: -5 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was home and won last Encounter >3 goal", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was Away and won last Encounter >3 goal", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 }, // Calibrated Rules: +10 pts
  { description: "PHA for Mfav <40%", points: -15 }, // Calibrated Rules: -15 pts
  { description: "Underdog odds >3.0", points: 5 }, // Calibrated Rules: +10 pts
  { description: "Underdog odds <=2.7", points: -20 }, // Calibrated Rules: -20 pts
  { description: "Mfav odds >= 2.5", points: -15 }, // Calibrated Rules: -15 pts
  { description: "Both team TS =< 1.0", points: -15 }, // Calibrated Rules: -15 pts
  { description: "SubPattern is G2E5", points: -30 }, // Calibrated Rules: -30 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 5 }, // Calibrated Rules: +5 pts
  { description: "MFav TS <=1.2", points: -10 }, // Calibrated Rules: -10 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: -15 }, // Calibrated Rules: -15 pts
  { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -25 }, // Calibrated Rules: -25 pts
  { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -10 }, // Calibrated Rules: -10 pts
  { description: "Both team GS => 1.8", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Underdog has hidden strength", points: -30 }, // Calibrated Rules: -30 pts
  { description: "1X2 Rating < 3.0", points: -15 }, // Calibrated Rules: -15 pts
  { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -15 }, // Calibrated Rules: -15 pts
  { description: "Seer score on Mfav <40%", points: -10 }, // Calibrated Rules: -10 pts
  { description: "Seer score on Mfav =>40%  to <50%", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Seer score on Mfav =>50%  to <60%", points: 15 }, // Calibrated Rules: +15 pts
  { description: "Seer score on Mfav =>60%  to <70%", points: 20 }, // Calibrated Rules: +20 pts
  { description: "Seer score on Mfav =>70%", points: 25 }, // Calibrated Rules: +25 pts
  { description: "Underdog has hidden weakness", points: -10 }, // Calibrated Rules: -10 pts
  { description: "Mfav GS = Und Gs +-0.2", points: 5 }, // Calibrated Rules: +5 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 5 }, // Calibrated Rules: +5 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 5 }, // Calibrated Rules: +5 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 }, // Calibrated Rules: +5 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 5 }, // Calibrated Rules: +5 pts
  { description: "Underdog has >= 5 more points on point system", points: -5 }, // Calibrated Rules: -5 pts
  { description: "Match has PHA TIE tag", points: -30 }, // Calibrated Rules: -20 pts
  { description: "M.fav has hidden strength+Underdog has hidden strength", points: -15 }, // Calibrated Rules: -15 pts
  { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -15 }, // Calibrated Rules: -15 pts
  { description: "Seer score on draw >= 35% to <40%", points: -30 }, // Calibrated Rules: -30 pts
  { description: "Seer score on draw >= 40%", points: -25 }, // Calibrated Rules: -25 pts
  { description: "PHA on draw =>30%", points: -25 }, // Calibrated Rules: -25 pts
  { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 20 }, // Calibrated Rules: +20 pts
  { description: "Algo Mfav support =>50 to <55%", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Algo Mfav support =>55 to <60%", points: 15 }, // Calibrated Rules: +15 pts
  { description: "Algo Mfav support =>60", points: 20 }, // Calibrated Rules: +20 pts
  { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: -20 }, // Calibrated Rules: -20 pts
  { description: "Underdog GS > Mfav GS with >= 0.3", points: -10 }, // Calibrated Rules: -10 pts
  { description: "Mfav GS > Underdog GS with >= 0.3", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Algo supports Mfav >=45% to <50%", points: 10 }, // Calibrated Rules: +10 pts
  { description: "Algo support for Mfav is 45-50%", points: 10 }, // Calibrated Rules: +10 pts,
  { description: "Underdog has higher L10 than Mfav", points: -5 },
  { description: "Mfav L10 = Und L10", points: -5 },
  { description: "LE was a draw + Mfav L10 = Und L10", points: -5 },
  { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: -5 },
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0", points: -5 },
  { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav", points: -5 },
], 'botb_best', { preserveExact: true });

export const TUESDAY_VALUE_BETS_RULES: TuesdayRuleItem[] = buildValueBetsRulesFromT12(TUESDAY_TOP_12_RULES);

export const TUESDAY_RULES_MAP: Record<string, { description: string; points: number }[]> = {
    top_12_value: TUESDAY_TOP_12_RULES,
    top_10_value: TUESDAY_TOP_12_RULES,
    best_bet: TUESDAY_BEST_BET_RULES,
    bankers_dlive: TUESDAY_BANKERS_DLIVE_RULES,
    bankers_jackpot: TUESDAY_BANKERS_JACKPOT_RULES,
    value_picks: TUESDAY_VALUE_PICKS_RULES,
    value_bets: TUESDAY_VALUE_BETS_RULES,
    value_bet: TUESDAY_VALUE_BETS_RULES,
    upsets: TUESDAY_UPSETS_RULES,
    botb_best: TUESDAY_BOTB_RULES,
};

export const TUESDAY_METADATA: DayMetadata = DAY_METADATA.tuesday;

/**
 * Tuesday OPW Default Category Settings
 */
let tuesdaySettingsCache: Record<string, OptimizedCategorySettings> | null = null;
export function getTuesdayCategorySettings(): Record<string, OptimizedCategorySettings> {
    if (tuesdaySettingsCache) return tuesdaySettingsCache;
    const top12Config: OptimizedCategorySettings = {
        name: "Top 12 Value (Tuesday)",
        description: "Tuesday Top 12 - Statistically sound 1X hedged value picks with proven safety.",
        baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
        baseWeightIntervals: [
            { id: '1', min: 60, max: 100, points: 45, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 40, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 35, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 25, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 10, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 5, metric: 'pha_market_fav' }
        ],
        rules: populateCategoryWithMasterRules(TUESDAY_TOP_12_RULES, 'mfav_draw', 'top_12_value', 'tuesday', { preserveExact: true })
    };

    const settings: Record<string, OptimizedCategorySettings> = {
        top_12_value: top12Config,
        top_10_value: top12Config,
        best_bet: {
            name: "Best Bets (Tuesday)",
            description: "Tuesday Best Bets - Peak high-conviction favorites.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 45, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 40, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 35, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 25, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 10, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 5, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(TUESDAY_BEST_BET_RULES, 'mfav_only', 'best_bet', 'tuesday', { preserveExact: true })
        },
        bankers_dlive: {
            name: "Bankers Dlive (Tuesday)",
            description: "Tuesday Bankers Dlive selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(TUESDAY_BANKERS_DLIVE_RULES, 'mfav_only', 'bankers_dlive', 'tuesday', { preserveExact: true })
        },
        bankers_jackpot: {
            name: "Bankers Jackpot (Tuesday)",
            description: "Tuesday Bankers Jackpot selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
                { id: '3', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(TUESDAY_BANKERS_JACKPOT_RULES, 'mfav_only', 'bankers_jackpot', 'tuesday', { preserveExact: true })
        },
        upsets: {
            name: "Upsets (Tuesday)",
            description: "Tuesday Underdog Upsets - High value underdogs based on pattern support.",
            baseLogic: "Points based on Underdog's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 45, max: 100, points: 30, metric: 'pha_underdog' },
                { id: '2', min: 35, max: 44.99, points: 25, metric: 'pha_underdog' },
                { id: '3', min: 25, max: 34.99, points: 20, metric: 'pha_underdog' },
                { id: '4', min: 0, max: 24.99, points: 10, metric: 'pha_underdog' }
            ],
            rules: populateCategoryWithMasterRules(TUESDAY_UPSETS_RULES, 'underdog_only', 'upsets', 'tuesday', { preserveExact: true })
        },
        value_picks: {
            name: "Value Picks (Tuesday)",
            description: "Tuesday Value Picks (Mfav must win, odds 2.0-2.5).",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 50, max: 100, points: 30, metric: 'pha_market_fav' },
                { id: '2', min: 0, max: 49.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(TUESDAY_VALUE_PICKS_RULES, 'mfav_only', 'value_picks', 'tuesday', { preserveExact: true })
        },
        value_bets: {
            name: "Value Bets (Tuesday)",
            description: "Tuesday Value Bets - Independent value bet selections (Mfav win or draw).",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 60, max: 100, points: 45, metric: 'pha_market_fav' },
                { id: '2', min: 50, max: 59.99, points: 40, metric: 'pha_market_fav' },
                { id: '3', min: 45, max: 49.99, points: 35, metric: 'pha_market_fav' },
                { id: '4', min: 40, max: 44.99, points: 25, metric: 'pha_market_fav' },
                { id: '5', min: 34, max: 39.99, points: 10, metric: 'pha_market_fav' },
                { id: '6', min: 0, max: 33.99, points: 5, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(TUESDAY_VALUE_BETS_RULES, 'mfav_draw', 'value_bets', 'tuesday', { preserveExact: true })
        },
        botb_best: {
            name: "BOTB (Tuesday)",
            description: "Tuesday Best of the Best selections.",
            baseLogic: "Points based on Market Favorite's Primary Pattern PHA %.",
            baseWeightIntervals: [
                { id: '1', min: 55, max: 100, points: 35, metric: 'pha_market_fav' },
                { id: '2', min: 0, max: 54.99, points: 15, metric: 'pha_market_fav' }
            ],
            rules: populateCategoryWithMasterRules(TUESDAY_BOTB_RULES, 'mfav_only', 'botb_best', 'tuesday', { preserveExact: true })
        }
    };
    tuesdaySettingsCache = settings;
    return settings;
}

/**
 * Detailed evaluation function for Tuesday fixtures.
 */
export function evaluateTuesdayScoreDetailed(
    stats: MatchEvaluationStats, 
    match: Match, 
    categorySettings?: OptimizedCategorySettings
): {
    totalScore: number;
    rulesHit: { description: string; points: number }[];
    activeHedgingProtocol: string | null;
    optimizedPrediction: string;
} {
    const catNameLower = (categorySettings?.name || stats.evalCategoryId || '').toLowerCase();
    if (catNameLower.includes('banker_draw') || catNameLower.includes('banker draw')) {
        return {
            totalScore: 0,
            rulesHit: [],
            activeHedgingProtocol: null,
            optimizedPrediction: 'X'
        };
    }

    const rulesToUse = categorySettings?.rules || [];
    const triggeredDescriptions = evaluateAllCatalogTriggers(stats, match);
    const rulesHit: { description: string; points: number }[] = [];
    const evaluatedDescriptions = new Set<string>();
    let totalScore = 0;

    rulesToUse.forEach(rule => {
        if (rule.description && !evaluatedDescriptions.has(rule.description) && triggeredDescriptions.has(rule.description)) {
            evaluatedDescriptions.add(rule.description);
            const pts = rule.points;
            rulesHit.push({ description: rule.description, points: pts });
            totalScore += pts;
        }
    });

    triggeredDescriptions.forEach(desc => {
        if (desc && !evaluatedDescriptions.has(desc)) {
            evaluatedDescriptions.add(desc);
            rulesHit.push({ description: desc, points: 5 });
            totalScore += 5;
        }
    });

    let activeHedgingProtocol: string | null = null;
    let optimizedPrediction = match.finalPrediction || match.rawPrediction || "1";

    return {
        totalScore,
        rulesHit,
        activeHedgingProtocol,
        optimizedPrediction
    };
}
