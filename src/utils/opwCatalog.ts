/**
 * Complete Master Catalog of 96 Analyzed Triggers
 * Deduplicated, calibrated, and classified by domain & statistical power.
 */
import { loadApprovedCustomTriggers } from './opwTriggerDiscovery';

export const ALL_MASTER_CATALOG_TRIGGERS: string[] = [
    "Seer score on draw <= 20%",
    "Seer score on draw >= 35%",
    "Seer score on underdog >= 45%",
    "Seer primary predicts on underdog",
    "Algo support for Mfav > 50%",
    "Algo support for Mfav is 45-50%",
    "Algo for Mfav support <40%",
    "Algo final prediction is 1X/X2",
    "Algo primary prediction supports the underdog",
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2",
    "PAA, Seer, Algo, and ML agree on 1X/X2",
    "PAA, Seer, and ML agree on 1X/X2",
    "PAA, SubPattern, Algo, and ML agree on 12 hedge",
    "PAA, SubPattern, and Algo agree on 12 hedge",
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12",
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12",
    "Sub pattern primary on draw and hedges with underdog",
    "Sub pattern primary prediction supports the underdog",
    "1X2 Rating =>7",
    "Mfav TS >= 3.0 and Ud TS < 0.8",
    "Mfav TS 1.5-1.99 and Ud TS < 0.5",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8",
    "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%",
    "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%",
    "M.fav TS >= 2.0 and Underdog TS < 1.0",
    "TS difference <= 0.1",
    "Underdog has hidden strength",
    "Underdog has hidden weakness",
    "M.fav has hidden strength",
    "M.fav has hidden weakness",
    "Underdog has >= 5 more points on point system",
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)",
    "Both teams GS < 1.0",
    "Both teams GS < 1.0 and Both team GS <GA",
    "Both team GS => 1.8",
    "Both teams GA > GS",
    "Both teams GA > GS and Both team GS <=1.0",
    "Both teams GA >= 1.1 (volatile match)",
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength",
    "Both teams GA >= 1.5",
    "M.fav GA is > 0.6 points lower than Underdog GA",
    "Mfav GA=Und GA (+-0.2)",
    "Mfav GS = Und Gs +-0.2",
    "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA",
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength",
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA",
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)",
    "Underdog GS < 1.0 but M.fav GS > 1.0",
    "Underdog GS >Mfav GS with >=0.4 points",
    "Underdog GA >= 1.5 and GS => 1.8",
    "A match has GS=GS=GA=GA",
    "Equal GS + AGA=HGS + M.fav has hidden strength",
    "Equal GS + AGA=HGS + M.fav has hidden weakness",
    "Underdog odds <= 2.80",
    "Odds for underdog >= 2.80 to 3.0",
    "Odds for draw is < 3.0",
    "Odds for underdog <= odds for draw but < 2.8",
    "Odds for underdog <= odds for draw but between 2.8 to 3.0",
    "LE : Underdog won the last encounter",
    "LE Underdog won with 2+ goals",
    "Underdog was away on LE and Won",
    "LE was a draw+Underdog has hidden strength/weakness",
    "LE, Underdog won the last encounter +Mfav L10= Und L10",
    "Match belong to israel leagues",
    "Match belong to African leagues",
    "Match belong to England Amateur",
    "Match belong to norway 3rd division",
    "Youth League (U21,U23,U20,U19)",
    "Match has BB, T12, or BD opw < 10%",
    "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog",
    "TS difference >= 1.0",
    "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%",
    "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%",
    "LE was a draw",
    "Mfav L10 = Und L10",
    "LE was a draw + Mfav L10 = Und L10",
    "LE was a draw + Mfav has hidden strength",
    "Underdog has higher L10 than Mfav",
    "Mfav L10 and Underdog L10 difference <= 1",
    "1X2 Rating < 3.0",
    "1X2 Rating 5.0 to 7.0",
    "Mfav GA <= 1.1 and Underdog GA > 1.1",
    "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)",
    "Mfav GS >= 1.5 and Underdog GS < 1.0",
    "Underdog GA >= 1.8 and Mfav GA <= 1.0",
    "PAA Win probability >= 50%",
    "PAA Win probability < 35%",
    "PHA Draw probability >= 35%",
    "PHA Underdog probability >= 35%",
    "PHA is a tie between outcomes",
    "SubPattern is G2E5",
    "Odds for underdog >= 3.0",
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav",
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)",
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)",
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)",
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0",
    "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge",
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)",
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12",
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8",
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)",
    "LE was a draw+1X2 Rating < 3.0",
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)",
    "Pha Underdog and Pha draw both >20%",
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness",
    "Odds for Draw and Underdog >= 3.0",
    "Mfav is away but was home last LE won with <=1 goal",
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0",
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1",
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal",
    "Match belongs to European countries league 3 (III).",
    "Match has Banned:Upset risk tag",
    "Match has Banned:Draw risk tag",
    "Seer score on draw >= 35%+1X2 Rating < 3.0",
    "Mfav GS=>2.0=Underdog GA +-0.2",
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%",
    "Mfav L10 > Und L10 with >=3 points",
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5",
    "Mfav was away and won last Encounter <=1 goal",
    "Mfav was home and won last Encounter <=1 goal",
    "Mfav was home and won last Encounter >1 to =<3 goal",
    "Mfav was Away and won last Encounter >1 to =<3 goal",
    "Mfav was home and won last Encounter >3 goal",
    "Mfav was Away and won last Encounter >3 goal",
    "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points",
];

