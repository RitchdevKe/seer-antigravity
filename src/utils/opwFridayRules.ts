// ============================================================================
// DEDICATED FRIDAY CALIBRATED RULE ARRAYS (Day-Specific Isolation)
// Generated: 9/26/2026, 11:51:28 AM
// ============================================================================

import { sanitizeRulePolarity } from './opwCatalog';

export interface FridayRuleItem {
  description: string;
  points: number;
}

export const FRIDAY_TOP_12_RULES: FridayRuleItem[] = sanitizeRulePolarity([
  { description: "Seer score on draw <= 20%", points: 10 }, // +10 pts
  { description: "Seer score on draw >= 35%", points: -20 }, // -20 pts
  { description: "Seer score on underdog >= 45%", points: -20 }, // -20 pts
  { description: "Seer primary predicts on underdog", points: -20 }, // -20 pts
  { description: "Algo support for Mfav > 50%", points: 10 }, // +10 pts
  { description: "Algo support for Mfav is 45-50%", points: 10 }, // +10 pts
  { description: "Algo for Mfav support <40%", points: -10 }, // -10 pts
  { description: "Algo final prediction is 1X/X2", points: 5 }, // +5 pts
  { description: "Algo primary prediction supports the underdog", points: -20 }, // -20 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 10 }, // +10 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 10 }, // +10 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: -10 }, // -10 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -10 }, // -10 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -15 }, // -15 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: 10 }, // +10 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 }, // -20 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -15 }, // -15 pts
  { description: "Sub pattern primary prediction supports the underdog", points: -20 }, // -20 pts
  { description: "1X2 Rating =>7", points: -20 }, // -20 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 20 }, // +20 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 20 }, // +20 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 5 }, // +5 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -20 }, // -20 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: 15 }, // +15 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: -25 }, // -25 pts
  { description: "TS difference <= 0.1", points: 20 }, // +20 pts
  { description: "Underdog has hidden strength", points: -20 }, // -20 pts
  { description: "Underdog has hidden weakness", points: -15 }, // -15 pts
  { description: "M.fav has hidden strength", points: 20 }, // +20 pts
  { description: "M.fav has hidden weakness", points: -20 }, // -20 pts
  { description: "Underdog has >= 5 more points on point system", points: -5 }, // -5 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 5 }, // +5 pts
  { description: "Both teams GS < 1.0", points: 15 }, // +15 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: 10 }, // +10 pts
  { description: "Both team GS => 1.8", points: -20 }, // -20 pts
  { description: "Both teams GA > GS", points: 5 }, // +5 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: 15 }, // +15 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: 5 }, // +5 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: 5 }, // +5 pts
  { description: "Both teams GA >= 1.5", points: 10 }, // +10 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 5 }, // +5 pts
  { description: "Mfav GS = Und Gs +-0.2", points: -15 }, // -15 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 5 }, // +5 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: -20 }, // -20 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 }, // +5 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 20 }, // +20 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 5 }, // +5 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -25 }, // -25 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: -10 }, // -10 pts
  { description: "A match has GS=GS=GA=GA", points: 15 }, // +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // -15 pts
  { description: "Underdog odds <= 2.80", points: -10 }, // -10 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: 20 }, // +20 pts
  { description: "Odds for draw is < 3.0", points: 15 }, // +15 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 }, // -15 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: 20 }, // +20 pts
  { description: "LE : Underdog won the last encounter", points: -20 }, // -20 pts
  { description: "LE Underdog won with 2+ goals", points: -20 }, // -20 pts
  { description: "Underdog was away on LE and Won", points: -15 }, // -15 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: -20 }, // -20 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: 20 }, // +20 pts
  { description: "Match belong to israel leagues", points: 10 }, // +10 pts
  { description: "Match belong to African leagues", points: -20 }, // -20 pts
  { description: "Match belong to England Amateur", points: -10 },
  { description: "Match belong to norway 3rd division", points: -10 },
  { description: "Youth League (U21,U23,U20,U19)", points: -10 }, // -10 pts
  { description: "Match has BB, T12, or BD opw < 10%", points: -10 }, // -10 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -20 }, // -20 pts
  { description: "TS difference >= 1.0", points: 5 }, // +5 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: -20 }, // -20 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -15 }, // -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 }, // -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -20 }, // -20 pts
  { description: "LE was a draw", points: -15 }, // -15 pts
  { description: "Mfav L10 = Und L10", points: -15 }, // -15 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: 15 }, // +15 pts
  { description: "LE was a draw + Mfav has hidden strength", points: 20 }, // +20 pts
  { description: "Underdog has higher L10 than Mfav", points: 5 }, // +5 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: -15 }, // -15 pts
  { description: "1X2 Rating 5.0 to 7.0", points: -20 }, // -20 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 20 }, // +20 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 5 }, // +5 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 5 }, // +5 pts
  { description: "PAA Win probability >= 50%", points: -20 }, // -20 pts
  { description: "PAA Win probability < 35%", points: -15 }, // -15 pts
  { description: "PHA Draw probability >= 35%", points: 15 }, // +15 pts
  { description: "PHA Underdog probability >= 35%", points: 5 }, // +5 pts
  { description: "PHA is a tie between outcomes", points: 10 }, // +10 pts
  { description: "SubPattern is G2E5", points: 10 }, // +10 pts
  { description: "Odds for underdog >= 3.0", points: 10 }, // +10 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: 20 }, // +20 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -20 }, // -20 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: 20 }, // +20 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: 20 }, // +20 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // -20 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -20 }, // -20 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (Volatile match)", points: 5 }, // +5 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 }, // -20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: 5 }, // +5 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: -15 }, // -15 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: 10 }, // +10 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // -20 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -15 }, // -15 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -15 }, // -15 pts
  { description: "Match belongs to European countries league 3 (III).", points: -10 }, // -10 pts,
  { description: "Match has Banned:Upset risk tag", points: -5 }, // -5 pts
  { description: "Match has Banned:Draw risk tag", points: -5 }, // -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -5 },
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 10 },
  { description: "Mfav was home and won last Encounter >3 goal", points: 10 },
  { description: "Mfav was Away and won last Encounter >3 goal", points: 10 },
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
], 'top_12_value');