export const MASTER_MFAV_DRAW_POINTS: Record<string, number> = {
    "Seer score on draw <= 20%": 10,
    "Seer score on draw >= 35%": -15,
    "Seer score on underdog >= 45%": -20,
    "Seer primary predicts on underdog": -20,
    "Algo support for Mfav > 50%": 15,
    "Algo support for Mfav is 45-50%": 10,
    "Algo for Mfav support <40%": -10,
    "Algo final prediction is 1X/X2": 15,
    "Algo primary prediction supports the underdog": -20,
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 20,
    "PAA, Seer, Algo, and ML agree on 1X/X2": 15,
    "PAA, Seer, and ML agree on 1X/X2": 10,
    "PAA, SubPattern, Algo, and ML agree on 12 hedge": -10,
    "PAA, SubPattern, and Algo agree on 12 hedge": -5,
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": 10,
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": 10,
    "Sub pattern primary on draw and hedges with underdog": -15,
    "Sub pattern primary prediction supports the underdog": -20,
    "1X2 Rating =>7": 20,
    "Mfav TS >= 3.0 and Ud TS < 0.8": 20,
    "Mfav TS 1.5-1.99 and Ud TS < 0.5": 15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8": 10,
    "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%": 10,
    "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%": 15,
    "M.fav TS >= 2.0 and Underdog TS < 1.0": -25,
    "TS difference <= 0.1": -5,
    "Underdog has hidden strength": -15,
    "Underdog has hidden weakness": -15,
    "M.fav has hidden strength": 15,
    "M.fav has hidden weakness": -10,
    "Underdog has >= 5 more points on point system": -15,
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 15,
    "Both teams GS < 1.0": 15,
    "Both teams GS < 1.0 and Both team GS <GA": 10,
    "Both team GS => 1.8": -10,
    "Both teams GA > GS": 5,
    "Both teams GA > GS and Both team GS <=1.0": 15,
    "Both teams GA >= 1.1 (volatile match)": -5,
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": -15,
    "Both teams GA >= 1.5": -15,
    "M.fav GA is > 0.6 points lower than Underdog GA": 15,
    "Mfav GA=Und GA (+-0.2)": 10,
    "Mfav GS = Und Gs +-0.2": -15,
    "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": -5,
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength": -15,
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA": -15,
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)": 15,
    "Underdog GS < 1.0 but M.fav GS > 1.0": 15,
    "Underdog GS >Mfav GS with >=0.4 points": -10,
    "Underdog GA >= 1.5 and GS => 1.8": -10,
    "A match has GS=GS=GA=GA": 15,
    "Equal GS + AGA=HGS + M.fav has hidden strength": 15,
    "Equal GS + AGA=HGS + M.fav has hidden weakness": -15,
    "Underdog odds <= 2.80": -20,
    "Odds for underdog >= 2.80 to 3.0": 10,
    "Odds for draw is < 3.0": 15,
    "Odds for underdog <= odds for draw but < 2.8": -15,
    "Odds for underdog <= odds for draw but between 2.8 to 3.0": -5,
    "LE : Underdog won the last encounter": -20,
    "LE Underdog won with 2+ goals": -20,
    "Underdog was away on LE and Won": -20,
    "LE was a draw+Underdog has hidden strength/weakness": -10,
    "LE, Underdog won the last encounter +Mfav L10= Und L10": -20,
    "Match belong to israel leagues": -10,
    "Match belong to African leagues": -10,
    "Match belong to England Amateur": -10,
    "Match belong to norway 3rd division": -10,
    "Youth League (U21,U23,U20,U19)": -10,
    "Match has BB, T12, or BD opw < 10%": -10,
    "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog": -20,
    "TS difference >= 1.0": 15,
    "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%": 15,
    "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%": -20,
    "LE was a draw": -15,
    "Mfav L10 = Und L10": -15,
    "LE was a draw + Mfav L10 = Und L10": 15,
    "LE was a draw + Mfav has hidden strength": 15,
    "Underdog has higher L10 than Mfav": -15,
    "Mfav L10 and Underdog L10 difference <= 1": -15,
    "1X2 Rating < 3.0": -5,
    "1X2 Rating 5.0 to 7.0": 15,
    "Mfav GA <= 1.1 and Underdog GA > 1.1": 10,
    "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)": 20,
    "Mfav GS >= 1.5 and Underdog GS < 1.0": 15,
    "Underdog GA >= 1.8 and Mfav GA <= 1.0": 20,
    "PAA Win probability >= 50%": 15,
    "PAA Win probability < 35%": -15,
    "PHA Draw probability >= 35%": 15,
    "PHA Underdog probability >= 35%": -15,
    "PHA is a tie between outcomes": 10,
    "SubPattern is G2E5": 10,
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav": -20,
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)": -20,
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)": -20,
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)": -20,
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0": -20,
    "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge": -20,
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)": -20,
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -20,
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8": -20,
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)": -20,
    "LE was a draw+1X2 Rating < 3.0": -15,
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)": -20,
    "Pha Underdog and Pha draw both >20%": -10,
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness": -15,
    "Odds for Draw and Underdog >= 3.0": 10,
    "Odds for underdog >= 3.0": -15,
    "Mfav is away but was home last LE won with <=1 goal": -5,
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0": -20,
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1": -15,
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal": -15,
    "Match belongs to European countries league 3 (III).": -10,
    "Match has Banned:Upset risk tag": -5,
    "Match has Banned:Draw risk tag": -5,
    "Seer score on draw >= 35%+1X2 Rating < 3.0": -10,
    "Mfav GS=>2.0=Underdog GA +-0.2": -5,
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%": -15,
    "Mfav L10 > Und L10 with >=3 points": 5,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5": 15,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5.": 15,
    "Mfav was away and won last Encounter <=1 goal": -5,
    "Mfav was home and won last Encounter <=1 goal": -5,
    "Mfav was home and won last Encounter >1 to =<3 goal": 10,
    "Mfav was Away and won last Encounter >1 to =<3 goal": 10,
    "Mfav was home and won last Encounter >3 goal": 10,
    "Mfav was Away and won last Encounter >3 goal": 10,
    "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points": 10,
};

export const MASTER_MFAV_ONLY_POINTS: Record<string, number> = {
    "Seer score on draw <= 20%": 10,
    "Seer score on draw >= 35%": -15,
    "Seer score on underdog >= 45%": -20,
    "Seer primary predicts on underdog": -20,
    "Algo support for Mfav > 50%": 15,
    "Algo support for Mfav is 45-50%": 10,
    "Algo for Mfav support <40%": -15,
    "Algo final prediction is 1X/X2": 10,
    "Algo primary prediction supports the underdog": -20,
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 15,
    "PAA, Seer, Algo, and ML agree on 1X/X2": 10,
    "PAA, Seer, and ML agree on 1X/X2": 5,
    "PAA, SubPattern, Algo, and ML agree on 12 hedge": -5,
    "PAA, SubPattern, and Algo agree on 12 hedge": -5,
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": 10,
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": 10,
    "Sub pattern primary on draw and hedges with underdog": -20,
    "Sub pattern primary prediction supports the underdog": -20,
    "1X2 Rating =>7": 20,
    "Mfav TS >= 3.0 and Ud TS < 0.8": 20,
    "Mfav TS 1.5-1.99 and Ud TS < 0.5": 15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8": 10,
    "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%": -15,
    "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%": -10,
    "M.fav TS >= 2.0 and Underdog TS < 1.0": -25,
    "TS difference <= 0.1": -10,
    "Underdog has hidden strength": -15,
    "Underdog has hidden weakness": -15,
    "M.fav has hidden strength": 15,
    "M.fav has hidden weakness": -15,
    "Underdog has >= 5 more points on point system": -20,
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 15,
    "Both teams GS < 1.0": -10,
    "Both teams GS < 1.0 and Both team GS <GA": -10,
    "Both team GS => 1.8": -10,
    "Both teams GA > GS": -5,
    "Both teams GA > GS and Both team GS <=1.0": -10,
    "Both teams GA >= 1.1 (volatile match)": -10,
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": -15,
    "Both teams GA >= 1.5": -10,
    "M.fav GA is > 0.6 points lower than Underdog GA": 15,
    "Mfav GA=Und GA (+-0.2)": -5,
    "Mfav GS = Und Gs +-0.2": -15,
    "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": -10,
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength": -15,
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA": -15,
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)": -10,
    "Underdog GS < 1.0 but M.fav GS > 1.0": 15,
    "Underdog GS >Mfav GS with >=0.4 points": -15,
    "Underdog GA >= 1.5 and GS => 1.8": -10,
    "A match has GS=GS=GA=GA": -10,
    "Equal GS + AGA=HGS + M.fav has hidden strength": 15,
    "Equal GS + AGA=HGS + M.fav has hidden weakness": -15,
    "Underdog odds <= 2.80": -15,
    "Odds for underdog >= 2.80 to 3.0": -5,
    "Odds for draw is < 3.0": -15,
    "Odds for underdog <= odds for draw but < 2.8": -15,
    "Odds for underdog <= odds for draw but between 2.8 to 3.0": -10,
    "LE : Underdog won the last encounter": -15,
    "LE Underdog won with 2+ goals": -20,
    "Underdog was away on LE and Won": -20,
    "LE was a draw+Underdog has hidden strength/weakness": -15,
    "LE, Underdog won the last encounter +Mfav L10= Und L10": -20,
    "Match belong to israel leagues": -10,
    "Match belong to African leagues": -10,
    "Match belong to England Amateur": -10,
    "Match belong to norway 3rd division": -10,
    "Youth League (U21,U23,U20,U19)": -15,
    "Match has BB, T12, or BD opw < 10%": -10,
    "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog": -20,
    "TS difference >= 1.0": 20,
    "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%": 15,
    "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%": -20,
    "LE was a draw": -15,
    "Mfav L10 = Und L10": -5,
    "LE was a draw + Mfav L10 = Und L10": -15,
    "LE was a draw + Mfav has hidden strength": 15,
    "Underdog has higher L10 than Mfav": -15,
    "Mfav L10 and Underdog L10 difference <= 1": -15,
    "1X2 Rating < 3.0": -10,
    "1X2 Rating 5.0 to 7.0": 15,
    "Mfav GA <= 1.1 and Underdog GA > 1.1": 10,
    "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)": 20,
    "Mfav GS >= 1.5 and Underdog GS < 1.0": 15,
    "Underdog GA >= 1.8 and Mfav GA <= 1.0": 20,
    "PAA Win probability >= 50%": 15,
    "PAA Win probability < 35%": -15,
    "PHA Draw probability >= 35%": -15,
    "PHA Underdog probability >= 35%": -15,
    "PHA is a tie between outcomes": -10,
    "SubPattern is G2E5": 5,
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav": -20,
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)": -20,
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)": -20,
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)": -20,
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0": -20,
    "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge": -20,
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)": -20,
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -20,
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8": -20,
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)": -20,
    "LE was a draw+1X2 Rating < 3.0": -15,
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)": -20,
    "Pha Underdog and Pha draw both >20%": -10,
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness": -15,
    "Odds for Draw and Underdog >= 3.0": 10,
    "Odds for underdog >= 3.0": -20,
    "Mfav is away but was home last LE won with <=1 goal": -5,
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0": -20,
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1": -15,
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal": -15,
    "Match belongs to European countries league 3 (III).": -10,
    "Match has Banned:Upset risk tag": -5,
    "Match has Banned:Draw risk tag": -5,
    "Seer score on draw >= 35%+1X2 Rating < 3.0": -10,
    "Mfav GS=>2.0=Underdog GA +-0.2": -5,
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%": -15,
    "Mfav L10 > Und L10 with >=3 points": 5,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5": 15,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5.": 15,
    "Mfav was away and won last Encounter <=1 goal": -5,
    "Mfav was home and won last Encounter <=1 goal": -5,
    "Mfav was home and won last Encounter >1 to =<3 goal": 10,
    "Mfav was Away and won last Encounter >1 to =<3 goal": 10,
    "Mfav was home and won last Encounter >3 goal": 10,
    "Mfav was Away and won last Encounter >3 goal": 10,
    "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points": 10,
    "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points": 10,
};

export const MASTER_UNDERDOG_ONLY_POINTS: Record<string, number> = {
    "Seer score on draw <= 20%": -5,
    "Seer score on draw >= 35%": -5,
    "Seer score on underdog >= 45%": 20,
    "Seer primary predicts on underdog": 20,
    "Algo support for Mfav > 50%": -15,
    "Algo support for Mfav is 45-50%": -10,
    "Algo for Mfav support <40%": 10,
    "Algo final prediction is 1X/X2": -15,
    "Algo primary prediction supports the underdog": 20,
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": -20,
    "PAA, Seer, Algo, and ML agree on 1X/X2": -15,
    "PAA, Seer, and ML agree on 1X/X2": -10,
    "PAA, SubPattern, Algo, and ML agree on 12 hedge": 10,
    "PAA, SubPattern, and Algo agree on 12 hedge": 5,
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": -10,
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -10,
    "Sub pattern primary on draw and hedges with underdog": 15,
    "Sub pattern primary prediction supports the underdog": 20,
    "1X2 Rating =>7": -20,
    "Mfav TS >= 3.0 and Ud TS < 0.8": -20,
    "Mfav TS 1.5-1.99 and Ud TS < 0.5": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8": -10,
    "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%": -5,
    "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%": -15,
    "M.fav TS >= 2.0 and Underdog TS < 1.0": 20,
    "TS difference <= 0.1": 10,
    "Underdog has hidden strength": 15,
    "Underdog has hidden weakness": 15,
    "M.fav has hidden strength": -15,
    "M.fav has hidden weakness": 15,
    "Underdog has >= 5 more points on point system": 20,
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": -15,
    "Both teams GS < 1.0": -10,
    "Both teams GS < 1.0 and Both team GS <GA": -10,
    "Both team GS => 1.8": 10,
    "Both teams GA > GS": 5,
    "Both teams GA > GS and Both team GS <=1.0": -10,
    "Both teams GA >= 1.1 (volatile match)": 10,
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": 15,
    "Both teams GA >= 1.5": 10,
    "M.fav GA is > 0.6 points lower than Underdog GA": -15,
    "Mfav GA=Und GA (+-0.2)": 5,
    "Mfav GS = Und Gs +-0.2": -15,
    "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": 10,
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength": 15,
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA": 15,
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)": 5,
    "Underdog GS < 1.0 but M.fav GS > 1.0": -15,
    "Underdog GS >Mfav GS with >=0.4 points": 15,
    "Underdog GA >= 1.5 and GS => 1.8": 10,
    "A match has GS=GS=GA=GA": 5,
    "Equal GS + AGA=HGS + M.fav has hidden strength": -15,
    "Equal GS + AGA=HGS + M.fav has hidden weakness": 15,
    "Underdog odds <= 2.80": -30,
    "Odds for underdog >= 2.80 to 3.0": 5,
    "Odds for draw is < 3.0": -5,
    "Odds for underdog <= odds for draw but < 2.8": -25,
    "Odds for underdog <= odds for draw but between 2.8 to 3.0": 10,
    "LE : Underdog won the last encounter": 15,
    "LE Underdog won with 2+ goals": 20,
    "Underdog was away on LE and Won": 20,
    "LE was a draw+Underdog has hidden strength/weakness": 15,
    "LE, Underdog won the last encounter +Mfav L10= Und L10": 20,
    "Match belong to israel leagues": 10,
    "Match belong to African leagues": 15,
    "Match belong to England Amateur": 10,
    "Match belong to norway 3rd division": 10,
    "Youth League (U21,U23,U20,U19)": 15,
    "Match has BB, T12, or BD opw < 10%": 10,
    "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog": 20,
    "TS difference >= 1.0": -20,
    "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%": -15,
    "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)": 15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8": 15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%": 20,
    "LE was a draw": 15,
    "Mfav L10 = Und L10": -15,
    "LE was a draw + Mfav L10 = Und L10": 5,
    "LE was a draw + Mfav has hidden strength": -15,
    "Underdog has higher L10 than Mfav": 15,
    "Mfav L10 and Underdog L10 difference <= 1": 15,
    "1X2 Rating < 3.0": 10,
    "1X2 Rating 5.0 to 7.0": -15,
    "Mfav GA <= 1.1 and Underdog GA > 1.1": -10,
    "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)": -20,
    "Mfav GS >= 1.5 and Underdog GS < 1.0": -15,
    "Underdog GA >= 1.8 and Mfav GA <= 1.0": -20,
    "PAA Win probability >= 50%": -15,
    "PAA Win probability < 35%": 15,
    "PHA Draw probability >= 35%": -5,
    "PHA Underdog probability >= 35%": 15,
    "PHA is a tie between outcomes": 5,
    "SubPattern is G2E5": -10,
    "Odds for underdog >= 3.0": 20,
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav": 20,
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)": 20,
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)": 15,
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)": 25,
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0": 20,
    "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge": 10,
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)": 15,
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": 10,
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8": 20,
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)": 15,
    "LE was a draw+1X2 Rating < 3.0": 15,
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)": 15,
    "Pha Underdog and Pha draw both >20%": 10,
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness": 15,
    "Odds for Draw and Underdog >= 3.0": -10,
    "Mfav is away but was home last LE won with <=1 goal": 10,
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0": 20,
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1": 15,
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal": 15,
    "Match belongs to European countries league 3 (III).": 10,
    "Match has Banned:Upset risk tag": 10,
    "Match has Banned:Draw risk tag": 5,
    "Seer score on draw >= 35%+1X2 Rating < 3.0": 10,
    "Mfav GS=>2.0=Underdog GA +-0.2": 5,
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%": 15,
    "Mfav L10 > Und L10 with >=3 points": -5,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5": -15,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5.": -15,
    "Mfav was away and won last Encounter <=1 goal": 5,
    "Mfav was home and won last Encounter <=1 goal": 5,
    "Mfav was home and won last Encounter >1 to =<3 goal": -10,
    "Mfav was Away and won last Encounter >1 to =<3 goal": -10,
    "Mfav was home and won last Encounter >3 goal": -10,
    "Mfav was Away and won last Encounter >3 goal": -10,
    "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points": -10,
};