export const FRIDAY_BEST_BET_RULES: FridayRuleItem[] = sanitizeRulePolarity([
  { description: "Seer score on draw <= 20%", points: 15 }, // +15 pts
  { description: "Seer score on draw >= 35%", points: 5 }, // +5 pts
  { description: "Seer score on underdog >= 45%", points: 20 }, // +20 pts
  { description: "Seer primary predicts on underdog", points: -20 }, // -20 pts
  { description: "Algo support for Mfav > 50%", points: 10 }, // +10 pts
  { description: "Algo support for Mfav is 45-50%", points: 10 }, // +10 pts
  { description: "Algo for Mfav support <40%", points: -15 }, // -15 pts
  { description: "Algo final prediction is 1X/X2", points: 20 }, // +20 pts
  { description: "Algo primary prediction supports the underdog", points: -20 }, // -20 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 5 }, // +5 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 20 }, // +20 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: 20 }, // +20 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 }, // -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -10 }, // -10 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -10 }, // -10 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 }, // -20 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -20 }, // -20 pts
  { description: "Sub pattern primary prediction supports the underdog", points: 10 }, // +10 pts
  { description: "1X2 Rating =>7", points: -10 }, // -10 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 20 }, // +20 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 15 }, // +15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 15 }, // +15 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -25 }, // -25 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -10 }, // -10 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: -25 }, // -25 pts
  { description: "TS difference <= 0.1", points: -10 }, // -10 pts
  { description: "Underdog has hidden strength", points: -15 }, // -15 pts
  { description: "Underdog has hidden weakness", points: -15 }, // -15 pts
  { description: "M.fav has hidden strength", points: 25 }, // +25 pts
  { description: "M.fav has hidden weakness", points: -15 }, // -15 pts
  { description: "Underdog has >= 5 more points on point system", points: -20 }, // -20 pts
  { description: "Both teams GS < 1.0", points: -10 }, // -10 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: -10 }, // -10 pts
  { description: "Both team GS => 1.8", points: 25 }, // +25 pts
  { description: "Both teams GA > GS", points: -20 }, // -20 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: -10 }, // -10 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: 5 }, // +5 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -15 }, // -15 pts
  { description: "Both teams GA >= 1.5", points: 15 }, // +15 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: -10 }, // -10 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 20 }, // +20 pts
  { description: "Mfav GS = Und Gs +-0.2", points: -15 }, // -15 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: -10 }, // -10 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 25 }, // +25 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: -15 }, // -15 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: -10 }, // -10 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 15 }, // +15 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -15 }, // -15 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: 20 }, // +20 pts
  { description: "A match has GS=GS=GA=GA", points: -10 }, // -10 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // -15 pts
  { description: "Underdog odds <= 2.80", points: -15 }, // -15 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // -5 pts
  { description: "Odds for draw is < 3.0", points: -15 }, // -15 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 }, // -15 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -10 }, // -10 pts
  { description: "LE : Underdog won the last encounter", points: -20 }, // -20 pts
  { description: "LE Underdog won with 2+ goals", points: -20 }, // -20 pts
  { description: "Underdog was away on LE and Won", points: -20 }, // -20 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: 10 }, // +10 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -20 }, // -20 pts
  { description: "Match belong to israel leagues", points: 5 }, // +5 pts
  { description: "Match belong to African leagues", points: -25 }, // -25 pts
  { description: "Match belong to England Amateur", points: -10 },
  { description: "Match belong to norway 3rd division", points: -10 },
  { description: "Youth League (U21,U23,U20,U19)", points: -15 }, // -15 pts
  { description: "Match has BB, T12, or BD opw < 10%", points: -10 }, // -10 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -20 }, // -20 pts
  { description: "TS difference >= 1.0", points: -10 }, // -10 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: 15 }, // +15 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -15 }, // -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 }, // -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -20 }, // -20 pts
  { description: "LE was a draw", points: -15 }, // -15 pts
  { description: "Mfav L10 = Und L10", points: -15 }, // -15 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -20 }, // -20 pts
  { description: "LE was a draw + Mfav has hidden strength", points: 15 }, // +15 pts
  { description: "Underdog has higher L10 than Mfav", points: -20 }, // -20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: -15 }, // -15 pts
  { description: "1X2 Rating < 3.0", points: -10 }, // -10 pts
  { description: "1X2 Rating 5.0 to 7.0", points: 5 }, // +5 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: -10 }, // -10 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 20 }, // +20 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: -5 }, // -5 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: -10 }, // -10 pts
  { description: "PAA Win probability >= 50%", points: -15 }, // -15 pts
  { description: "PAA Win probability < 35%", points: -15 }, // -15 pts
  { description: "PHA Draw probability >= 35%", points: -15 }, // -15 pts
  { description: "PHA Underdog probability >= 35%", points: -15 }, // -15 pts
  { description: "PHA is a tie between outcomes", points: -10 }, // -10 pts
  { description: "SubPattern is G2E5", points: 5 }, // +5 pts
  { description: "Odds for underdog >= 3.0", points: -15 }, // -15 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -20 }, // -20 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -20 }, // -20 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -20 }, // -20 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -20 }, // -20 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // -20 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -20 }, // -20 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (Volatile match)", points: -20 }, // -20 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 }, // -20 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -20 }, // -20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -15 }, // -15 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: -15 }, // -15 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -20 }, // -20 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // -20 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -15 }, // -15 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -15 }, // -15 pts
  { description: "Match belongs to European countries league 3 (III).", points: -10 }, // -10 pts,
  { description: "Match has Banned:Upset risk tag", points: -5 }, // -5 pts
  { description: "Match has Banned:Draw risk tag", points: -5 }, // -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -5 },
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 10 },
  { description: "Mfav was home and won last Encounter >3 goal", points: 10 },
  { description: "Mfav was Away and won last Encounter >3 goal", points: 10 },
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
], 'best_bet');