// ============================================================================
// CANONICAL SEMANTIC POLARITY TAXONOMY & RUNTIME SANITIZATION
// Rules:
// 1. Pro-underdog triggers: MAX BONUS IS 0. Range strictly [0, -40] in Mfav / Top 12.
// 2. Pro-Mfav triggers: WORST PENALTY IS 0. Range strictly [0, +25] in Mfav / Top 12.
// 3. Neutral triggers: Range [-10, +10] (Top 12 mfav_draw allows up to +15 for draw triggers).
// 4. Upsets (underdog_only): Underdog triggers [0, +25], Mfav triggers [-40, 0], Neutral [-10, +10].
// ============================================================================

export type TriggerSemanticPolarity = 'PRO_MFAV' | 'PRO_UNDERDOG' | 'NEUTRAL';

export const PRO_MFAV_TRIGGERS = new Set<string>([
    "Algo support for Mfav > 50%",
    "Algo support for Mfav is 45-50%",
    "Algo final prediction is 1X/X2",
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2",
    "PAA, Seer, Algo, and ML agree on 1X/X2",
    "PAA, Seer, and ML agree on 1X/X2",
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12",
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12",
    "1X2 Rating =>7",
    "1X2 Rating 5.0 to 7.0",
    "1X2 Rating =>4 and <=6",
    "Mfav TS >= 3.0 and Ud TS < 0.8",
    "Mfav TS 1.5-1.99 and Ud TS < 0.5",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8",
    "Mfav TS >= 2.0 and Underdog TS < 0.7",
    "TS difference >= 1.0",
    "M.fav has hidden strength",
    "Equal GS + AGA=HGS + M.fav has hidden strength",
    "M.fav GA is > 0.6 points lower than Underdog GA",
    "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)",
    "Mfav GS >= 1.5 and Underdog GS < 1.0",
    "Underdog GA >= 1.8 and Mfav GA <= 1.0",
    "PAA Win probability >= 50%",
    "High Conviction Defense + Attack Dominance",
    "Market Favorite has strong home advantage",
    "Market favorite high win probability",
    "Dominant Attack & Defense",
    "Mfav L10 > Underdog L10",
    "Low Favorite Odds (< 1.80)",
    "Odds difference >= 0.50",
    "Mfav GS >= 2.0 and Underdog GA >= 1.5 (High Firepower)",
    "Odds for Draw and Underdog >= 3.0",
    "Mfav L10 > Und L10 with >=3 points",
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5",
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5.",
    "Mfav was home and won last Encounter >1 to =<3 goal",
    "Mfav was Away and won last Encounter >1 to =<3 goal",
    "Mfav was away and won last Encounter >1 to =<3 goal",
    "Mfav was home and won last Encounter >3 goal",
    "Mfav was Away and won last Encounter >3 goal",
    "Mfav was away and won last Encounter >3 goal",
    "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was Away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points",
]);

export const NEUTRAL_TRIGGERS = new Set<string>([
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)",
    "Seer score on draw <= 20%",
    "Underdog GS < 1.0 but M.fav GS > 1.0",
    "Mfav GA <= 1.1 and Underdog GA > 1.1",
]);

export const PRO_UNDERDOG_TRIGGERS = new Set<string>([
    "Mfav was away and won last Encounter <=1 goal",
    "Mfav was Away and won last Encounter <=1 goal",
    "Mfav was home and won last Encounter <=1 goal",
    "Mfav was Home and won last Encounter <=1 goal",
    "Mfav L10 = Und L10",
    "Mfav is away but was home last LE won with <=1 goal",
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0",
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1",
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal",
    "Match belongs to European countries league 3 (III).",
    "Match has Banned:Upset risk tag",
    "Match has Banned:Draw risk tag",
    "Mfav GS = Und Gs +-0.2",
    "Mfav GS = Und GS +-0.2",
    "LE was a draw + Mfav has hidden strength",
    "PHA Draw probability >= 35%",
    "Seer score on draw >= 35%",
    "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%",
    "Underdog has hidden strenght",
    "PAA, SubPattern, and Algo agree on 12 hedge",
    "PAA, SubPattern, Algo, and ML agree on 12 hedge",
    "Seer primary predicts on underdog",
    "Seer score on underdog >= 45%",
    "Algo primary prediction supports the underdog",
    "Algo for Mfav support <40%",
    "Sub pattern primary prediction supports the underdog",
    "Underdog has hidden strength",
    "M.fav has hidden weakness",
    "Equal GS + AGA=HGS + M.fav has hidden weakness",
    "Underdog has >= 5 more points on point system",
    "Underdog GS >Mfav GS with >=0.4 points",
    "Underdog GA >= 1.5 and GS => 1.8",
    "Both teams GA >= 1.1 (volatile match)",
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength",
    "Both teams GA >= 1.5",
    "Both team GS => 1.8",
    "Both teams GA > GS",
    "Both teams GA > GS and Both team GS <=1.0",
    "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%",
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength",
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA",
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)",
    "Underdog odds <= 2.80",
    "Odds for underdog <= odds for draw but < 2.8",
    "Odds for underdog <= odds for draw but between 2.8 to 3.0",
    "Odds for underdog <= odds for draw but >= 3.0",
    "Odds for underdog >= 3.0",
    "Odds for underdog >= 2.80 to 3.0",
    "LE : Underdog won the last encounter",
    "LE Underdog won with 2+ goals",
    "Underdog was away on LE and Won",
    "LE was a draw+Underdog has hidden strength/weakness",
    "LE, Underdog won the last encounter +Mfav L10= Und L10",
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav",
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)",
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)",
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8",
    "Match belong to israel leagues",
    "Match belong to African leagues",
    "Match belong to England Amateur",
    "Match belong to norway 3rd division",
    "Youth League (U21,U23,U20,U19)",
    "Match has BB, T12, or BD opw < 10%",
    "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog",
    "Underdog has higher L10 than Mfav",
    "1X2 supports the underdog",
    "1X2 Rating < 3.0",
    "PAA Win probability < 35%",
    "PHA Underdog probability >= 35%",
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)",
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)",
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)",
    "LE was a draw+1X2 Rating < 3.0",
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0",
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12",
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)",
    "High Favorite Odds (>= 2.50)",
    "M.fav TS >= 2.0 and Underdog TS < 1.0",
    "Underdog has hidden weakness",
    "Mfav L10 and Underdog L10 difference <= 1",
    "LE was a draw",
    "Pha Underdog and Pha draw both >20%",
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness",
    "Seer score on draw >= 35%+1X2 Rating < 3.0",
    "Mfav GS=>2.0=Underdog GA +-0.2",
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%",
]);

export function getTriggerSemanticPolarity(triggerName: string): TriggerSemanticPolarity {
    if (NEUTRAL_TRIGGERS.has(triggerName)) return 'NEUTRAL';
    if (PRO_UNDERDOG_TRIGGERS.has(triggerName)) return 'PRO_UNDERDOG';
    if (PRO_MFAV_TRIGGERS.has(triggerName)) return 'PRO_MFAV';

    const lower = triggerName.toLowerCase();

    // Check specific neutral phrases first so they don't get caught by broader substrings
    if (
        lower.includes('mfav ga=und ga') ||
        lower.includes('seer score on draw <= 20%') ||
        lower.includes('underdog gs < 1.0 but m.fav gs > 1.0') ||
        lower.includes('mfav ga <= 1.1 and underdog ga > 1.1')
    ) {
        return 'NEUTRAL';
    }

    if (
        lower.includes('supports the underdog') ||
        lower.includes('predicts on underdog') ||
        lower.includes('underdog has hidden strength') ||
        lower.includes('underdog has hidden strenght') ||
        lower.includes('underdog has hidden weakness') ||
        lower.includes('underdog has higher l10') ||
        lower.includes('underdog won') ||
        lower.includes('underdog odds <=') ||
        lower.includes('volatile') ||
        lower.includes('israel') ||
        lower.includes('african') ||
        lower.includes('youth league') ||
        lower.includes('und ga <mfav ga') ||
        lower.includes('underdog gs >mfav gs') ||
        lower.includes('underdog has >= 5 more points') ||
        lower.includes('1x2 rating < 3.0') ||
        lower.includes('le was a draw') ||
        lower.includes('mfav gs = und gs') ||
        lower.includes('mfav gs = und gs +-0.2') ||
        lower.includes('mfav is away but was home last le') ||
        lower.includes('league 3 (iii)') ||
        lower.includes('european countries league 3') ||
        lower.includes('england amateur') ||
        lower.includes('norway 3rd division') ||
        lower.includes('banned:upset risk') ||
        lower.includes('banned:draw risk') ||
        lower.includes('mfav l10 = und l10') ||
        lower.includes('mfav gs=underdog gs') ||
        lower.includes('seer score on draw >= 35%') ||
        lower.includes('pha draw probability >= 35%') ||
        lower.includes('m.fav ts >= 2.0 and underdog ts < 1.0') ||
        lower.includes('mfav ts < 1.5, ud ts < 0.8, seer score draw >= 35%') ||
        lower.includes('mfav l10 and underdog l10 difference <= 1') ||
        lower.includes('pha underdog and pha draw both >20%') ||
        lower.includes('pha on underdog and draw') ||
        lower.includes('underdog ga +-0.2') ||
        lower.includes('agree on 12 hedge') ||
        lower.includes('hidden strength/weakness') ||
        (lower.includes('won last encounter <=1 goal') && !lower.includes('l10 > und l10'))
    ) {
        return 'PRO_UNDERDOG';
    }
    if (
        lower.includes('mfav > 50%') ||
        lower.includes('algo support for mfav') ||
        lower.includes('algo final prediction is 1x/x2') ||
        lower.includes('agree on 1x/x2') ||
        lower.includes('m.fav has hidden strength') ||
        lower.includes('mfav l10 > underdog') ||
        lower.includes('mfav l10 > und l10') ||
        lower.includes('dominant defense') ||
        lower.includes('high firepower') ||
        lower.includes('mfav won') ||
        lower.includes('won last encounter >1 to =<3 goal') ||
        lower.includes('won last encounter >3 goal') ||
        (lower.includes('won last encounter') && lower.includes('l10 > und l10')) ||
        lower.includes('paa win probability >= 50%') ||
        lower.includes('1x2 rating =>7') ||
        lower.includes('1x2 rating 5.0 to 7.0') ||
        lower.includes('1x2 rating =>4 and <=6') ||
        lower.includes('low favorite odds') ||
        lower.includes('high conviction defense') ||
        lower.includes('odds for draw and underdog =>3.0') ||
        lower.includes('odds for draw and underdog >= 3.0')
    ) {
        return 'PRO_MFAV';
    }
    return 'NEUTRAL';
}