export const FRIDAY_BANKERS_DLIVE_RULES: FridayRuleItem[] = sanitizeRulePolarity([
  { description: "Seer score on draw <= 20%", points: 15 }, // +15 pts
  { description: "Seer score on draw >= 35%", points: 20 }, // +20 pts
  { description: "Seer score on underdog >= 45%", points: -20 }, // -20 pts
  { description: "Seer primary predicts on underdog", points: -20 }, // -20 pts
  { description: "Algo support for Mfav > 50%", points: -10 }, // -10 pts
  { description: "Algo support for Mfav is 45-50%", points: 20 }, // +20 pts
  { description: "Algo for Mfav support <40%", points: -15 }, // -15 pts
  { description: "Algo final prediction is 1X/X2", points: 15 }, // +15 pts
  { description: "Algo primary prediction supports the underdog", points: -20 }, // -20 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 20 }, // +20 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 10 }, // +10 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: 20 }, // +20 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 }, // -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: 5 }, // +5 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -20 }, // -20 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: 10 }, // +10 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -20 }, // -20 pts
  { description: "Sub pattern primary prediction supports the underdog", points: 15 }, // +15 pts
  { description: "1X2 Rating =>7", points: -25 }, // -25 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 20 }, // +20 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 15 }, // +15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 10 }, // +10 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -15 }, // -15 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -10 }, // -10 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: -25 }, // -25 pts
  { description: "Underdog has hidden strength", points: -10 }, // -10 pts
  { description: "Underdog has hidden weakness", points: -15 }, // -15 pts
  { description: "M.fav has hidden strength", points: 15 }, // +15 pts
  { description: "M.fav has hidden weakness", points: 5 }, // +5 pts
  { description: "Underdog has >= 5 more points on point system", points: 20 }, // +20 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: -25 }, // -25 pts
  { description: "Both teams GS < 1.0", points: 20 }, // +20 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: 20 }, // +20 pts
  { description: "Both team GS => 1.8", points: 20 }, // +20 pts
  { description: "Both teams GA > GS", points: 20 }, // +20 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: 20 }, // +20 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: 15 }, // +15 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -10 }, // -10 pts
  { description: "Both teams GA >= 1.5", points: 15 }, // +15 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 15 }, // +15 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: -25 }, // -25 pts
  { description: "Mfav GS = Und Gs +-0.2", points: -15 }, // -15 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: -10 }, // -10 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: -15 }, // -15 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: -15 }, // -15 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: -10 }, // -10 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: -20 }, // -20 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: 20 }, // +20 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: 10 }, // +10 pts
  { description: "A match has GS=GS=GA=GA", points: -10 }, // -10 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // -15 pts
  { description: "Underdog odds <= 2.80", points: -15 }, // -15 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // -5 pts
  { description: "Odds for draw is < 3.0", points: -15 }, // -15 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 }, // -15 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -10 }, // -10 pts
  { description: "LE : Underdog won the last encounter", points: -20 }, // -20 pts
  { description: "LE Underdog won with 2+ goals", points: -20 }, // -20 pts
  { description: "Underdog was away on LE and Won", points: -20 }, // -20 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: 10 }, // +10 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: 20 }, // +20 pts
  { description: "Match belong to israel leagues", points: 5 }, // +5 pts
  { description: "Match belong to African leagues", points: 20 }, // +20 pts
  { description: "Match belong to England Amateur", points: -10 },
  { description: "Match belong to norway 3rd division", points: -10 },
  { description: "Youth League (U21,U23,U20,U19)", points: -15 }, // -15 pts
  { description: "Match has BB, T12, or BD opw < 10%", points: -10 }, // -10 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -20 }, // -20 pts
  { description: "TS difference >= 1.0", points: -25 }, // -25 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: 10 }, // +10 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -15 }, // -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 }, // -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -20 }, // -20 pts
  { description: "LE was a draw", points: -15 }, // -15 pts
  { description: "Mfav L10 = Und L10", points: -15 }, // -15 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -15 }, // -15 pts
  { description: "LE was a draw + Mfav has hidden strength", points: 15 }, // +15 pts
  { description: "Underdog has higher L10 than Mfav", points: 20 }, // +20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: -15 }, // -15 pts
  { description: "1X2 Rating < 3.0", points: 20 }, // +20 pts
  { description: "1X2 Rating 5.0 to 7.0", points: -25 }, // -25 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 15 }, // +15 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 20 }, // +20 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 15 }, // +15 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 20 }, // +20 pts
  { description: "PAA Win probability >= 50%", points: 15 }, // +15 pts
  { description: "PAA Win probability < 35%", points: -15 }, // -15 pts
  { description: "PHA Draw probability >= 35%", points: -15 }, // -15 pts
  { description: "PHA Underdog probability >= 35%", points: 10 }, // +10 pts
  { description: "PHA is a tie between outcomes", points: -10 }, // -10 pts
  { description: "SubPattern is G2E5", points: 5 }, // +5 pts
  { description: "Odds for underdog >= 3.0", points: -15 }, // -15 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -20 }, // -20 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -20 }, // -20 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: 10 }, // +10 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -20 }, // -20 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // -20 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -20 }, // -20 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (Volatile match)", points: 15 }, // +15 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 }, // -20 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -20 }, // -20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: 5 }, // +5 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: -15 }, // -15 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -10 }, // -10 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // -20 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -15 }, // -15 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -15 }, // -15 pts
  { description: "Match belongs to European countries league 3 (III).", points: -10 }, // -10 pts,
  { description: "Match has Banned:Upset risk tag", points: -5 }, // -5 pts
  { description: "Match has Banned:Draw risk tag", points: -5 }, // -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -5 },
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 10 },
  { description: "Mfav was home and won last Encounter >3 goal", points: 10 },
  { description: "Mfav was Away and won last Encounter >3 goal", points: 10 },
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
], 'bankers_dlive');