export type DayRulesBorrowProvider = (desc: string, categoryId: string, currentDay?: string) => number | undefined;
export let dayRulesBorrowProvider: DayRulesBorrowProvider | null = null;
export function setDayRulesBorrowProvider(provider: DayRulesBorrowProvider | null) {
    dayRulesBorrowProvider = provider;
}

/**
 * Borrows points for a trigger across other days, other categories, master rules,
 * dictionaries, and domain semantic polarity.
 * GUARANTEE: Never returns 0!
 */
export function borrowTriggerPoints(
    description: string,
    categoryId: string = 'top_12_value',
    day?: string
): number {
    if (description === "PHA on Underdog and Draw =>20%" || description === "PHA on Underdog and Draw >=20%") {
        description = "Pha Underdog and Pha draw both >20%";
    }
    // Canonical alias mappings for LE triggers
    if (description === "Mfav was Away and won last Encounter <=1 goal") description = "Mfav was away and won last Encounter <=1 goal";
    if (description === "Mfav was Home and won last Encounter <=1 goal") description = "Mfav was home and won last Encounter <=1 goal";
    if (description === "Mfav was away and won last Encounter >1 to =<3 goal") description = "Mfav was Away and won last Encounter >1 to =<3 goal";
    if (description === "Mfav was Home and won last Encounter >1 to =<3 goal") description = "Mfav was home and won last Encounter >1 to =<3 goal";
    if (description === "Mfav was away and won last Encounter >3 goal") description = "Mfav was Away and won last Encounter >3 goal";
    if (description === "Mfav was Home and won last Encounter >3 goal") description = "Mfav was home and won last Encounter >3 goal";

    if (description === "Mfav was Away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points") description = "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points";
    if (description === "Mfav was Home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points") description = "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points";
    if (description === "Mfav was Home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points") description = "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points";
    if (description === "Mfav was away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points") description = "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points";
    if (description === "Mfav was Home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points") description = "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points";
    if (description === "Mfav was away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points") description = "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points";

    // 1. Check dynamic provider across other days and categories
    if (dayRulesBorrowProvider) {
        try {
            const borrowed = dayRulesBorrowProvider(description, categoryId, day);
            if (borrowed !== undefined && borrowed !== 0) {
                return borrowed;
            }
        } catch (e) {}
    }

    // 2. Check approved custom triggers
    try {
        const approved = loadApprovedCustomTriggers();
        const found = approved.find(a => a.description === description && a.points !== 0);
        if (found && found.points !== 0) return found.points;
    } catch (e) {}

    const isUpsets = categoryId === 'upsets' || categoryId === 'underdog_only';
    const isMfavDraw = ['top_12_value', 'top_10_value', 'top12', 'top10', 'mfav_draw'].includes(categoryId);
    const polarity = getTriggerSemanticPolarity(description);

    // 3. Check master rules for target category
    const catDefaultsMap: Record<string, { description: string; points: number }[]> = {
        top_12_value: MASTER_TOP_12_RULES,
        top_10_value: MASTER_TOP_12_RULES,
        top12: MASTER_TOP_12_RULES,
        top10: MASTER_TOP_12_RULES,
        best_bet: MASTER_BEST_BET_RULES,
        bankers_dlive: MASTER_BANKERS_DLIVE_RULES,
        bankers_jackpot: MASTER_TOP_12_RULES,
        value_picks: MASTER_TOP_12_RULES,
        upsets: MASTER_UPSETS_RULES,
        underdog_upsets: MASTER_UPSETS_RULES,
        botb_best: MASTER_BOTB_RULES,
    };

    const targetList = catDefaultsMap[categoryId];
    if (targetList) {
        const found = targetList.find(r => r.description === description && r.points !== 0);
        if (found && found.points !== 0) return found.points;
    }

    // 4. Check other master categories
    const fallbackCategories = isUpsets
        ? ['upsets', 'underdog_upsets']
        : ['top_12_value', 'best_bet', 'bankers_jackpot', 'value_picks', 'bankers_dlive', 'botb_best'];

    for (const otherCat of fallbackCategories) {
        if (otherCat === categoryId) continue;
        const list = catDefaultsMap[otherCat];
        if (list) {
            const found = list.find(r => r.description === description && r.points !== 0);
            if (found && found.points !== 0) return found.points;
        }
    }

    // 5. Check master dictionaries
    if (isUpsets) {
        if (MASTER_UNDERDOG_ONLY_POINTS[description] !== undefined && MASTER_UNDERDOG_ONLY_POINTS[description] !== 0) {
            return MASTER_UNDERDOG_ONLY_POINTS[description];
        }
    } else if (isMfavDraw) {
        if (MASTER_MFAV_DRAW_POINTS[description] !== undefined && MASTER_MFAV_DRAW_POINTS[description] !== 0) {
            return MASTER_MFAV_DRAW_POINTS[description];
        }
    } else {
        if (MASTER_MFAV_ONLY_POINTS[description] !== undefined && MASTER_MFAV_ONLY_POINTS[description] !== 0) {
            return MASTER_MFAV_ONLY_POINTS[description];
        }
    }

    // Cross-check dictionaries
    if (!isUpsets) {
        if (MASTER_MFAV_DRAW_POINTS[description] !== undefined && MASTER_MFAV_DRAW_POINTS[description] !== 0) {
            return MASTER_MFAV_DRAW_POINTS[description];
        }
        if (MASTER_MFAV_ONLY_POINTS[description] !== undefined && MASTER_MFAV_ONLY_POINTS[description] !== 0) {
            return MASTER_MFAV_ONLY_POINTS[description];
        }
    }

    // 6. Semantic Polarity Defaults (Guaranteed non-zero)
    if (isUpsets) {
        if (polarity === 'PRO_UNDERDOG') return 15;
        if (polarity === 'PRO_MFAV') return -15;
        return 5;
    } else {
        if (polarity === 'PRO_UNDERDOG') return -20;
        if (polarity === 'PRO_MFAV') return 15;
        return 5;
    }
}

export function sanitizeRulePolarity<T extends Record<string, number> | { description: string; points: number }[]>(
    rules: T,
    categoryId: string = 'top_12_value'
): T {
    const isArray = Array.isArray(rules);
    const isUpsets = categoryId === 'upsets' || categoryId === 'underdog_only';
    const isMfavDraw = ['top_12_value', 'top_10_value', 'top12', 'top10', 'mfav_draw'].includes(categoryId);

    const cleanPoints = (desc: string, pts: number): number => {
        let effectivePts = pts;
        if (effectivePts === 0) {
            effectivePts = borrowTriggerPoints(desc, categoryId);
        }
        const polarity = getTriggerSemanticPolarity(desc);
        let res: number;
        if (isUpsets) {
            if (polarity === 'PRO_UNDERDOG') {
                res = Math.max(5, Math.min(25, effectivePts < 0 ? Math.abs(effectivePts) : (effectivePts === 0 ? 15 : effectivePts)));
            } else if (polarity === 'PRO_MFAV') {
                res = Math.min(-5, Math.max(-40, effectivePts > 0 ? -Math.abs(effectivePts) : (effectivePts === 0 ? -15 : effectivePts)));
            } else {
                res = Math.max(-40, Math.min(25, effectivePts === 0 ? 5 : effectivePts));
            }
        } else {
            if (polarity === 'PRO_UNDERDOG') {
                res = Math.min(-5, Math.max(-40, effectivePts > 0 ? -effectivePts : (effectivePts === 0 ? -15 : effectivePts)));
            } else if (polarity === 'PRO_MFAV') {
                res = Math.max(5, Math.min(25, effectivePts < 0 ? Math.abs(effectivePts) : (effectivePts === 0 ? 15 : effectivePts)));
            } else {
                res = Math.max(-40, Math.min(25, effectivePts === 0 ? 5 : effectivePts));
            }
        }
        // Strict guard: NEVER return 0 under any condition
        if (res === 0) {
            res = isUpsets ? (polarity === 'PRO_UNDERDOG' ? 15 : -15) : (polarity === 'PRO_UNDERDOG' ? -15 : 15);
        }
        return res;
    };

    if (isArray) {
        return (rules as { description: string; points: number }[]).map(r => ({
            description: r.description,
            points: cleanPoints(r.description, r.points)
        })) as T;
    } else {
        const result: Record<string, number> = {};
        for (const [desc, pts] of Object.entries(rules as Record<string, number>)) {
            result[desc] = cleanPoints(desc, pts);
        }
        return result as T;
    }
}

export const MASTER_TOP_12_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "Underdog odds <= 2.80", points: -20 },
    { description: "Odds for draw is < 3.0", points: 10 },
    { description: "Odds for underdog <= odds for draw but >= 3.0", points: -10 },
    { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -5 },
    { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 },
    { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 15 },
    { description: "1X2 supports the underdog", points: -15 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 15 },
    { description: "High Conviction Defense + Attack Dominance", points: 20 },
    { description: "Algo support for Mfav > 50%", points: 15 },
    { description: "Algo support for Mfav is 45-50%", points: 10 },
    { description: "Algo for Mfav support <40%", points: -10 },
    { description: "Underdog has hidden strength", points: -20 },
    { description: "Underdog has hidden weakness", points: -15 },
    { description: "M.fav has hidden strength", points: 15 },
    { description: "M.fav has hidden weakness", points: -15 },
    { description: "Underdog has >= 5 more points on point system", points: -20 },
    { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 },
    { description: "PAA, Seer, and ML agree on 1X/X2", points: 10 },
    { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 20 },
    { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -10 },
    { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -15 },
    { description: "Sub pattern primary prediction supports the underdog", points: -20 },
    { description: "Algo primary prediction supports the underdog", points: -20 },
    { description: "Match has BB, T12, or BD opw < 10%", points: -20 },
    { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -15 },
    { description: "Underdog GS >Mfav GS with >=0.4 points", points: -15 },
    { description: "Mfav GA=Und GA (+-0.2)", points: 10 },
    { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: -10 },
    { description: "HGA=AGS + Equal GS", points: 15 },
    { description: "Match belong to israel leagues", points: -10 },
    { description: "Match belong to African leagues", points: -10 },
    { description: "Match belong to England Amateur", points: -10 },
    { description: "Match belong to norway 3rd division", points: -10 },
    { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -20 },
    { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 },
    { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 },
    { description: "A match has GS=GS=GA=GA", points: -10 },
    { description: "Sub pattern primary on draw and hedges with underdog", points: -10 },
    { description: "Both team GS => 1.8", points: -15 },
    { description: "Both teams GA >= 1.5", points: -15 },
    { description: "Underdog GA >= 1.5 and GS => 1.8", points: -15 },
    { description: "Mfav GS = Und Gs +-0.2", points: -15 },
    { description: "Underdog was away on LE and Won", points: -20 },
    { description: "LE was a draw+Underdog has hidden strength/weakness", points: -10 },
    { description: "1X2 Rating =>7", points: 15 },
    { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 15 },
    { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -20 },
    { description: "Match has Banned:Upset risk tag", points: -5 },
    { description: "Match has Banned:Draw risk tag", points: -5 },
    { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: -25 },
    { description: "Pha Underdog and Pha draw both >20%", points: -10 },
    { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -10 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -5 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -15 },
    { description: "Mfav L10 > Und L10 with >=3 points", points: 5 },
    { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 15 },
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

export const MASTER_BEST_BET_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "High Conviction Defense + Attack Dominance", points: 20 },
    { description: "Mfav TS >= 2.0 and Underdog TS < 0.7", points: 20 },
    { description: "Algo support for Mfav > 50%", points: 20 },
    { description: "Low Favorite Odds (< 1.80)", points: 20 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 20 },
    { description: "Odds difference >= 1.50", points: 20 },
    { description: "Seer score on draw <= 20%", points: 15 },
    { description: "Mfav GS = Und Gs +-0.2", points: -15 },
    { description: "Odds difference >= 1.0", points: 15 },
    { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 15 },
    { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 },
    { description: "Mfav L10 > Underdog L10", points: 15 },
    { description: "Underdog odds <= 2.80", points: -20 },
    { description: "Seer score on underdog >= 45%", points: -20 },
    { description: "Algo primary prediction supports the underdog", points: -20 },
    { description: "Underdog was away on LE and Won", points: -20 },
    { description: "Underdog has >= 5 more points on point system", points: -20 },
    { description: "Youth League (U21,U23,U20,U19)", points: -15 },
    { description: "Both teams GA >= 1.5", points: -15 },
    { description: "TS difference <= 0.1", points: -15 },
    { description: "Both team GS => 1.8", points: -15 },
    { description: "Match has Banned:Upset risk tag", points: -5 },
    { description: "Match has Banned:Draw risk tag", points: -5 },
    { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: -25 },
    { description: "Pha Underdog and Pha draw both >20%", points: -10 },
    { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -10 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -5 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -15 },
    { description: "Mfav L10 > Und L10 with >=3 points", points: 5 },
    { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 15 },
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