// Trigger points for this category are intentionally identical to Top 12 (user directive).
export const FRIDAY_BANKERS_JACKPOT_RULES: FridayRuleItem[] = FRIDAY_TOP_12_RULES.map(r => ({ ...r }));

// Trigger points for this category are intentionally identical to Top 12 (user directive).
export const FRIDAY_VALUE_PICKS_RULES: FridayRuleItem[] = FRIDAY_TOP_12_RULES.map(r => ({ ...r }));

export const FRIDAY_UPSETS_RULES: FridayRuleItem[] = sanitizeRulePolarity([
  { description: "Odds for underdog >= 3.0", points: 15 }, // +15 pts
  { description: "Seer score on draw <= 20%", points: 25 }, // +25 pts
  { description: "Sub pattern primary prediction supports the underdog", points: 15 }, // +15 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: 10 }, // +10 pts
  { description: "Underdog has >= 5 more points on point system", points: -25 }, // -25 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: 15 }, // +15 pts
  { description: "1X2 Rating < 3.0", points: 10 }, // +10 pts
  { description: "PAA Win probability >= 50%", points: -15 }, // -15 pts
  { description: "Underdog has higher L10 than Mfav", points: 15 }, // +15 pts
  { description: "Algo for Mfav support <40%", points: -25 }, // -25 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: -10 }, // -10 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: 25 }, // +25 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: 25 }, // +25 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: 15 }, // +15 pts
  { description: "Algo final prediction is 1X/X2", points: -15 }, // -15 pts
  { description: "Algo primary prediction supports the underdog", points: -15 }, // -15 pts
  { description: "Both teams GA >= 1.5", points: 10 }, // +10 pts
  { description: "Mfav GS = Und Gs +-0.2", points: 15 }, // +15 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -10 }, // -10 pts
  { description: "LE was a draw", points: 15 }, // +15 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: -10 }, // -10 pts
  { description: "Underdog odds <= 2.80", points: -20 }, // -20 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: 5 }, // +5 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: 10 }, // +10 pts
  { description: "LE : Underdog won the last encounter", points: 20 }, // +20 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (Volatile match)", points: -25 }, // -25 pts
  { description: "Underdog has hidden strength", points: 5 }, // +5 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: 10 }, // +10 pts
  { description: "Seer score on underdog >= 45%", points: -25 }, // -25 pts
  { description: "Algo support for Mfav is 45-50%", points: 5 }, // +5 pts
  { description: "M.fav has hidden strength", points: -5 }, // -5 pts
  { description: "Both teams GA > GS", points: 15 }, // +15 pts
  { description: "TS difference >= 1.0", points: 20 }, // +20 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: 15 }, // +15 pts
  { description: "Seer primary predicts on underdog", points: -25 }, // -25 pts
  { description: "TS difference <= 0.1", points: 10 }, // +10 pts
  { description: "Both team GS => 1.8", points: -20 }, // -20 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 10 }, // +10 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: 10 }, // +10 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: 5 }, // +5 pts
  { description: "LE Underdog won with 2+ goals", points: 25 }, // +25 pts
  { description: "Mfav L10 = Und L10", points: 15 }, // +15 pts
  { description: "1X2 Rating 5.0 to 7.0", points: -15 }, // -15 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: -5 }, // -5 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -10 }, // -10 pts
  { description: "Seer score on draw >= 35%", points: -5 }, // -5 pts
  { description: "1X2 Rating =>7", points: -15 }, // -15 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 15 }, // +15 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: -10 }, // -10 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: 15 }, // +15 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: -5 }, // -5 pts
  { description: "Underdog was away on LE and Won", points: -5 }, // -5 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -20 }, // -20 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: -10 }, // -10 pts
  { description: "Underdog has hidden weakness", points: 15 }, // +15 pts
  { description: "M.fav has hidden weakness", points: 15 }, // +15 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 5 }, // +5 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: -5 }, // -5 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: -20 }, // -20 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: 5 }, // +5 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -10 }, // -10 pts
  { description: "Algo support for Mfav > 50%", points: -5 }, // -5 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 20 }, // +20 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 5 }, // +5 pts
  { description: "Match belong to African leagues", points: -15 }, // -15 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -10 }, // -10 pts
  { description: "LE was a draw + Mfav has hidden strength", points: -15 }, // -15 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 5 }, // +5 pts
  { description: "PHA Underdog probability >= 35%", points: 10 }, // +10 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -20 }, // -20 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: 5 }, // +5 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -5 }, // -5 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: 5 }, // +5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: -5 }, // -5 pts
  { description: "Both teams GS < 1.0", points: -25 }, // -25 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: -15 }, // -15 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: -15 }, // -15 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: -10 }, // -10 pts
  { description: "PHA Draw probability >= 35%", points: -5 }, // -5 pts
  { description: "PHA is a tie between outcomes", points: 10 }, // +10 pts
  { description: "Odds for draw is < 3.0", points: -10 }, // -10 pts
  { description: "Youth League (U21,U23,U20,U19)", points: 5 }, // +5 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -5 }, // -5 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -5 }, // -5 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 5 }, // +5 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: -5 }, // -5 pts
  { description: "PAA Win probability < 35%", points: 15 }, // +15 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: 5 }, // +5 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: 10 }, // +10 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: 5 }, // +5 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: 10 }, // +10 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: -15 }, // -15 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: -10 }, // -10 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -5 }, // -5 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -5 }, // -5 pts
  { description: "A match has GS=GS=GA=GA", points: 5 }, // +5 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: -5 }, // -5 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: 15 }, // +15 pts
  { description: "Match belong to israel leagues", points: 5 }, // +5 pts
  { description: "Match belong to England Amateur", points: 10 },
  { description: "Match belong to norway 3rd division", points: 10 },
  { description: "Match has BB, T12, or BD opw < 10%", points: 10 }, // +10 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: 15 }, // +15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: 15 }, // +15 pts
  { description: "SubPattern is G2E5", points: -5 }, // -5 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: 5 }, // +5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: 10 }, // +10 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: 20 }, // +20 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: 15 }, // +15 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: 20 }, // +20 pts
  { description: "Match belongs to European countries league 3 (III).", points: 15 }, // +15 pts,
  { description: "Match has Banned:Upset risk tag", points: 10 }, // +10 pts
  { description: "Match has Banned:Draw risk tag", points: 10 }, // +10 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: 5 },
  { description: "Mfav was home and won last Encounter <=1 goal", points: 5 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: -10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: -10 },
  { description: "Mfav was home and won last Encounter >3 goal", points: -10 },
  { description: "Mfav was Away and won last Encounter >3 goal", points: -10 },
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
], 'upsets');