export const MASTER_BANKERS_DLIVE_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "High Conviction Defense + Attack Dominance", points: 20 },
    { description: "Low Favorite Odds (< 1.80)", points: 20 },
    { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 20 },
    { description: "Algo support for Mfav > 50%", points: 20 },
    { description: "Odds difference >= 1.50", points: 20 },
    { description: "Mfav TS >= 2.0 and Underdog TS < 0.7", points: 15 },
    { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 15 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 15 },
    { description: "Odds difference >= 1.0", points: 15 },
    { description: "TS difference >= 1.0", points: 15 },
    { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 15 },
    { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 },
    { description: "Seer score on draw <= 20%", points: 15 },
    { description: "1X2 Rating =>7", points: 15 },
    { description: "Mfav L10 >= 6", points: 15 },
    { description: "Underdog L10 <= 2", points: 15 },
    { description: "Ud GA < Mfav GA (defensive edge)", points: 10 },
    { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 10 },
    { description: "Mfav L10 > Underdog L10", points: 10 },
    { description: "Algo support for Mfav is 45-50%", points: 10 },
    { description: "Draw odds < 3.2 (draw absorbs)", points: 10 },
    { description: "PAA, Seer, and ML agree on 1X/X2", points: 5 },
    { description: "Mfav GA=Und GA (+-0.2)", points: 5 },
    { description: "Underdog odds <= 2.80", points: -20 },
    { description: "Algo primary prediction supports the underdog", points: -20 },
    { description: "Seer score on underdog >= 45%", points: -20 },
    { description: "Seer primary predicts on underdog", points: -20 },
    { description: "Sub pattern primary prediction supports the underdog", points: -20 },
    { description: "Underdog has >= 5 more points on point system", points: -20 },
    { description: "Underdog was away on LE and Won", points: -20 },
    { description: "Dead-Heat Draw Trap (Fav >= 2.50 + Ud <= 2.80 + Draw < 3.30)", points: -20 },
    { description: "High Favorite Odds (>= 2.50)", points: -15 },
    { description: "TS difference <= 0.1", points: -15 },
    { description: "Youth League (U21,U23,U20,U19)", points: -15 },
    { description: "Both teams GA >= 1.5", points: -15 },
    { description: "LE Underdog won with 2+ goals", points: -20 },
    { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -15 },
    { description: "Both team GS => 1.8", points: -10 },
    { description: "Both teams GA >= 1.1 (volatile match)", points: -10 },
    { description: "Match belong to African leagues", points: -10 },
    { description: "Match belong to israel leagues", points: -10 },
    { description: "Match belong to England Amateur", points: -10 },
    { description: "Match belong to norway 3rd division", points: -10 },
    { description: "Algo for Mfav support <40%", points: -5 },
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
export const MASTER_BANKERS_JACKPOT_RULES: { description: string; points: number }[] = MASTER_TOP_12_RULES.map(r => ({ ...r }));

// Trigger points for this category are intentionally identical to Top 12 (user directive).
export const MASTER_VALUE_PICKS_RULES: { description: string; points: number }[] = MASTER_TOP_12_RULES.map(r => ({ ...r }));

export const MASTER_UPSETS_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "Algo primary prediction supports the underdog", points: 25 },
    { description: "Seer score on underdog >= 45%", points: 25 },
    { description: "Seer primary predicts on underdog", points: 25 },
    { description: "Underdog was away on LE and Won", points: 20 },
    { description: "Underdog has >= 5 more points on point system", points: 25 },
    { description: "Underdog odds <= 2.80", points: 25 },
    { description: "Odds for underdog >= 3.0", points: 25 },
    { description: "Odds for underdog <= odds for draw but < 2.8", points: 20 },
    { description: "High Favorite Odds (>= 2.50)", points: 20 },
    { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 20 },
    { description: "Both teams GA > GS and Both team GS <=1.0", points: 15 },
    { description: "LE Underdog won with 2+ goals", points: 25 },
    { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 15 },
    { description: "LE : Underdog won the last encounter", points: 20 },
    { description: "Dead-Heat Draw Trap (Fav >= 2.50 + Ud <= 2.80 + Draw < 3.30)", points: -20 },
    { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 10 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: -20 },
    { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 20 },
    { description: "TS difference <= 0.1", points: 10 },
    { description: "Odds for underdog <= odds for draw but >= 3.0", points: 15 },
    { description: "Low Favorite Odds (< 1.80)", points: -20 },
    { description: "High Conviction Defense + Attack Dominance", points: -20 },
    { description: "Pha Underdog and Pha draw both >20%", points: 10 },
    { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: 10 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: 5 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: 15 },
    { description: "Mfav L10 > Und L10 with >=3 points", points: -5 },
    { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: -15 },
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

export const MASTER_BOTB_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "High Conviction Defense + Attack Dominance", points: 20 },
    { description: "Low Favorite Odds (< 1.80)", points: 20 },
    { description: "Algo support for Mfav > 50%", points: 20 },
    { description: "Odds difference >= 1.50", points: 20 },
    { description: "Underdog odds <= 2.80", points: -20 },
    { description: "Seer score on underdog >= 45%", points: -20 },
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

export function getMasterTriggerDefaultPoints(
    description: string,
    objective: 'mfav_draw' | 'mfav_only' | 'underdog_only' = 'mfav_draw',
    categoryId?: string
): number {
    const targetCat = categoryId || (objective === 'underdog_only' ? 'upsets' : (objective === 'mfav_only' ? 'best_bet' : 'top_12_value'));
    return borrowTriggerPoints(description, targetCat);
}

/**
 * Fills a category's rule set with all master catalog triggers.
 * Active tuned rules retain their custom points; unconfigured or 0-point catalog triggers
 * borrow sensible, empirically calibrated default points based on category objective and other days/categories.
 * GUARANTEE: No trigger ever has 0 points.
 */
export function populateCategoryWithMasterRules(
    tunedRules: { description: string; points: number }[],
    objective: 'mfav_draw' | 'mfav_only' | 'underdog_only' = 'mfav_draw',
    categoryId?: string,
    day?: string
): { description: string; points: number }[] {
    const targetCategory = categoryId || (objective === 'underdog_only' ? 'upsets' : (objective === 'mfav_only' ? 'best_bet' : 'top_12_value'));
    const existingMap = new Map<string, number>();
    const result: { description: string; points: number }[] = [];

    tunedRules.forEach(r => {
        const pts = r.points !== 0 ? r.points : borrowTriggerPoints(r.description, targetCategory, day);
        existingMap.set(r.description, pts);
        result.push({ description: r.description, points: pts });
    });

    ALL_MASTER_CATALOG_TRIGGERS.forEach(desc => {
        // "Odds for underdog >= 3.0" is strictly exclusive to the Upsets category (underdog_only)
        if (desc === "Odds for underdog >= 3.0" && objective !== 'underdog_only') {
            return;
        }
        if (!existingMap.has(desc)) {
            const defaultPts = borrowTriggerPoints(desc, targetCategory, day);
            result.push({ description: desc, points: defaultPts });
        }
    });

    try {
        const approved = loadApprovedCustomTriggers().filter(t => t.isActive);
        approved.forEach(a => {
            if (!existingMap.has(a.description)) {
                const pts = a.points !== 0 ? a.points : borrowTriggerPoints(a.description, targetCategory, day);
                result.push({ description: a.description, points: pts });
            }
        });
    } catch (e) {}

    const filtered = result.filter(r => {
        // Ensure obsolete triggers are never included
        if (r.description === "LE : Market Favorite won the last encounter" ||
            r.description === "1X2 Rating <= 2.5" ||
            r.description === "Medium Favorite Odds (1.80 - 2.20)") {
            return false;
        }
        // Ensure "Odds for underdog >= 3.0" only exists in underdog_only
        if (r.description === "Odds for underdog >= 3.0" && objective !== 'underdog_only') {
            return false;
        }
        return true;
    });

    return sanitizeRulePolarity(filtered, targetCategory);
}