export const FRIDAY_BOTB_RULES: FridayRuleItem[] = sanitizeRulePolarity([
  { description: "Seer score on draw <= 20%", points: 15 }, // +15 pts
  { description: "Seer primary predicts on underdog", points: -20 }, // -20 pts
  { description: "Algo support for Mfav > 50%", points: 10 }, // +10 pts
  { description: "Algo support for Mfav is 45-50%", points: 10 }, // +10 pts
  { description: "Algo for Mfav support <40%", points: -15 }, // -15 pts
  { description: "Algo final prediction is 1X/X2", points: 10 }, // +10 pts
  { description: "Algo primary prediction supports the underdog", points: -20 }, // -20 pts
  { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 20 }, // +20 pts
  { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 10 }, // +10 pts
  { description: "PAA, Seer, and ML agree on 1X/X2", points: 10 }, // +10 pts
  { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 }, // -5 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -10 }, // -10 pts
  { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: 10 }, // +10 pts
  { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: 10 }, // +10 pts
  { description: "Sub pattern primary on draw and hedges with underdog", points: -20 }, // -20 pts
  { description: "Sub pattern primary prediction supports the underdog", points: -20 }, // -20 pts
  { description: "1X2 Rating =>7", points: -15 }, // -15 pts
  { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 20 }, // +20 pts
  { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 15 }, // +15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: -10 }, // -10 pts
  { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -10 }, // -10 pts
  { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -10 }, // -10 pts
  { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: -25 }, // -25 pts
  { description: "TS difference <= 0.1", points: -10 }, // -10 pts
  { description: "Underdog has hidden strength", points: -25 }, // -25 pts
  { description: "Underdog has hidden weakness", points: 15 }, // +15 pts
  { description: "M.fav has hidden strength", points: 20 }, // +20 pts
  { description: "M.fav has hidden weakness", points: 10 }, // +10 pts
  { description: "Underdog has >= 5 more points on point system", points: -20 }, // -20 pts
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 15 }, // +15 pts
  { description: "Both teams GS < 1.0", points: -10 }, // -10 pts
  { description: "Both teams GS < 1.0 and Both team GS <GA", points: -10 }, // -10 pts
  { description: "Both team GS => 1.8", points: 20 }, // +20 pts
  { description: "Both teams GA > GS", points: 5 }, // +5 pts
  { description: "Both teams GA > GS and Both team GS <=1.0", points: 20 }, // +20 pts
  { description: "Both teams GA >= 1.1 (volatile match)", points: 20 }, // +20 pts
  { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -10 }, // -10 pts
  { description: "Both teams GA >= 1.5", points: 15 }, // +15 pts
  { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 20 }, // +20 pts
  { description: "Mfav GA=Und GA (+-0.2)", points: -5 }, // -5 pts
  { description: "Mfav GS = Und Gs +-0.2", points: -15 }, // -15 pts
  { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: -10 }, // -10 pts
  { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: -15 }, // -15 pts
  { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: -15 }, // -15 pts
  { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: -10 }, // -10 pts
  { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 5 }, // +5 pts
  { description: "Underdog GS >Mfav GS with >=0.4 points", points: -15 }, // -15 pts
  { description: "Underdog GA >= 1.5 and GS => 1.8", points: 15 }, // +15 pts
  { description: "A match has GS=GS=GA=GA", points: -10 }, // -10 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 }, // +15 pts
  { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 }, // -15 pts
  { description: "Underdog odds <= 2.80", points: -15 }, // -15 pts
  { description: "Odds for underdog >= 2.80 to 3.0", points: -5 }, // -5 pts
  { description: "Odds for draw is < 3.0", points: -15 }, // -15 pts
  { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 }, // -15 pts
  { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -10 }, // -10 pts
  { description: "LE : Underdog won the last encounter", points: -20 }, // -20 pts
  { description: "LE Underdog won with 2+ goals", points: -20 }, // -20 pts
  { description: "Underdog was away on LE and Won", points: -20 }, // -20 pts
  { description: "LE was a draw+Underdog has hidden strength/weakness", points: -10 }, // -10 pts
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -20 }, // -20 pts
  { description: "Match belong to israel leagues", points: 5 }, // +5 pts
  { description: "Match belong to African leagues", points: -25 }, // -25 pts
  { description: "Match belong to England Amateur", points: -10 },
  { description: "Match belong to norway 3rd division", points: -10 },
  { description: "Youth League (U21,U23,U20,U19)", points: -15 }, // -15 pts
  { description: "Match has BB, T12, or BD opw < 10%", points: -10 }, // -10 pts
  { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -20 }, // -20 pts
  { description: "TS difference >= 1.0", points: -15 }, // -15 pts
  { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: 15 }, // +15 pts
  { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -15 }, // -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 }, // -15 pts
  { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -20 }, // -20 pts
  { description: "LE was a draw", points: 15 }, // +15 pts
  { description: "Mfav L10 = Und L10", points: -15 }, // -15 pts
  { description: "LE was a draw + Mfav L10 = Und L10", points: -15 }, // -15 pts
  { description: "LE was a draw + Mfav has hidden strength", points: 15 }, // +15 pts
  { description: "Underdog has higher L10 than Mfav", points: 10 }, // +10 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1", points: 15 }, // +15 pts
  { description: "1X2 Rating < 3.0", points: 20 }, // +20 pts
  { description: "1X2 Rating 5.0 to 7.0", points: -10 }, // -10 pts
  { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 20 }, // +20 pts
  { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 20 }, // +20 pts
  { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 10 }, // +10 pts
  { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 10 }, // +10 pts
  { description: "PAA Win probability >= 50%", points: 10 }, // +10 pts
  { description: "PAA Win probability < 35%", points: -15 }, // -15 pts
  { description: "PHA Draw probability >= 35%", points: -15 }, // -15 pts
  { description: "PHA Underdog probability >= 35%", points: -15 }, // -15 pts
  { description: "PHA is a tie between outcomes", points: -10 }, // -10 pts
  { description: "SubPattern is G2E5", points: 5 }, // +5 pts
  { description: "Odds for underdog >= 3.0", points: -15 }, // -15 pts
  { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -20 }, // -20 pts
  { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -20 }, // -20 pts
  { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -20 }, // -20 pts
  { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -20 }, // -20 pts
  { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // -20 pts
  { description: "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge", points: -20 }, // -20 pts
  { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (Volatile match)", points: 15 }, // +15 pts
  { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 }, // -20 pts
  { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -20 }, // -20 pts
  { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -10 }, // -10 pts
  { description: "LE was a draw+1X2 Rating < 3.0", points: 15 }, // +15 pts
  { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -10 }, // -10 pts
  { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 }, // -5 pts
  { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -20 }, // -20 pts
  { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -15 }, // -15 pts
  { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -15 }, // -15 pts
  { description: "Match belongs to European countries league 3 (III).", points: -10 }, // -10 pts,
  { description: "Match has Banned:Upset risk tag", points: -5 }, // -5 pts
  { description: "Match has Banned:Draw risk tag", points: -5 }, // -5 pts
  { description: "Mfav was away and won last Encounter <=1 goal", points: -5 },
  { description: "Mfav was home and won last Encounter <=1 goal", points: -5 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: 10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: 10 },
  { description: "Mfav was home and won last Encounter >3 goal", points: 10 },
  { description: "Mfav was Away and won last Encounter >3 goal", points: 10 },
  { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
  { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: 10 },
], 'botb_best');

