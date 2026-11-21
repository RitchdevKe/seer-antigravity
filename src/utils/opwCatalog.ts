/**
 * Complete Master Catalog of 96 Analyzed Triggers
 * Deduplicated, calibrated, and classified by domain & statistical power.
 */

export const REMOVED_TRIGGER_DESCRIPTIONS = new Set<string>([
    "Odds for underdog >= 3.0",
    "Odds for Draw and Underdog >= 3.0",
    "Algo support for Mfav > 50% + 1X2 Rating < 3.0",
    "Algo support for Mfav > 50%+1X2 Rating < 3.0",
    "1X2 Rating < 3.0 + Algo support for Mfav > 50%",
    "1X2 Rating < 3.0+Algo support for Mfav > 50%",
    "Underdog and draw odds >3.0 but und odds < draw odds",
    "Both teams GA > GS",
    "PHA TIE",
    "PHA is a tie between outcomes",
    "Both team GS => 1.8+Mfav GA=Und GA (+-0.2)",
    "Mfav GS> Underdog GS with >= 0.3",
    "Underdgog GS> Mfav gs with >=0.3",
    "Match belongs to Iraqi League",
    "Match belongs to Iraq: Iraqi League",
    "Match belongs to Iraq: League",
    "Match belongs to Iraq League",
    "Odds for draw is < 3.0",
    "Odds for draw is < 3.0+PAA, SubPattern, and Algo agree on 12 hedge",
    "Match is for Tournament",
    "Match is for tournament",
    "Match is for Carabao Cup",
    "Match is for carabao cup",
]);

export const BASELINE_20_LEAGUES = new Set<string>([
    "Match belongs to Iraqi stars league",
    "Match belongs to Premier League",
    "Match belongs to UEFA Champions League",
    "Match belongs to UEFA Europa League",
    "Match belongs to UEFA Conference League",
    "Match belongs to Serie A",
    "Match belongs to La Liga",
    "Match belongs to Bundesliga",
    "Match belongs to Ligue 1",
    "Match belongs to FA Cup",
    "Match belongs to Carabao Cup (EFL Cup)",
    "Match belongs to Carabao Cup",
    "Match belongs to Copa del Rey",
    "Match belongs to Coppa Italia",
    "Match belongs to DFB-Pokal",
    "Match belongs to Primeira Liga",
    "Match belongs to Eredivisie",
    "Match belongs to Belgian Pro League",
    "Match belongs to Süper Lig",
    "Match belongs to Czech First League",
    "Match belongs to Campeonato Brasileiro Série A",
    "Match belongs to EFL Championship"
]);

export const ALL_MASTER_CATALOG_TRIGGERS: string[] = [
    "Match belongs to Iraqi stars league",
    "Match belongs to EFL Championship",
    "Match belongs to Campeonato Brasileiro Série A",
    "Match belongs to Czech First League",
    "Match belongs to Süper Lig",
    "Match belongs to Belgian Pro League",
    "Match belongs to Eredivisie",
    "Match belongs to Primeira Liga",
    "Match belongs to DFB-Pokal",
    "Match belongs to Coppa Italia",
    "Match belongs to Copa del Rey",
    "Match belongs to Carabao Cup",
    "Match belongs to Carabao Cup (EFL Cup)",
    "Match belongs to FA Cup",
    "Match belongs to Ligue 1",
    "Match belongs to Bundesliga",
    "Match belongs to La Liga",
    "Match belongs to Serie A",
    "Match belongs to UEFA Conference League",
    "Match belongs to UEFA Europa League",
    "Match belongs to UEFA Champions League",
    "Match belongs to Premier League",
    "1X2 prediction is 1X or X2 in support of MFAV",
    "1X2 prediction is 1X or X2 in support of Underdog",
    "1X2 prediction is X",
    "Algo supports Mfav >=45% to <50%",
    "Mfav GS > Underdog GS with >= 0.3",
    "Underdog GS > Mfav GS with >= 0.3",
    "Odds for underdog <= odds for draw but >= 3.0",
    "1X2 Rating < 3.0+MFav TS <=1.2",
    "Seer score on draw <= 20%",
    "Seer score on draw >= 35% to <40%",
    "Seer score on draw >= 40%",
    "Seer score on Mfav <40%",
    "Seer score on Mfav =>40%  to <50%",
    "Seer score on Mfav =>50%  to <60%",
    "Seer score on Mfav =>60%  to <70%",
    "Seer score on Mfav =>70%",
    "Algo Mfav support =>50 to <55%",
    "Algo Mfav support =>55 to <60%",
    "Algo Mfav support =>60",
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
    "Odds for underdog <= odds for draw but < 2.8",
    "Odds for underdog <= odds for draw but between 2.8 to 3.0",
    "LE : Underdog won the last encounter",
    "LE Underdog won with 2+ goals",
    "Underdog was away on LE and Won",
    "LE was a draw+Underdog has hidden strength/weakness",
    "LE, Underdog won the last encounter +Mfav L10= Und L10",
    "Mfav is playing at home",
    "Youth League (U21,U20,U19)",
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
    "L10: Mfav Wins+ Draws = Underdog wins +Draws",
    "L10: Mfav Wins+ Draws > Underdog wins +Draws",
    "L10: Mfav Wins+ Draws < Underdog wins +Draws",
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0",
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav",
    "Both team L10 <= 5",
    "1X2 pred supports the underdog",
    "1X2 supports the underdog",
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
    "SubPattern is G2E5",
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav",
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)",
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)",
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)",
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0",
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)",
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12",
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8",
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)",
    "LE was a draw+1X2 Rating < 3.0",
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)",
    "Pha Underdog and Pha draw both >20%",
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness",
    "Mfav is away but was home last LE won with <=1 goal",
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0",
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1",
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal",
    "Match has Banned:Upset risk tag",
    "Match has Banned:Draw risk tag",
    "Seer score on draw >= 35%+1X2 Rating < 3.0",
    "Mfav GS=>2.0=Underdog GA +-0.2",
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%",
    "Mfav L10 > Und L10 with >=3 points",
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5",
    "Mfav L10(wins) >5 to 7",
    "Mfav L10(wins) >7",
    "Underdog L10(wins) >5 to 7",
    "Underdog L10(wins) >7",
    "Mfav L10(wins)>Und L10 but >=5",
    "Mfav L10(wins)>Und L10 but <5",
    "Und L10(wins)>Mfav L10 but >=5",
    "Und L10(wins)>Mfav L10 but <5",
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
    "PHA for Mfav <40%",
    "Underdog odds >3.0",
    "Underdog odds <=2.7",
    "Mfav odds >= 2.5",
    "Both team TS =< 1.0",
    "MFav TS <=1.2",
    "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%",
    "PHA on draw =>30%",
    "M.fav has hidden strength+Underdog has hidden strength",
    "Underdog has hidden weakness+M.fav has hidden weakness",
    "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2",
    "Youth League (U21,U20,U19)+ Both team GS => 1.8",
    "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0",
    "Underdog L10 <= 2",
    "Match has PHA TIE tag",
    "Both team GS => 1.8+Mfav GS = Und Gs +-0.2",
    "Underdog odds <= 2.80+Both team GS => 1.8",
    "Points for Draw =>30 on the point system",
    "Underdog has >= 5 more points on point system+Mfav is playing at home",
    "Underdog is at home",
    "Underdog has hidden strength+Underdog is at home",
    "Underdog has hidden weakness+Match has PHA TIE tag",
];

export const MASTER_MFAV_DRAW_POINTS: Record<string, number> = {
    "Match belongs to EFL Championship": 30,
    "Match belongs to Campeonato Brasileiro Série A": 30,
    "Match belongs to Czech First League": 30,
    "Match belongs to Süper Lig": 30,
    "Match belongs to Belgian Pro League": 30,
    "Match belongs to Eredivisie": 30,
    "Match belongs to Primeira Liga": 30,
    "Match belongs to DFB-Pokal": 30,
    "Match belongs to Coppa Italia": 30,
    "Match belongs to Copa del Rey": 30,
    "Match belongs to Carabao Cup": 30,
    "Match belongs to Carabao Cup (EFL Cup)": 30,
    "Match belongs to FA Cup": 30,
    "Match belongs to Ligue 1": 30,
    "Match belongs to Bundesliga": 30,
    "Match belongs to La Liga": 30,
    "Match belongs to Serie A": 30,
    "Match belongs to UEFA Conference League": 30,
    "Match belongs to UEFA Europa League": 30,
    "Match belongs to UEFA Champions League": 30,
    "Match belongs to Premier League": 40,
    "Algo supports Mfav >=45% to <50%": 10,
    "Mfav GS > Underdog GS with >= 0.3": 10,
    "Underdog GS > Mfav GS with >= 0.3": -10,
    "1X2 Rating < 3.0+MFav TS <=1.2": -20,
    "Seer score on draw <= 20%": 20,
    "Seer score on draw >= 35% to <40%": -30,
    "Seer score on draw >= 40%": -25,
    "Seer score on underdog >= 45%": -20,
    "Seer primary predicts on underdog": -20,
    "Seer score on Mfav <40%": -10,
    "Seer score on Mfav =>40%  to <50%": 10,
    "Seer score on Mfav =>50%  to <60%": 15,
    "Seer score on Mfav =>60%  to <70%": 20,
    "Seer score on Mfav =>70%": 25,
    "Algo Mfav support =>50 to <55%": 10,
    "Algo Mfav support =>55 to <60%": 15,
    "Algo Mfav support =>60": 20,
    "Algo support for Mfav > 50%": 20,
    "PAA Win probability >= 50%": 25,
    "Pha Underdog and Pha draw both >20%": -20,
    "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%": -15,
    "PHA on draw =>30%": -25,
    "Match has PHA TIE tag": -30,
    "Points for Draw =>30 on the point system": -10,
    "Both team GS => 1.8+Mfav GS = Und Gs +-0.2": -30,
    "Underdog odds <= 2.80+Both team GS => 1.8": -20,
    "Underdog has >= 5 more points on point system+Mfav is playing at home": 15,
    "Algo support for Mfav is 45-50%": 10,
    "Algo for Mfav support <40%": -10,
    "Algo final prediction is 1X/X2": 15,
    "Algo primary prediction supports the underdog": -20,
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 20,
    "PAA, Seer, Algo, and ML agree on 1X/X2": 15,
    "PAA, Seer, and ML agree on 1X/X2": 10,
    "PAA, SubPattern, Algo, and ML agree on 12 hedge": -10,
    "PAA, SubPattern, and Algo agree on 12 hedge": -5,
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": -5,
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -5,
    "Sub pattern primary on draw and hedges with underdog": -15,
    "Sub pattern primary prediction supports the underdog": -20,
    "1X2 Rating =>7": 20,
    "Mfav TS >= 3.0 and Ud TS < 0.8": 20,
    "Mfav TS 1.5-1.99 and Ud TS < 0.5": 15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8": 15,
    "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%": -25,
    "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%": -25,
    "M.fav TS >= 2.0 and Underdog TS < 1.0": 20,
    "TS difference <= 0.1": -5,
    "Underdog has hidden strength": -30,
    "M.fav has hidden strength": 15,
    "M.fav has hidden strength+Underdog has hidden strength": -15,
    "Underdog has hidden weakness+M.fav has hidden weakness": -15,
    "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2": 20,
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 15,
    "Both teams GS < 1.0": 15,
    "Both teams GS < 1.0 and Both team GS <GA": 10,
    "Both team GS => 1.8": 10,
    "Both teams GA > GS and Both team GS <=1.0": 15,
    "Both teams GA >= 1.1 (volatile match)": -5,
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": -15,
    "Both teams GA >= 1.5": -15,
    "M.fav GA is > 0.6 points lower than Underdog GA": 15,
    "Mfav GA=Und GA (+-0.2)": 5,
    "Mfav GS = Und Gs +-0.2": 5,
    "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": 5,
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength": 5,
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA": 5,
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)": 5,
    "Underdog GS < 1.0 but M.fav GS > 1.0": 15,
    "Underdog GS >Mfav GS with >=0.4 points": -10,
    "Underdog GA >= 1.5 and GS => 1.8": -10,
    "A match has GS=GS=GA=GA": 15,
    "Equal GS + AGA=HGS + M.fav has hidden strength": 15,
    "Equal GS + AGA=HGS + M.fav has hidden weakness": -15,
    "Underdog odds <= 2.80": -30,
    "Odds for underdog >= 2.80 to 3.0": 10,
    "Odds for underdog <= odds for draw but < 2.8": -15,
    "Odds for underdog <= odds for draw but between 2.8 to 3.0": -5,
    "LE : Underdog won the last encounter": -20,
    "LE Underdog won with 2+ goals": -20,
    "Underdog was away on LE and Won": -20,
    "LE was a draw+Underdog has hidden strength/weakness": -10,
    "LE, Underdog won the last encounter +Mfav L10= Und L10": -20,
    "Youth League (U21,U20,U19)": -15,
    "Match has BB, T12, or BD opw < 10%": -10,
    "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog": -20,
    "TS difference >= 1.0": 15,
    "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%": 15,
    "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%": -20,
    "LE was a draw": -15,
    "Mfav L10 = Und L10": -5,
    "LE was a draw + Mfav L10 = Und L10": -5,
    "LE was a draw + Mfav has hidden strength": 15,
    "Underdog has higher L10 than Mfav": -5,
    "L10: Mfav Wins+ Draws = Underdog wins +Draws": -5,
    "L10: Mfav Wins+ Draws > Underdog wins +Draws": 20,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws": -15,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0": -5,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav": -5,
    "Both team L10 <= 5": -15,
    "1X2 pred supports the underdog": -15,
    "1X2 supports the underdog": -15,
    "Mfav L10 and Underdog L10 difference <= 1": -15,
    "Underdog L10 <= 2": 15,
    "1X2 Rating < 3.0": -15,
    "1X2 Rating 5.0 to 7.0": 15,
    "Mfav GA <= 1.1 and Underdog GA > 1.1": 10,
    "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)": 20,
    "Mfav GS >= 1.5 and Underdog GS < 1.0": 15,
    "Underdog GA >= 1.8 and Mfav GA <= 1.0": 20,
    "PAA Win probability < 35%": -15,
    "PHA Draw probability >= 35%": 15,
    "PHA Underdog probability >= 35%": -15,
    "SubPattern is G2E5": -30,
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav": -20,
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)": -20,
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)": -20,
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)": -20,
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0": -20,
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)": -20,
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -20,
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8": -20,
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)": -20,
    "LE was a draw+1X2 Rating < 3.0": -15,
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)": -20,
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness": -15,
    "Underdog odds >3.0": 5,
    "Mfav is away but was home last LE won with <=1 goal": -5,
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0": -20,
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1": -15,
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal": -15,
    "Match has Banned:Upset risk tag": -5,
    "Match has Banned:Draw risk tag": -5,
    "Seer score on draw >= 35%+1X2 Rating < 3.0": -10,
    "Mfav GS=>2.0=Underdog GA +-0.2": -5,
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%": -15,
    "Mfav L10 > Und L10 with >=3 points": 5,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5": 15,
    "Mfav L10(wins) >5 to 7": 15,
    "Mfav L10(wins) >7": 25,
    "Underdog L10(wins) >5 to 7": -5,
    "Underdog L10(wins) >7": -5,
    "Mfav L10(wins)>Und L10 but >=5": 5,
    "Mfav L10(wins)>Und L10 but <5": 5,
    "Und L10(wins)>Mfav L10 but >=5": -5,
    "Und L10(wins)>Mfav L10 but <5": -5,
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
    "PHA for Mfav <40%": -15,
    "Underdog odds <=2.7": -20,
    "Mfav odds >= 2.5": -15,
    "Both team TS =< 1.0": -15,
    "MFav TS <=1.2": -10,
    "Youth League (U21,U20,U19)+ Both team GS => 1.8": -25,
    "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0": -10,
    "Underdog is at home": -5,
    "Underdog has hidden strength+Underdog is at home": -30,
    "Underdog has hidden weakness": -10,
    "Underdog has hidden weakness+Match has PHA TIE tag": -30,
    "Egypt: Second League": -30,
    "M.fav has hidden weakness": -5,
    "Underdog has >= 5 more points on point system": -5,
};

export const MASTER_MFAV_ONLY_POINTS: Record<string, number> = {
    "Match belongs to EFL Championship": 30,
    "Match belongs to Campeonato Brasileiro Série A": 30,
    "Match belongs to Czech First League": 30,
    "Match belongs to Süper Lig": 30,
    "Match belongs to Belgian Pro League": 30,
    "Match belongs to Eredivisie": 30,
    "Match belongs to Primeira Liga": 30,
    "Match belongs to DFB-Pokal": 30,
    "Match belongs to Coppa Italia": 30,
    "Match belongs to Copa del Rey": 30,
    "Match belongs to Carabao Cup": 30,
    "Match belongs to Carabao Cup (EFL Cup)": 30,
    "Match belongs to FA Cup": 30,
    "Match belongs to Ligue 1": 30,
    "Match belongs to Bundesliga": 30,
    "Match belongs to La Liga": 30,
    "Match belongs to Serie A": 30,
    "Match belongs to UEFA Conference League": 30,
    "Match belongs to UEFA Europa League": 30,
    "Match belongs to UEFA Champions League": 30,
    "Match belongs to Premier League": 40,
    "Algo supports Mfav >=45% to <50%": 10,
    "Mfav GS > Underdog GS with >= 0.3": 10,
    "Underdog GS > Mfav GS with >= 0.3": -10,
    "1X2 Rating < 3.0+MFav TS <=1.2": -20,
    "Seer score on draw <= 20%": 20,
    "Seer score on draw >= 35% to <40%": -30,
    "Seer score on draw >= 40%": -25,
    "Seer score on underdog >= 45%": -20,
    "Seer primary predicts on underdog": -20,
    "Seer score on Mfav <40%": -10,
    "Seer score on Mfav =>40%  to <50%": 10,
    "Seer score on Mfav =>50%  to <60%": 15,
    "Seer score on Mfav =>60%  to <70%": 20,
    "Seer score on Mfav =>70%": 25,
    "Algo Mfav support =>50 to <55%": 10,
    "Algo Mfav support =>55 to <60%": 15,
    "Algo Mfav support =>60": 20,
    "Algo support for Mfav > 50%": 20,
    "PAA Win probability >= 50%": 25,
    "Pha Underdog and Pha draw both >20%": -20,
    "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%": -15,
    "PHA on draw =>30%": -25,
    "Match has PHA TIE tag": -30,
    "Points for Draw =>30 on the point system": -10,
    "Both team GS => 1.8+Mfav GS = Und Gs +-0.2": -30,
    "Underdog odds <= 2.80+Both team GS => 1.8": -20,
    "Underdog has >= 5 more points on point system+Mfav is playing at home": 15,
    "Algo support for Mfav is 45-50%": 10,
    "Algo for Mfav support <40%": -15,
    "Algo final prediction is 1X/X2": 10,
    "Algo primary prediction supports the underdog": -20,
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 15,
    "PAA, Seer, Algo, and ML agree on 1X/X2": 10,
    "PAA, Seer, and ML agree on 1X/X2": 5,
    "PAA, SubPattern, Algo, and ML agree on 12 hedge": -5,
    "PAA, SubPattern, and Algo agree on 12 hedge": -5,
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": -5,
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -5,
    "Sub pattern primary on draw and hedges with underdog": -20,
    "Sub pattern primary prediction supports the underdog": -20,
    "1X2 Rating =>7": 20,
    "Mfav TS >= 3.0 and Ud TS < 0.8": 20,
    "Mfav TS 1.5-1.99 and Ud TS < 0.5": 15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8": 15,
    "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%": -25,
    "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%": -25,
    "M.fav TS >= 2.0 and Underdog TS < 1.0": 20,
    "TS difference <= 0.1": -10,
    "Underdog has hidden strength": -30,
    "M.fav has hidden strength": 15,
    "M.fav has hidden strength+Underdog has hidden strength": -15,
    "Underdog has hidden weakness+M.fav has hidden weakness": -15,
    "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2": 20,
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 15,
    "Both teams GS < 1.0": -10,
    "Both teams GS < 1.0 and Both team GS <GA": -10,
    "Both team GS => 1.8": 10,
    "Both teams GA > GS and Both team GS <=1.0": -10,
    "Both teams GA >= 1.1 (volatile match)": -10,
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": -15,
    "Both teams GA >= 1.5": -10,
    "M.fav GA is > 0.6 points lower than Underdog GA": 15,
    "Mfav GA=Und GA (+-0.2)": 5,
    "Mfav GS = Und Gs +-0.2": 5,
    "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": 5,
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength": 5,
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA": 5,
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)": 5,
    "Underdog GS < 1.0 but M.fav GS > 1.0": 15,
    "Underdog GS >Mfav GS with >=0.4 points": -15,
    "Underdog GA >= 1.5 and GS => 1.8": -10,
    "A match has GS=GS=GA=GA": -10,
    "Equal GS + AGA=HGS + M.fav has hidden strength": 15,
    "Equal GS + AGA=HGS + M.fav has hidden weakness": -15,
    "Underdog odds <= 2.80": -30,
    "Odds for underdog >= 2.80 to 3.0": -5,
    "Odds for underdog <= odds for draw but < 2.8": -15,
    "Odds for underdog <= odds for draw but between 2.8 to 3.0": -10,
    "LE : Underdog won the last encounter": -15,
    "LE Underdog won with 2+ goals": -20,
    "Underdog was away on LE and Won": -20,
    "LE was a draw+Underdog has hidden strength/weakness": -15,
    "LE, Underdog won the last encounter +Mfav L10= Und L10": -20,
    "Youth League (U21,U20,U19)": -15,
    "Match has BB, T12, or BD opw < 10%": -10,
    "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog": -20,
    "TS difference >= 1.0": 20,
    "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%": 15,
    "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%": -20,
    "LE was a draw": -15,
    "Mfav L10 = Und L10": -5,
    "LE was a draw + Mfav L10 = Und L10": -5,
    "LE was a draw + Mfav has hidden strength": 15,
    "Underdog has higher L10 than Mfav": -5,
    "L10: Mfav Wins+ Draws = Underdog wins +Draws": -5,
    "L10: Mfav Wins+ Draws > Underdog wins +Draws": 20,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws": -15,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0": -5,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav": -5,
    "Both team L10 <= 5": -15,
    "1X2 pred supports the underdog": -15,
    "1X2 supports the underdog": -15,
    "Mfav L10 and Underdog L10 difference <= 1": -15,
    "Underdog L10 <= 2": 15,
    "1X2 Rating < 3.0": -15,
    "1X2 Rating 5.0 to 7.0": 15,
    "Mfav GA <= 1.1 and Underdog GA > 1.1": 10,
    "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)": 20,
    "Mfav GS >= 1.5 and Underdog GS < 1.0": 15,
    "Underdog GA >= 1.8 and Mfav GA <= 1.0": 20,
    "PAA Win probability < 35%": -15,
    "PHA Draw probability >= 35%": -15,
    "PHA Underdog probability >= 35%": -15,
    "SubPattern is G2E5": -30,
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav": -20,
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)": -20,
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)": -20,
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)": -20,
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0": -20,
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)": -20,
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -20,
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8": -20,
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)": -20,
    "LE was a draw+1X2 Rating < 3.0": -15,
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)": -20,
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness": -15,
    "Underdog odds >3.0": 5,
    "Mfav is away but was home last LE won with <=1 goal": -5,
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0": -20,
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1": -15,
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal": -15,
    "Match has Banned:Upset risk tag": -5,
    "Match has Banned:Draw risk tag": -5,
    "Seer score on draw >= 35%+1X2 Rating < 3.0": -10,
    "Mfav GS=>2.0=Underdog GA +-0.2": -5,
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%": -15,
    "Mfav L10 > Und L10 with >=3 points": 5,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5": 15,
    "Mfav L10(wins) >5 to 7": 15,
    "Mfav L10(wins) >7": 25,
    "Underdog L10(wins) >5 to 7": -5,
    "Underdog L10(wins) >7": -5,
    "Mfav L10(wins)>Und L10 but >=5": 5,
    "Mfav L10(wins)>Und L10 but <5": 5,
    "Und L10(wins)>Mfav L10 but >=5": -5,
    "Und L10(wins)>Mfav L10 but <5": -5,
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
    "PHA for Mfav <40%": -15,
    "Underdog odds <=2.7": -20,
    "Mfav odds >= 2.5": -15,
    "Both team TS =< 1.0": -15,
    "MFav TS <=1.2": -10,
    "Youth League (U21,U20,U19)+ Both team GS => 1.8": -25,
    "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0": -10,
    "Underdog is at home": -5,
    "Underdog has hidden strength+Underdog is at home": -30,
    "Underdog has hidden weakness": -10,
    "Underdog has hidden weakness+Match has PHA TIE tag": -30,
    "Egypt: Second League": -30,
    "M.fav has hidden weakness": -5,
    "Underdog has >= 5 more points on point system": -5,
};

export const MASTER_UNDERDOG_ONLY_POINTS: Record<string, number> = {
    "Match belongs to EFL Championship": 30,
    "Match belongs to Campeonato Brasileiro Série A": 30,
    "Match belongs to Czech First League": 30,
    "Match belongs to Süper Lig": 30,
    "Match belongs to Belgian Pro League": 30,
    "Match belongs to Eredivisie": 30,
    "Match belongs to Primeira Liga": 30,
    "Match belongs to DFB-Pokal": 30,
    "Match belongs to Coppa Italia": 30,
    "Match belongs to Copa del Rey": 30,
    "Match belongs to Carabao Cup": 30,
    "Match belongs to Carabao Cup (EFL Cup)": 30,
    "Match belongs to FA Cup": 30,
    "Match belongs to Ligue 1": 30,
    "Match belongs to Bundesliga": 30,
    "Match belongs to La Liga": 30,
    "Match belongs to Serie A": 30,
    "Match belongs to UEFA Conference League": 30,
    "Match belongs to UEFA Europa League": 30,
    "Match belongs to UEFA Champions League": 30,
    "Match belongs to Premier League": 40,
    "Mfav is playing at home": -25,
    "Algo supports Mfav >=45% to <50%": -10,
    "Mfav GS > Underdog GS with >= 0.3": -10,
    "Underdog GS > Mfav GS with >= 0.3": 10,
    "1X2 Rating < 3.0+MFav TS <=1.2": 20,
    "Seer score on draw <= 20%": 15,
    "Seer score on draw >= 35% to <40%": -5,
    "Seer score on draw >= 40%": 25,
    "Seer score on underdog >= 45%": 20,
    "Seer primary predicts on underdog": 20,
    "Seer score on Mfav <40%": 10,
    "Seer score on Mfav =>40%  to <50%": -10,
    "Seer score on Mfav =>50%  to <60%": -15,
    "Seer score on Mfav =>60%  to <70%": -20,
    "Seer score on Mfav =>70%": -25,
    "Algo Mfav support =>50 to <55%": -10,
    "Algo Mfav support =>55 to <60%": -15,
    "Algo Mfav support =>60": -20,
    "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%": 15,
    "PHA on draw =>30%": 25,
    "Match has PHA TIE tag": 30,
    "Points for Draw =>30 on the point system": 10,
    "Both team GS => 1.8+Mfav GS = Und Gs +-0.2": 30,
    "Underdog odds <= 2.80+Both team GS => 1.8": 20,
    "Underdog has >= 5 more points on point system+Mfav is playing at home": -15,
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
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": 5,
    "Sub pattern primary on draw and hedges with underdog": 15,
    "Sub pattern primary prediction supports the underdog": 20,
    "1X2 Rating =>7": -20,
    "Mfav TS >= 3.0 and Ud TS < 0.8": -20,
    "Mfav TS 1.5-1.99 and Ud TS < 0.5": -15,
    "Mfav TS 1.0-1.50 and Ud TS < 0.8": 15,
    "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%": -5,
    "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%": -15,
    "M.fav TS >= 2.0 and Underdog TS < 1.0": 5,
    "TS difference <= 0.1": 10,
    "Underdog has hidden strength": 30,
    "M.fav has hidden strength": -15,
    "M.fav has hidden strength+Underdog has hidden strength": 15,
    "Underdog has hidden weakness+M.fav has hidden weakness": -15,
    "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2": -20,
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": -15,
    "Both teams GS < 1.0": 10,
    "Both teams GS < 1.0 and Both team GS <GA": -10,
    "Both team GS => 1.8": 10,
    "Both teams GA > GS and Both team GS <=1.0": -10,
    "Both teams GA >= 1.1 (volatile match)": 10,
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": 15,
    "Both teams GA >= 1.5": 10,
    "M.fav GA is > 0.6 points lower than Underdog GA": -15,
    "Mfav GA=Und GA (+-0.2)": 5,
    "Mfav GS = Und Gs +-0.2": 5,
    "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": 5,
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength": 5,
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA": 5,
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)": 5,
    "Underdog GS < 1.0 but M.fav GS > 1.0": -15,
    "Underdog GS >Mfav GS with >=0.4 points": 15,
    "Underdog GA >= 1.5 and GS => 1.8": 10,
    "A match has GS=GS=GA=GA": 5,
    "Equal GS + AGA=HGS + M.fav has hidden strength": -15,
    "Equal GS + AGA=HGS + M.fav has hidden weakness": 15,
    "Underdog odds <= 2.80": -15,
    "Odds for underdog >= 2.80 to 3.0": -15,
    "Odds for underdog <= odds for draw but < 2.8": -20,
    "Odds for underdog <= odds for draw but between 2.8 to 3.0": -15,
    "Odds for underdog <= odds for draw but >= 3.0": 25,
    "Underdog odds >3.0": 15,
    "LE : Underdog won the last encounter": 15,
    "LE Underdog won with 2+ goals": 20,
    "Underdog was away on LE and Won": 20,
    "LE was a draw+Underdog has hidden strength/weakness": 15,
    "LE, Underdog won the last encounter +Mfav L10= Und L10": 20,
    "Youth League (U21,U20,U19)": 15,
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
    "L10: Mfav Wins+ Draws = Underdog wins +Draws": 15,
    "L10: Mfav Wins+ Draws > Underdog wins +Draws": -20,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws": 15,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0": 5,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav": 5,
    "Both team L10 <= 5": 15,
    "1X2 pred supports the underdog": 15,
    "1X2 supports the underdog": 15,
    "Mfav L10 and Underdog L10 difference <= 1": 15,
    "Underdog L10 <= 2": -15,
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
    "SubPattern is G2E5": 30,
    "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav": 20,
    "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)": 20,
    "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)": 15,
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)": 25,
    "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0": 20,
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)": 15,
    "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": 10,
    "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8": 20,
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)": 15,
    "LE was a draw+1X2 Rating < 3.0": 15,
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)": 15,
    "Pha Underdog and Pha draw both >20%": 10,
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness": -15,
    "Mfav is away but was home last LE won with <=1 goal": 10,
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0": 20,
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1": 15,
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal": 15,
    "Match has Banned:Upset risk tag": 10,
    "Match has Banned:Draw risk tag": 5,
    "Seer score on draw >= 35%+1X2 Rating < 3.0": 10,
    "Mfav GS=>2.0=Underdog GA +-0.2": 5,
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%": 15,
    "Mfav L10 > Und L10 with >=3 points": -5,
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5": -15,
    "Mfav L10(wins) >5 to 7": -15,
    "Mfav L10(wins) >7": -25,
    "Underdog L10(wins) >5 to 7": 20,
    "Underdog L10(wins) >7": 25,
    "Mfav L10(wins)>Und L10 but >=5": -5,
    "Mfav L10(wins)>Und L10 but <5": -5,
    "Und L10(wins)>Mfav L10 but >=5": 5,
    "Und L10(wins)>Mfav L10 but <5": 5,
    "Mfav was away and won last Encounter <=1 goal": 5,
    "Mfav was home and won last Encounter <=1 goal": 5,
    "Mfav was home and won last Encounter >1 to =<3 goal": -10,
    "Mfav was Away and won last Encounter >1 to =<3 goal": -10,
    "Mfav was home and won last Encounter >3 goal": -10,
    "Mfav was Away and won last Encounter >3 goal": -10,
    "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points": 15,
    "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points": -10,
    "PHA for Mfav <40%": -15,
    "Underdog odds <=2.7": -20,
    "Mfav odds >= 2.5": -15,
    "Both team TS =< 1.0": -15,
    "MFav TS <=1.2": -10,
    "Youth League (U21,U20,U19)+ Both team GS => 1.8": 25,
    "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0": 10,
    "Underdog is at home": 5,
    "Underdog has hidden strength+Underdog is at home": 30,
    "Underdog has hidden weakness": 10,
    "Underdog has hidden weakness+Match has PHA TIE tag": 30,
    "Egypt: Second League": 30,
    "M.fav has hidden weakness": 5,
    "Underdog has >= 5 more points on point system": 5,
};

// ============================================================================
// CANONICAL SEMANTIC POLARITY TAXONOMY & RUNTIME SANITIZATION
// Rules:
// 1. Pro-underdog triggers: Strictly penalties in Mfav / Top 12. Range strictly [-30, -5].
// 2. Pro-Mfav triggers: Strictly bonuses in Mfav / Top 12. Range strictly [+5, +30] (up to +40 for Big 5).
// 3. Neutral triggers (League triggers only): Can move between bonus [+5, +30] and penalty [maxPenalty, -5]
//    independently in both Pro-Mfav and Pro-Underdog categories.
//    - Standard uncalibrated league penalty cap: -20
//    - African, Saudi Arabia, and Israel league penalty cap: -35
//    - Manually calibrated league penalties deeper than -20 preserve their calibrated bound.
// ============================================================================

export type TriggerSemanticPolarity = 'PRO_MFAV' | 'PRO_UNDERDOG' | 'NEUTRAL';

export const UPSETS_EXPLICIT_PENALTIES: Record<string, number> = {
    "L10: Mfav Wins+ Draws > Underdog wins +Draws": -20,
    "Underdog odds <= 2.80": -15,
    "Underdog odds <= 2.8": -15,
    "Underdog odds <=2.7": -20,
    "Underdog odds <= 2.7": -20,
    "Underdog odds <= 2.70": -20,
    "M.fav has hidden weakness": -10,
    "Mfav has hidden weakness": -10,
    "Odds for underdog <= odds for draw but < 2.8": -20,
    "Underdog has hidden weakness": -15,
    "Mfav odds >= 2.5": -15,
    "Mfav odds >= 2.50": -15,
    "Odds for underdog >= 2.80 to 3.0": -15,
    "Odds for underdog <= odds for draw but between 2.8 to 3.0": -15,
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness": -15,
};

export const USER_EXPLICIT_UNDERDOG_PENALTIES: Record<string, number> = {
    "Underdog L10(wins) >5 to 7": -5,
    "Underdog L10(wins) >7": -5,
    "Und L10(wins)>Mfav L10 but >=5": -5,
    "Und L10(wins)>Mfav L10 but <5": -5,
    "Both team L10 <= 5": -15,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws": -15,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0": -5,
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav": -5,
    "1X2 pred supports the underdog": -15,
    "1X2 supports the underdog": -15,
    "Underdog GS > Mfav GS with >= 0.3": -10,
    "1X2 Rating < 3.0+MFav TS <=1.2": -20,
    "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%": -15,
    "Seer score on Mfav <40%": -10,
    "M.fav has hidden strength+Underdog has hidden strength": -15,
    "Underdog has hidden weakness+M.fav has hidden weakness": -15,
    "Seer score on draw >= 35% to <40%": -30,
    "Seer score on draw >= 40%": -25,
    "PHA on draw =>30%": -25,
    "Match has PHA TIE tag": -30,
    "Youth League (U21,U20,U19)": -20,
    "Youth League (U21,U23,U20,U19)": -20,
    "Youth League (U21,U20,U19)+ Both team GS => 1.8": -15,
    "LE Underdog won with 2+ goals": -20,
    "MFav TS <=1.2": -10,
    "Mfav TS <= 1.2": -10,
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -5,
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": -5,
    "Mfav L10 = Und L10": -5,
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1": -10,
    "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)": -15,
    "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)": -15,
    "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)": -15,
    "Underdog has hidden strength": -30,
    "Both teams GA >= 1.5": -10,
    "Pha Underdog and Pha draw both >20%": -20,
    "PHA on Underdog and Draw =>20%": -20,
    "PHA on Underdog and Draw >=20%": -20,
    "SubPattern is G2E5": -30,
    "Underdog odds <=2.7": -20,
    "Underdog odds <= 2.80": -30,
    "1X2 Rating < 3.0": -15,
    "Underdog is at home": -5,
    "Underdog has hidden strength+Underdog is at home": -30,
    "Underdog has hidden weakness": -10,
    "Underdog has hidden weakness+Match has PHA TIE tag": -30,
    "Egypt: Second League": -30,
    "M.fav has hidden weakness": -5,
    "Underdog has >= 5 more points on point system": -5,
};

export const PRO_MFAV_TRIGGERS = new Set<string>([
    "L10: Mfav Wins+ Draws > Underdog wins +Draws",
    "Algo supports Mfav >=45% to <50%",
    "Underdog has >= 5 more points on point system+Mfav is playing at home",
    "Mfav GS > Underdog GS with >= 0.3",
    "Mfav is playing at home",
    "Algo support for Mfav > 50%",
    "Algo support for Mfav is 45-50%",
    "Algo final prediction is 1X/X2",
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2",
    "PAA, Seer, Algo, and ML agree on 1X/X2",
    "PAA, Seer, and ML agree on 1X/X2",
    "1X2 Rating =>7",
    "1X2 Rating 5.0 to 7.0",
    "Mfav TS >= 3.0 and Ud TS < 0.8",
    "Mfav TS 1.5-1.99 and Ud TS < 0.5",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8",
    "M.fav TS >= 2.0 and Underdog TS < 1.0",
    "Underdog L10 <= 2",
    "Odds difference >= 1.50",
    "TS difference >= 1.0",
    "M.fav has hidden strength",
    "Equal GS + AGA=HGS + M.fav has hidden strength",
    "M.fav GA is > 0.6 points lower than Underdog GA",
    "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)",
    "Underdog GS < 1.0 but M.fav GS > 1.0",
    "Mfav GS >= 1.5 and Underdog GS < 1.0",
    "Mfav GA <= 1.1 and Underdog GA > 1.1",
    "Underdog GA >= 1.8 and Mfav GA <= 1.0",
    "PAA Win probability >= 50%",
    "Market Favorite has strong home advantage",
    "Market favorite high win probability",
    "Dominant Attack & Defense",
    "Low Favorite Odds (< 1.80)",
    "Mfav GS >= 2.0 and Underdog GA >= 1.5 (High Firepower)",
    "Mfav L10 > Und L10 with >=3 points",
    "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5",
    "Mfav L10(wins) >5 to 7",
    "Mfav L10(wins) >7",
    "Underdog L10(wins) >5 to 7",
    "Underdog L10(wins) >7",
    "Mfav L10(wins)>Und L10 but >=5",
    "Mfav L10(wins)>Und L10 but <5",
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
    "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)",
    "Seer score on draw <= 20%",
    "Underdog odds >3.0",
    "Underdog odds > 3.0",
    "Both team GS => 1.8",
    "Both teams GS => 1.8",
    "Seer score on Mfav =>40%  to <50%",
    "Seer score on Mfav =>50%  to <60%",
    "Seer score on Mfav =>60%  to <70%",
    "Seer score on Mfav =>70%",
    "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2",
    "Algo Mfav support =>50 to <55%",
    "Algo Mfav support =>55 to <60%",
    "Algo Mfav support =>60",
]);

export const PRO_UNDERDOG_TRIGGERS = new Set<string>([
    "Underdog L10(wins) >5 to 7",
    "Underdog L10(wins) >7",
    "Und L10(wins)>Mfav L10 but >=5",
    "Und L10(wins)>Mfav L10 but <5",
    "L10: Mfav Wins+ Draws < Underdog wins +Draws",
    "1X2 pred supports the underdog",
    "1X2 supports the underdog",
    "Egypt: Second League",
    "Match has PHA TIE tag",
    "Both team GS => 1.8+Mfav GS = Und Gs +-0.2",
    "Underdog odds <= 2.80+Both team GS => 1.8",
    "Points for Draw =>30 on the point system",
    "Underdog GS > Mfav GS with >= 0.3",
    "1X2 Rating < 3.0+MFav TS <=1.2",
    "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%",
    "Seer score on Mfav <40%",
    "M.fav has hidden strength+Underdog has hidden strength",
    "Underdog has hidden weakness+M.fav has hidden weakness",
    "Seer score on draw >= 35% to <40%",
    "Seer score on draw >= 40%",
    "PHA on draw =>30%",
    "Mfav was away and won last Encounter <=1 goal",
    "Mfav was Away and won last Encounter <=1 goal",
    "Mfav was home and won last Encounter <=1 goal",
    "Mfav was Home and won last Encounter <=1 goal",
    "Mfav L10 = Und L10",
    "Mfav is away but was home last LE won with <=1 goal",
    "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0",
    "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1",
    "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal",
    "Match has Banned:Upset risk tag",
    "Match has Banned:Draw risk tag",
    "LE was a draw + Mfav has hidden strength",
    "PHA Draw probability >= 35%",
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
    "Equal GS + AGA=HGS + M.fav has hidden weakness",
    "Underdog GS >Mfav GS with >=0.4 points",
    "Underdog GA >= 1.5 and GS => 1.8",
    "Both teams GA >= 1.1 (volatile match)",
    "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength",
    "Both teams GA >= 1.5",
    "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8",
    "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%",
    "Underdog odds <= 2.80",
    "Odds for underdog <= odds for draw but < 2.8",
    "Odds for underdog <= odds for draw but between 2.8 to 3.0",
    "Odds for underdog <= odds for draw but >= 3.0",
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
    "Youth League (U21,U20,U19)",
    "Youth League (U21,U23,U20,U19)",
    "Match has BB, T12, or BD opw < 10%",
    "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog",
    "Underdog has higher L10 than Mfav",
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Odds for underdog >= 2.80 to 3.0",
    "L10: Mfav Wins+ Draws < Underdog wins +Draws+Underdog has higher L10 than Mfav",
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
    "Youth League (U21,U20,U19)+ Both team GS => 1.8",
    "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)",
    "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12",
    "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12",
    "Mfav L10 and Underdog L10 difference <= 1",
    "LE was a draw",
    "Pha Underdog and Pha draw both >20%",
    "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness",
    "Seer score on draw >= 35%+1X2 Rating < 3.0",
    "Mfav GS=>2.0=Underdog GA +-0.2",
    "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%",
    "PHA for Mfav <40%",
    "Underdog odds <=2.7",
    "Mfav odds >= 2.5",
    "Both team TS =< 1.0",
    "MFav TS <=1.2",
    "Mfav TS <= 1.2",
    "SubPattern is G2E5",
    "Both teams GS < 1.0",
    "Underdog is at home",
    "Underdog has hidden strength+Underdog is at home",
    "Underdog has hidden weakness",
    "Underdog has hidden weakness+Match has PHA TIE tag",
    "M.fav has hidden weakness",
    "Underdog has >= 5 more points on point system",
]);

/**
 * Dual-Bonus Triggers: Neutral bidirectional triggers that can take either bonuses (+5 to +30)
 * or penalties (-5 to -30) across all categories based on empirical accuracy.
 */
export const DUAL_BONUS_TRIGGERS = new Set<string>([
    "Seer score on draw <= 20%",
    "Underdog odds >3.0",
    "Underdog odds > 3.0",
    "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points",
    "Mfav was Home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points",
    "M.fav has hidden weakness",
    "M.fav TS >= 2.0 and Underdog TS < 1.0",
    "Both team GS => 1.8",
    "Both teams GS => 1.8",
    "Underdog has >= 5 more points on point system",
    "Mfav GA=Und GA (+-0.2)",
    "Mfav GS = Und Gs +-0.2",
    "Mfav GS = Und GS +-0.2",
    "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA",
    "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength",
    "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA",
    "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)",
]);

export function isLeagueTrigger(triggerName: string): boolean {
    const d = (triggerName || '').trim().toLowerCase();
    if (!d || d.includes('+')) return false;
    return (
        d.startsWith('match belongs to ') ||
        d.startsWith('match belong to ') ||
        d.startsWith('match belogs to') ||
        d.startsWith('match belomgs to') ||
        d.startsWith('match belongs ') ||
        d === 'egypt: second league'
    );
}

export function isAfricanSaudiOrIsraelLeagueTrigger(triggerName: string): boolean {
    if (!isLeagueTrigger(triggerName)) return false;
    const d = (triggerName || '').trim().toLowerCase();
    return /\b(?:african|africa|caf\b|egypt|egyptian|south\s*africa|kenya|fkf\b|tanzania|ligi\s*kuu|morocco|botola|algeria|tunisia|nigeria|ghana|zambia|uganda|ethiopia|senegal|cameroon|ivory\s*coast|cote\s*d'?ivoire|mali\b|congo|angola|zimbabwe|botswana|rwanda|burundi|sudan|libya|mauritania|benin|togo|burkina\s*faso|guinea|mozambique|namibia|malawi|gambia|sierra\s*leone|liberia|gabon|saudi\s*arabia|saudi\b|israel|liga\s*leumit|liga\s*alef|ligat\s*ha'?al)\b/i.test(d);
}

export function isEnglishPremierLeagueTrigger(triggerName: string): boolean {
    const d = (triggerName || '').trim();
    return /^match belongs? to (?:english\s+|england\s*:\s*|england\s*-\s*)?premier\s+league$/i.test(d);
}

export function getLeagueTriggerMaxPenalty(triggerName: string): number {
    if (!isLeagueTrigger(triggerName)) return -30;
    if (isEnglishPremierLeagueTrigger(triggerName)) {
        return -40;
    }
    return -30;
}

export function getLeagueTriggerMaxBonus(triggerName: string, isUpsets: boolean = false): number {
    if (!isLeagueTrigger(triggerName)) {
        return 30;
    }
    if (isEnglishPremierLeagueTrigger(triggerName)) {
        return 40;
    }
    return 30;
}

/**
 * The 8 high-priority L10 triggers with expanded ±35 point bounds across all categories
 * and elevated computation priority alongside league triggers.
 */
export const PRIORITY_L10_TRIGGERS = new Set<string>([
    "L10: Mfav Wins+ Draws < Underdog wins +Draws",
    "L10: Mfav Wins+ Draws > Underdog wins +Draws",
    "L10: Mfav Wins+ Draws = Underdog wins +Draws",
    "Mfav L10(wins) >5 to 7",
    "Mfav L10(wins)>Und L10 but >=5",
    "Mfav L10(wins)>Und L10 but <5",
    "Und L10(wins)>Mfav L10 but >=5",
    "Und L10(wins)>Mfav L10 but <5",
]);

export function isPriorityL10Trigger(triggerName: string): boolean {
    return PRIORITY_L10_TRIGGERS.has((triggerName || '').trim());
}

/**
 * High-priority triggers during OPW P RECOM computation:
 * the 8 Priority L10 triggers + all League triggers.
 */
export function isPriorityComputationTrigger(triggerName: string): boolean {
    return isPriorityL10Trigger(triggerName) || isLeagueTrigger(triggerName);
}

export function getTriggerMaxPenalty(triggerName: string): number {
    if (isEnglishPremierLeagueTrigger(triggerName)) return -40;
    if (isPriorityL10Trigger(triggerName)) return -35;
    if (isLeagueTrigger(triggerName)) return getLeagueTriggerMaxPenalty(triggerName);
    return -30;
}

export function getTriggerMaxBonus(triggerName: string, isUpsets: boolean = false): number {
    if (isEnglishPremierLeagueTrigger(triggerName)) return 40;
    if (isPriorityL10Trigger(triggerName)) return 35;
    if (isLeagueTrigger(triggerName)) return getLeagueTriggerMaxBonus(triggerName, isUpsets);
    return 30;
}

const PRO_UD_STORAGE_KEY = 'opw_manual_pro_underdog_leagues_v2';

// League triggers are strictly NEUTRAL and never permanently locked to PRO_UNDERDOG
export const USER_MANUAL_PRO_UNDERDOG_LEAGUES = new Set<string>();

if (typeof window !== 'undefined' && window.localStorage) {
    try {
        window.localStorage.removeItem('opw_manual_pro_underdog_leagues_v1');
        window.localStorage.removeItem(PRO_UD_STORAGE_KEY);
    } catch (e) {}
}

function persistProUnderdogLeagues(): void {}

export function resetAllLeaguesToNeutral(): void {
    USER_MANUAL_PRO_UNDERDOG_LEAGUES.clear();
    CATEGORY_LOCKED_PRO_UNDERDOG_LEAGUES.clear();
}

export function isManuallyAdjustedProUnderdogLeague(_triggerName: string): boolean {
    return false;
}

export function markLeagueAsProUnderdog(_triggerName: string): void {}

export function markLeagueAsNeutral(triggerName: string): void {
    if (isLeagueTrigger(triggerName)) {
        USER_MANUAL_PRO_UNDERDOG_LEAGUES.delete(triggerName);
    }
}

const CATEGORY_LOCKED_PRO_UD_STORAGE_KEY = 'opw_cat_locked_pro_underdog_leagues_v2';

export const CATEGORY_LOCKED_PRO_UNDERDOG_LEAGUES = new Map<string, Set<string>>();

if (typeof window !== 'undefined' && window.localStorage) {
    try {
        window.localStorage.removeItem('opw_cat_locked_pro_underdog_leagues_v1');
        window.localStorage.removeItem(CATEGORY_LOCKED_PRO_UD_STORAGE_KEY);
    } catch (e) {}
}

function persistCategoryLockedProUnderdogLeagues(): void {}

export function isLeagueLockedProUnderdog(_triggerName: string, _categoryId?: string, _day?: string): boolean {
    return false;
}

export function lockLeagueAsProUnderdog(_triggerName: string, _categoryId: string, _day?: string): void {}

export function unlockLeagueProUnderdog(_triggerName: string, _categoryId: string, _day?: string): void {}

export const NEUTRAL_TRIGGERS = new Set<string>([
    "L10: Mfav Wins+ Draws = Underdog wins +Draws",
]);

export function getTriggerSemanticPolarity(triggerName: string, categoryIdOrObjective?: string): TriggerSemanticPolarity {
    if (
        NEUTRAL_TRIGGERS.has(triggerName) ||
        triggerName.toLowerCase().includes('mfav wins+ draws = underdog wins +draws') ||
        triggerName.toLowerCase().includes('mfav wins+draws = underdog wins+draws')
    ) {
        return 'NEUTRAL';
    }

    // League triggers are strictly NEUTRAL across all categories:
    // They are allowed to switch freely between penalties and bonuses based on empirical evidence,
    // and can have a penalty on Pro Mfav matches as well as a penalty on Pro Underdog matches.
    if (isLeagueTrigger(triggerName)) {
        return 'NEUTRAL';
    }

    // DUAL_BONUS_TRIGGERS are strictly NEUTRAL across all categories
    if (DUAL_BONUS_TRIGGERS.has(triggerName)) {
        return 'NEUTRAL';
    }

    if (
        triggerName === "Both team L10 <= 5" ||
        triggerName.toLowerCase().includes("both team l10 <= 5") ||
        triggerName.toLowerCase().includes("both teams l10 <= 5")
    ) {
        return 'PRO_UNDERDOG';
    }

    const isUpsetsContext =
        categoryIdOrObjective === 'upsets' ||
        categoryIdOrObjective === 'upset' ||
        categoryIdOrObjective === 'underdog_upsets' ||
        categoryIdOrObjective === 'underdog_only';

    if (isUpsetsContext && UPSETS_EXPLICIT_PENALTIES[triggerName] !== undefined) {
        return 'PRO_MFAV';
    }

    if (PRO_UNDERDOG_TRIGGERS.has(triggerName)) return 'PRO_UNDERDOG';
    if (PRO_MFAV_TRIGGERS.has(triggerName)) return 'PRO_MFAV';

    const lower = triggerName.toLowerCase();

    // Explicit user-specified underdog triggers check:
    if (
        lower.includes('youth league') ||
        lower.includes('saudi arabia division 1') ||
        lower.includes('latvia leagues') ||
        lower.includes('hong kong leagues') ||
        lower.includes('costa rica leagues') ||
        lower.includes('italy series c') ||
        lower.includes('serie c') ||
        lower.includes('kosovo leagues') ||
        lower.includes('superettan') ||
        lower.includes('both teams ga >= 1.5') ||
        lower.includes('mfav ts <=1.2') ||
        lower.includes('mfav ts <= 1.2') ||
        lower.includes('sub pattern and algo final is 12') ||
        lower.includes('mfav l10 = und l10') ||
        lower.includes('difference <= 1') ||
        lower.includes('underdog won') ||
        lower.includes('underdog has hidden strength') ||
        lower.includes('underdog has hidden strenght') ||
        lower.includes('non european major leagues') ||
        lower.includes('underdog odds <=') ||
        lower.includes('norway: 3. division - girone 1') ||
        lower.includes('eerste divisie') ||
        lower.includes('colombia: primera b') ||
        lower.includes('liga panameña') ||
        lower.includes('erovnuli liga') ||
        lower.includes('süper lig') ||
        lower.includes('pha on draw =>30%') ||
        lower.includes('pha tie') ||
        lower.includes('le was a draw') ||
        lower.includes('supports the underdog') ||
        lower.includes('predicts on underdog') ||
        lower.includes('draw probability >= 35%') ||
        lower.includes('volatile') ||
        lower.includes('european chasers') ||
        lower.includes('banned:upset risk') ||
        lower.includes('banned:draw risk') ||
        lower.includes('both teams gs < 1.0') ||
        lower.includes('mfav wins+ draws < underdog wins +draws') ||
        lower.includes('mfav wins+draws < underdog wins+draws') ||
        lower.includes('und l10(wins)>mfav l10')
    ) {
        return 'PRO_UNDERDOG';
    }

    if (
        lower.includes('mfav wins+ draws > underdog wins +draws') ||
        lower.includes('mfav wins+draws > underdog wins+draws') ||
        lower.includes('both team gs => 1.8') ||
        lower.includes('both teams gs => 1.8') ||
        (lower.includes('estonia leagues') && !lower.includes('youth')) ||
        lower.includes('underdog has >= 5 more points') ||
        lower.includes('seer score on mfav =>') ||
        lower.includes('algo mfav support =>') ||
        lower.includes('superliga') ||
        lower.includes('liga leumit') ||
        lower.includes('primera a') ||
        (lower.includes('argentina') && lower.includes('no league')) ||
        lower.includes('mfav > 50%') ||
        lower.includes('algo support for mfav') ||
        lower.includes('algo final prediction is 1x/x2') ||
        lower.includes('agree on 1x/x2') ||
        lower.includes('m.fav has hidden strength') ||
        lower.includes('mfav l10 > underdog') ||
        lower.includes('mfav l10 > und l10') ||
        lower.includes('mfav l10(wins)') ||
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
        lower.includes('big 5 league') ||
        lower.includes('uefa,efl') ||
        lower.includes('uefa, efl') ||
        lower.includes('thailand') ||
        lower.includes('underdog odds >3.0') ||
        lower.includes('underdog odds > 3.0') ||
        lower.includes('seer score on draw <= 20%') ||
        lower.includes('underdog gs < 1.0 but m.fav gs > 1.0') ||
        lower.includes('mfav ga <= 1.1 and underdog ga > 1.1')
    ) {
        return 'PRO_MFAV';
    }

    // Strict fallback for non-league triggers: If not explicitly pro-mfav, treat as PRO_UNDERDOG
    return 'PRO_UNDERDOG';
}

export const DYNAMIC_LEAGUE_TRIGGERS = new Set<string>();
export function registerDiscoveredLeagueTrigger(triggerName: string): boolean {
    if (!triggerName.startsWith("Match belongs to ") && !triggerName.startsWith("Match belong to ")) return false;
    if (REMOVED_TRIGGER_DESCRIPTIONS.has(triggerName)) return false;
    if (/\bleagues\b/i.test(triggerName)) return false;
    if (!DYNAMIC_LEAGUE_TRIGGERS.has(triggerName)) {
        DYNAMIC_LEAGUE_TRIGGERS.add(triggerName);
        if (!ALL_MASTER_CATALOG_TRIGGERS.includes(triggerName)) {
            ALL_MASTER_CATALOG_TRIGGERS.push(triggerName);
        }
        const isBaseline = BASELINE_20_LEAGUES.has(triggerName);
        const isPremier = isEnglishPremierLeagueTrigger(triggerName);
        const mfavPts = isPremier ? 40 : (isBaseline ? 30 : 5);
        const underdogPts = 5;

        if (MASTER_MFAV_DRAW_POINTS[triggerName] === undefined) {
            MASTER_MFAV_DRAW_POINTS[triggerName] = mfavPts;
        }
        if (MASTER_MFAV_ONLY_POINTS[triggerName] === undefined) {
            MASTER_MFAV_ONLY_POINTS[triggerName] = mfavPts;
        }
        if (MASTER_UNDERDOG_ONLY_POINTS[triggerName] === undefined) {
            MASTER_UNDERDOG_ONLY_POINTS[triggerName] = underdogPts;
        }
        return true;
    }
    return false;
}

/**
 * Normalizes any category string variant, display label (e.g. "Value Picks (Monday)"),
 * or abbreviation to its canonical OPW category identifier.
 */
export function normalizeOpwCategoryId(catId?: string): string {
    const c = (catId || '').toLowerCase().trim();
    if (!c) return 'top_12_value';
    if (c.includes('value_pick') || c.includes('value pick') || c === 'vp') return 'value_picks';
    if (c.includes('value_bet') || c.includes('value bet') || c === 'vb') return 'value_bets';
    if (c.includes('top_12') || c.includes('top 12') || c.includes('top12') || c.includes('top_10') || c.includes('top 10') || c.includes('top10') || c === 't12') return 'top_12_value';
    if (c.includes('upset') || c.includes('underdog') || c === 'ups') return 'upsets';
    if (c.includes('dlive') || c.includes('banker_dlive') || c === 'bdl') return 'bankers_dlive';
    if (c.includes('jackpot') || c.includes('banker_jackpot') || c === 'bnk') return 'bankers_jackpot';
    if (c.includes('best_bet') || c.includes('best bet') || c === 'bb') return 'best_bet';
    if (c.includes('botb')) return 'botb_best';
    return c;
}

export function sanitizeRulePolarity<T extends Record<string, number> | { description: string; points: number }[]>(
    rules: T,
    categoryId: string = 'top_12_value',
    options?: { preserveExact?: boolean; day?: string }
): T {
    const normCategory = normalizeOpwCategoryId(categoryId);
    const isArray = Array.isArray(rules);
    const isUpsets = normCategory === 'upsets' || normCategory === 'upset' || normCategory === 'underdog_upsets' || normCategory === 'underdog_only';

    const cleanPoints = (desc: string, pts: number): number => {
        const triggerMaxPenalty = getTriggerMaxPenalty(desc);
        const triggerMaxBonus = getTriggerMaxBonus(desc, isUpsets);

        if (typeof pts !== 'number' || isNaN(pts)) {
            return 0;
        }
        if (pts === 0) {
            return isUpsets ? 0 : 5;
        }

        // Preserve exact calibrated / saved points when preserveExact is true (default).
        // Only apply polarity orientation when preserveExact is explicitly false.
        let orientedPts = pts;
        if (options?.preserveExact === false && !isLeagueTrigger(desc)) {
            const polarity = getTriggerSemanticPolarity(desc, normCategory);
            if (polarity !== 'NEUTRAL' && polarity !== 'PRO_DRAW') {
                if (isUpsets) {
                    if (UPSETS_EXPLICIT_PENALTIES[desc] !== undefined) {
                        orientedPts = -Math.abs(orientedPts);
                    } else if (polarity === 'PRO_MFAV' && orientedPts > 0) {
                        orientedPts = -Math.abs(orientedPts);
                    } else if (polarity === 'PRO_UNDERDOG' && orientedPts < 0) {
                        orientedPts = Math.abs(orientedPts);
                    }
                } else {
                    if (polarity === 'PRO_UNDERDOG' && orientedPts > 0) {
                        orientedPts = -Math.abs(orientedPts);
                    } else if (polarity === 'PRO_MFAV' && orientedPts < 0) {
                        orientedPts = Math.abs(orientedPts);
                    }
                }
            }
        }

        // Enforce user guarantee: minimum +5 bonus or -5 penalty (for Upsets only, 0 is also allowed).
        if (orientedPts > 0) {
            return Math.max(5, Math.min(triggerMaxBonus, orientedPts));
        } else {
            return Math.min(-5, Math.max(triggerMaxPenalty, orientedPts));
        }
    };

    if (isArray) {
        return (rules as { description: string; points: number }[])
            .filter(r => !REMOVED_TRIGGER_DESCRIPTIONS.has(r.description || (r as any).trigger || ''))
            .map(r => ({
                description: r.description || (r as any).trigger,
                points: cleanPoints(r.description || (r as any).trigger, r.points)
            }))
            .filter(r => isUpsets || r.points !== 0) as T;
    } else {
        const result: Record<string, number> = {};
        for (const [desc, pts] of Object.entries(rules as Record<string, number>)) {
            if (!REMOVED_TRIGGER_DESCRIPTIONS.has(desc)) {
                const cleaned = cleanPoints(desc, pts);
                if (isUpsets || cleaned !== 0) {
                    result[desc] = cleaned;
                }
            }
        }
        return result as T;
    }
}

export const MASTER_TOP_12_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "Both team L10 <= 5", points: -15 },
    { description: "Underdog odds <= 2.80", points: -30 },
    { description: "Odds for underdog <= odds for draw but >= 3.0", points: -10 },
    { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -5 },
    { description: "Odds for underdog <= odds for draw but < 2.8", points: -20 },
    { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 15 },
    { description: "1X2 supports the underdog", points: -15 },
    { description: "1X2 pred supports the underdog", points: -15 },
    { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: 15 },
    { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 20 },
    { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -15 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 15 },
    { description: "Algo support for Mfav > 50%", points: 15 },
    { description: "Algo support for Mfav is 45-50%", points: 10 },
    { description: "Algo for Mfav support <40%", points: -10 },
    { description: "Underdog has hidden strength", points: -30 },
    { description: "M.fav has hidden strength", points: 15 },
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
    { description: "Mfav GA=Und GA (+-0.2)", points: -10 },
    { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: -10 },
    { description: "HGA=AGS + Equal GS", points: 15 },
    { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -15 },
    { description: "PHA on draw =>30%", points: -25 },
    { description: "Match has PHA TIE tag", points: -30 },
    { description: "M.fav has hidden strength+Underdog has hidden strength", points: -15 },
    { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -15 },
    { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 20 },
    { description: "Seer score on Mfav <40%", points: -10 },
    { description: "Seer score on Mfav =>40%  to <50%", points: 10 },
    { description: "Seer score on Mfav =>50%  to <60%", points: 15 },
    { description: "Seer score on Mfav =>60%  to <70%", points: 20 },
    { description: "Seer score on Mfav =>70%", points: 25 },
    { description: "Algo Mfav support =>50 to <55%", points: 10 },
    { description: "Algo Mfav support =>55 to <60%", points: 15 },
    { description: "Algo Mfav support =>60", points: 20 },
    { description: "Seer score on draw >= 35% to <40%", points: -30 },
    { description: "Seer score on draw >= 40%", points: -25 },
    { description: "Mfav is playing at home", points: -25 },
    { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -20 },
    { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 },
    { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 },
    { description: "A match has GS=GS=GA=GA", points: -10 },
    { description: "Sub pattern primary on draw and hedges with underdog", points: -10 },
    { description: "Both team GS => 1.8", points: 10 },
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
    { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 15 },
    { description: "Pha Underdog and Pha draw both >20%", points: -10 },
    { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -10 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -5 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -15 },
    { description: "Mfav L10 > Und L10 with >=3 points", points: 5 },
    { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 15 },
    { description: "Mfav L10(wins) >5 to 7", points: 15 },
    { description: "Mfav L10(wins) >7", points: 25 },
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
    { description: "PHA for Mfav <40%", points: -15 },
    { description: "Underdog odds >3.0", points: 10 },
    { description: "Underdog odds <=2.7", points: -20 },
    { description: "Mfav odds >= 2.5", points: -15 },
    { description: "Both team TS =< 1.0", points: -15 },
    { description: "SubPattern is G2E5", points: -30 },
    { description: "MFav TS <=1.2", points: -10 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 15 },
    { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -25 },
    { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -10 },
    { description: "1X2 Rating < 3.0", points: -15 },
    { description: "Underdog is at home", points: -5 },
    { description: "Underdog has hidden strength+Underdog is at home", points: -30 },
    { description: "Underdog has hidden weakness", points: -10 },
    { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -30 },

], 'top_12_value');

export const MASTER_BEST_BET_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "Both team L10 <= 5", points: -15 },
    { description: "1X2 supports the underdog", points: -15 },
    { description: "1X2 pred supports the underdog", points: -15 },
    { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: 15 },
    { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 20 },
    { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -15 },
    { description: "Algo support for Mfav > 50%", points: 20 },
    { description: "Low Favorite Odds (< 1.80)", points: 20 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 20 },
    { description: "Odds difference >= 1.50", points: 20 },
    { description: "Seer score on draw <= 20%", points: 15 },
    { description: "Mfav GS = Und Gs +-0.2", points: -15 },
    { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 15 },
    { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 },
    { description: "Underdog odds <= 2.80", points: -30 },
    { description: "Seer score on underdog >= 45%", points: -20 },
    { description: "Algo primary prediction supports the underdog", points: -20 },
    { description: "Underdog was away on LE and Won", points: -20 },
    { description: "Youth League (U21,U20,U19)", points: -15 },
    { description: "Both teams GA >= 1.5", points: -15 },
    { description: "TS difference <= 0.1", points: -15 },
    { description: "Both team GS => 1.8", points: 10 },
    { description: "Match has Banned:Upset risk tag", points: -5 },
    { description: "Match has Banned:Draw risk tag", points: -5 },
    { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 15 },
    { description: "Pha Underdog and Pha draw both >20%", points: -10 },
    { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -10 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -5 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -15 },
    { description: "Mfav L10 > Und L10 with >=3 points", points: 5 },
    { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 15 },
    { description: "Mfav L10(wins) >5 to 7", points: 15 },
    { description: "Mfav L10(wins) >7", points: 25 },
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
    { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -15 },
    { description: "PHA on draw =>30%", points: -25 },
    { description: "Match has PHA TIE tag", points: -30 },
    { description: "M.fav has hidden strength+Underdog has hidden strength", points: -15 },
    { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -15 },
    { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 20 },
    { description: "Seer score on Mfav <40%", points: -10 },
    { description: "Seer score on Mfav =>40%  to <50%", points: 10 },
    { description: "Seer score on Mfav =>50%  to <60%", points: 15 },
    { description: "Seer score on Mfav =>60%  to <70%", points: 20 },
    { description: "Seer score on Mfav =>70%", points: 25 },
    { description: "Algo Mfav support =>50 to <55%", points: 10 },
    { description: "Algo Mfav support =>55 to <60%", points: 15 },
    { description: "Algo Mfav support =>60", points: 20 },
    { description: "Seer score on draw >= 35% to <40%", points: -30 },
    { description: "Seer score on draw >= 40%", points: -25 },
    { description: "Mfav is playing at home", points: 10 },
    { description: "PHA for Mfav <40%", points: -15 },
    { description: "Underdog odds >3.0", points: 10 },
    { description: "Underdog odds <=2.7", points: -20 },
    { description: "Mfav odds >= 2.5", points: -15 },
    { description: "Both team TS =< 1.0", points: -15 },
    { description: "SubPattern is G2E5", points: -30 },
    { description: "Mfav GA=Und GA (+-0.2)", points: -10 },
    { description: "MFav TS <=1.2", points: -10 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 15 },
    { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -25 },
    { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -10 },
    { description: "Underdog has hidden strength", points: -30 },
    { description: "1X2 Rating < 3.0", points: -15 },
    { description: "Underdog is at home", points: -5 },
    { description: "Underdog has hidden strength+Underdog is at home", points: -30 },
    { description: "Underdog has hidden weakness", points: -10 },
    { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -30 },

], 'best_bet');

export const MASTER_BANKERS_DLIVE_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "Both team L10 <= 5", points: -15 },
    { description: "1X2 supports the underdog", points: -15 },
    { description: "1X2 pred supports the underdog", points: -15 },
    { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: 15 },
    { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 20 },
    { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -15 },
    { description: "PAA Win probability >= 50%", points: 25 },
    { description: "Pha Underdog and Pha draw both >20%", points: -20 },
    { description: "Algo support for Mfav > 50%", points: 20 },
    { description: "Seer score on draw <= 20%", points: 20 },
    { description: "Low Favorite Odds (< 1.80)", points: 20 },
    { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 20 },
    { description: "Odds difference >= 1.50", points: 20 },
    { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 15 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 15 },
    { description: "TS difference >= 1.0", points: 15 },
    { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 15 },
    { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 },
    { description: "1X2 Rating =>7", points: 15 },
    { description: "Underdog L10 <= 2", points: 15 },
    { description: "Ud GA < Mfav GA (defensive edge)", points: 10 },
    { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 10 },
    { description: "Algo support for Mfav is 45-50%", points: 10 },
    { description: "Draw odds < 3.2 (draw absorbs)", points: 10 },
    { description: "PAA, Seer, and ML agree on 1X/X2", points: 5 },
    { description: "Mfav GA=Und GA (+-0.2)", points: -10 },
    { description: "Underdog odds <= 2.80", points: -30 },
    { description: "Algo primary prediction supports the underdog", points: -20 },
    { description: "Seer score on underdog >= 45%", points: -20 },
    { description: "Seer primary predicts on underdog", points: -20 },
    { description: "Sub pattern primary prediction supports the underdog", points: -20 },
    { description: "Underdog was away on LE and Won", points: -20 },
    { description: "Dead-Heat Draw Trap (Fav >= 2.50 + Ud <= 2.80 + Draw < 3.30)", points: -20 },
    { description: "TS difference <= 0.1", points: -15 },
    { description: "Youth League (U21,U20,U19)", points: -20 },
    { description: "Both team GS => 1.8", points: 10 },
    { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -15 },
    { description: "Mfav GS = Und Gs +-0.2", points: -5 },
    { description: "LE Underdog won with 2+ goals", points: -20 },
    { description: "MFav TS <=1.2", points: -10 },
    { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 },
    { description: "Mfav L10 = Und L10", points: -5 },
    { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -10 },
    { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -15 },
    { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -15 },
    { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -15 },
    { description: "Underdog has hidden strength", points: -30 },
    { description: "Both teams GA >= 1.5", points: -10 },
    { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -15 },
    { description: "Both teams GA >= 1.1 (volatile match)", points: -10 },
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
    { description: "Mfav L10(wins) >5 to 7", points: 15 },
    { description: "Mfav L10(wins) >7", points: 25 },
    { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -15 },
    { description: "PHA on draw =>30%", points: -25 },
    { description: "Match has PHA TIE tag", points: -30 },
    { description: "M.fav has hidden strength+Underdog has hidden strength", points: -15 },
    { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -15 },
    { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 20 },
    { description: "Seer score on Mfav <40%", points: -10 },
    { description: "Seer score on Mfav =>40%  to <50%", points: 10 },
    { description: "Seer score on Mfav =>50%  to <60%", points: 15 },
    { description: "Seer score on Mfav =>60%  to <70%", points: 20 },
    { description: "Seer score on Mfav =>70%", points: 25 },
    { description: "Algo Mfav support =>50 to <55%", points: 10 },
    { description: "Algo Mfav support =>55 to <60%", points: 15 },
    { description: "Algo Mfav support =>60", points: 20 },
    { description: "Seer score on draw >= 35% to <40%", points: -30 },
    { description: "Seer score on draw >= 40%", points: -25 },
    { description: "Mfav is playing at home", points: 10 },
    { description: "PHA for Mfav <40%", points: -15 },
    { description: "Underdog odds >3.0", points: 10 },
    { description: "Underdog odds <=2.7", points: -20 },
    { description: "Mfav odds >= 2.5", points: -15 },
    { description: "Both team TS =< 1.0", points: -15 },
    { description: "SubPattern is G2E5", points: -30 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 15 },
    { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -10 },
    { description: "1X2 Rating < 3.0", points: -15 },
    { description: "Underdog is at home", points: -5 },
    { description: "Underdog has hidden strength+Underdog is at home", points: -30 },
    { description: "Underdog has hidden weakness", points: -10 },
    { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -30 },

], 'bankers_dlive');

// Bankers Jackpot is an mfav_only category (odds 1.80-2.00, draws and underdogs are traps).
export const MASTER_BANKERS_JACKPOT_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "Both team L10 <= 5", points: -15 },
    { description: "1X2 supports the underdog", points: -15 },
    { description: "1X2 pred supports the underdog", points: -15 },
    { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: 15 },
    { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 20 },
    { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -15 },
    { description: "Low Favorite Odds (< 1.80)", points: 20 },
    { description: "Algo support for Mfav > 50%", points: 20 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 5 },
    { description: "PAA Win probability >= 50%", points: 30 },
    { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 10 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 20 },
    { description: "1X2 Rating =>7", points: 15 },
    { description: "Mfav L10 > Und L10 with >=3 points", points: 5 },
    { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 20 },
    { description: "Mfav L10(wins) >5 to 7", points: 15 },
    { description: "Mfav L10(wins) >7", points: 25 },
    { description: "Underdog L10 <= 2", points: 10 },
    { description: "Seer score on draw <= 20%", points: 10 },
    { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 20 },
    { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 5 },
    { description: "Underdog odds >3.0", points: 25 },
    { description: "Underdog odds <=2.7", points: -15 },
    { description: "Mfav odds >= 2.5", points: -15 },
    { description: "Draw odds between 3.0 and 3.3", points: -15 },
    { description: "Both team TS =< 1.0", points: -5 },
    { description: "MFav TS <=1.2", points: -5 },
    { description: "SubPattern is G2E5", points: -30 },
    { description: "Mfav GA=Und GA (+-0.2)", points: 25 },
    { description: "LE was a draw", points: -15 },
    { description: "Both teams GA >= 1.1 (volatile match)", points: -5 },
    { description: "Mfav is playing at home", points: 5 },
    { description: "Both team GS => 1.8", points: 5 },
    { description: "Underdog has hidden strength", points: -5 },
    { description: "Underdog odds <= 2.80", points: -30 },
    { description: "1X2 Rating < 3.0", points: -5 },
    { description: "Underdog is at home", points: -5 },
    { description: "Underdog has hidden strength+Underdog is at home", points: -5 },
    { description: "Underdog has hidden weakness", points: -5 },
    { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -5 },
    { description: "Algo supports Mfav >=45% to <50%", points: 25 },
    { description: "Mfav GS > Underdog GS with >= 0.3", points: 10 },
    { description: "Underdog GS > Mfav GS with >= 0.3", points: -5 },
    { description: "Odds for underdog <= odds for draw but >= 3.0", points: -5 },
    { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: -5 },
    { description: "Seer score on draw >= 35% to <40%", points: -10 },
    { description: "Seer score on draw >= 40%", points: -5 },
    { description: "Seer score on Mfav <40%", points: -20 },
    { description: "Seer score on Mfav =>40%  to <50%", points: 30 },
    { description: "Seer score on Mfav =>50%  to <60%", points: 25 },
    { description: "Seer score on Mfav =>60%  to <70%", points: 25 },
    { description: "Seer score on Mfav =>70%", points: 10 },
    { description: "Algo Mfav support =>50 to <55%", points: 10 },
    { description: "Algo Mfav support =>55 to <60%", points: 20 },
    { description: "Algo Mfav support =>60", points: 20 },
    { description: "Seer score on underdog >= 45%", points: -5 },
    { description: "Seer primary predicts on underdog", points: -30 },
    { description: "Algo support for Mfav is 45-50%", points: 30 },
    { description: "Algo for Mfav support <40%", points: -15 },
    { description: "Algo final prediction is 1X/X2", points: 25 },
    { description: "Algo primary prediction supports the underdog", points: -30 },
    { description: "PAA, Seer, and ML agree on 1X/X2", points: 30 },
    { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 },
    { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 },
    { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -30 },
    { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 },
    { description: "Sub pattern primary on draw and hedges with underdog", points: -15 },
    { description: "Sub pattern primary prediction supports the underdog", points: -5 },
    { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 25 },
    { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 5 },
    { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -15 },
    { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -25 },
    { description: "TS difference <= 0.1", points: -5 },
    { description: "M.fav has hidden strength", points: 30 },
    { description: "M.fav has hidden weakness", points: 30 },
    { description: "Underdog has >= 5 more points on point system", points: 25 },
    { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 5 },
    { description: "Both teams GS < 1.0", points: -5 },
    { description: "Both teams GS < 1.0 and Both team GS <GA", points: -5 },
    { description: "Both teams GA > GS and Both team GS <=1.0", points: -5 },
    { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -5 },
    { description: "Both teams GA >= 1.5", points: -5 },
    { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 30 },
    { description: "Mfav GS = Und Gs +-0.2", points: 30 },
    { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 30 },
    { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 30 },
    { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 },
    { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 30 },
    { description: "Underdog GS >Mfav GS with >=0.4 points", points: -5 },
    { description: "Underdog GA >= 1.5 and GS => 1.8", points: -20 },
    { description: "A match has GS=GS=GA=GA", points: -10 },
    { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 },
    { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 },
    { description: "Odds for underdog >= 2.80 to 3.0", points: -5 },
    { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 },
    { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -5 },
    { description: "LE : Underdog won the last encounter", points: -20 },
    { description: "LE Underdog won with 2+ goals", points: -20 },
    { description: "Underdog was away on LE and Won", points: -20 },
    { description: "LE was a draw+Underdog has hidden strength/weakness", points: -15 },
    { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -20 },
    { description: "Youth League (U21,U20,U19)", points: -30 },
    { description: "Match has BB, T12, or BD opw < 10%", points: -10 },
    { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -20 },
    { description: "TS difference >= 1.0", points: 25 },
    { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: -5 },
    { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -30 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -5 },
    { description: "Mfav L10 = Und L10", points: -5 },
    { description: "LE was a draw + Mfav L10 = Und L10", points: -15 },
    { description: "LE was a draw + Mfav has hidden strength", points: -15 },
    { description: "Underdog has higher L10 than Mfav", points: -20 },
    { description: "Mfav L10 and Underdog L10 difference <= 1", points: -5 },
    { description: "1X2 Rating 5.0 to 7.0", points: 30 },
    { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 5 },
    { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 5 },
    { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 5 },
    { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 5 },
    { description: "PAA Win probability < 35%", points: -5 },
    { description: "PHA Draw probability >= 35%", points: -5 },
    { description: "PHA Underdog probability >= 35%", points: -30 },
    { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -20 },
    { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -20 },
    { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -5 },
    { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -15 },
    { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -20 },
    { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", points: -5 },
    { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 },
    { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -20 },
    { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -5 },
    { description: "LE was a draw+1X2 Rating < 3.0", points: -15 },
    { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -5 },
    { description: "Pha Underdog and Pha draw both >20%", points: -10 },
    { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -5 },
    { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 },
    { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -20 },
    { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -10 },
    { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -15 },
    { description: "Match has Banned:Upset risk tag", points: -15 },
    { description: "Match has Banned:Draw risk tag", points: -5 },
    { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -5 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -25 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -25 },
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
    { description: "PHA for Mfav <40%", points: -30 },
    { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -5 },
    { description: "PHA on draw =>30%", points: -15 },
    { description: "M.fav has hidden strength+Underdog has hidden strength", points: -5 },
    { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -15 },
    { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 20 },
    { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -5 },
    { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -5 },
    { description: "Match has PHA TIE tag", points: -5 },
    { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: -5 },
    { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: -20 },
    { description: "Points for Draw =>30 on the point system", points: -5 },
    { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: 5 },
], 'bankers_jackpot', { preserveExact: true });

// Value Picks is an mfav_only category (odds 2.0-2.50, draws and underdogs are traps).
export const MASTER_VALUE_PICKS_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "Both team L10 <= 5", points: -15 },
    { description: "1X2 supports the underdog", points: -15 },
    { description: "1X2 pred supports the underdog", points: -15 },
    { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: 15 },
    { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 20 },
    { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -15 },
    { description: "Low Favorite Odds (< 1.80)", points: 20 },
    { description: "Algo support for Mfav > 50%", points: 20 },
    { description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 20 },
    { description: "PAA Win probability >= 50%", points: 25 },
    { description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: 15 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: 15 },
    { description: "1X2 Rating =>7", points: 15 },
    { description: "Mfav L10 > Und L10 with >=3 points", points: 15 },
    { description: "Mfav L10 > Und L10 with >=3 points and Mfav L10 =>5", points: 15 },
    { description: "Mfav L10(wins) >5 to 7", points: 15 },
    { description: "Mfav L10(wins) >7", points: 25 },
    { description: "Underdog L10 <= 2", points: 15 },
    { description: "Seer score on draw <= 20%", points: 15 },
    { description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 15 },
    { description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 },
    { description: "Underdog odds >3.0", points: 10 },
    { description: "Underdog odds <=2.7", points: -20 },
    { description: "Mfav odds >= 2.5", points: -20 },
    { description: "Draw odds between 3.0 and 3.3", points: -15 },
    { description: "Both team TS =< 1.0", points: -15 },
    { description: "MFav TS <=1.2", points: -15 },
    { description: "SubPattern is G2E5", points: -30 },
    { description: "Mfav GA=Und GA (+-0.2)", points: -15 },
    { description: "LE was a draw", points: -20 },
    { description: "Both teams GA >= 1.1 (volatile match)", points: -20 },
    { description: "Mfav is playing at home", points: 10 },
    { description: "Both team GS => 1.8", points: 10 },
    { description: "Underdog has hidden strength", points: -30 },
    { description: "Underdog odds <= 2.80", points: -30 },
    { description: "1X2 Rating < 3.0", points: -15 },
    { description: "Underdog is at home", points: -5 },
    { description: "Underdog has hidden strength+Underdog is at home", points: -30 },
    { description: "Underdog has hidden weakness", points: -10 },
    { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: -30 },
    { description: "Algo supports Mfav >=45% to <50%", points: 10 },
    { description: "Mfav GS > Underdog GS with >= 0.3", points: 10 },
    { description: "Underdog GS > Mfav GS with >= 0.3", points: -10 },
    { description: "Odds for underdog <= odds for draw but >= 3.0", points: -15 },
    { description: "1X2 Rating < 3.0+MFav TS <=1.2", points: -20 },
    { description: "Seer score on draw >= 35% to <40%", points: -30 },
    { description: "Seer score on draw >= 40%", points: -25 },
    { description: "Seer score on Mfav <40%", points: -10 },
    { description: "Seer score on Mfav =>40%  to <50%", points: 10 },
    { description: "Seer score on Mfav =>50%  to <60%", points: 15 },
    { description: "Seer score on Mfav =>60%  to <70%", points: 20 },
    { description: "Seer score on Mfav =>70%", points: 25 },
    { description: "Algo Mfav support =>50 to <55%", points: 10 },
    { description: "Algo Mfav support =>55 to <60%", points: 15 },
    { description: "Algo Mfav support =>60", points: 20 },
    { description: "Seer score on underdog >= 45%", points: -20 },
    { description: "Seer primary predicts on underdog", points: -20 },
    { description: "Algo support for Mfav is 45-50%", points: 10 },
    { description: "Algo for Mfav support <40%", points: -15 },
    { description: "Algo final prediction is 1X/X2", points: 10 },
    { description: "Algo primary prediction supports the underdog", points: -20 },
    { description: "PAA, Seer, and ML agree on 1X/X2", points: 5 },
    { description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -5 },
    { description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -5 },
    { description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -5 },
    { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 },
    { description: "Sub pattern primary on draw and hedges with underdog", points: -20 },
    { description: "Sub pattern primary prediction supports the underdog", points: -20 },
    { description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 20 },
    { description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 15 },
    { description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -25 },
    { description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -25 },
    { description: "TS difference <= 0.1", points: -10 },
    { description: "M.fav has hidden strength", points: 15 },
    { description: "M.fav has hidden weakness", points: -5 },
    { description: "Underdog has >= 5 more points on point system", points: -5 },
    { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 15 },
    { description: "Both teams GS < 1.0", points: -10 },
    { description: "Both teams GS < 1.0 and Both team GS <GA", points: -10 },
    { description: "Both teams GA > GS and Both team GS <=1.0", points: -10 },
    { description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: -15 },
    { description: "Both teams GA >= 1.5", points: -10 },
    { description: "M.fav GA is > 0.6 points lower than Underdog GA", points: 15 },
    { description: "Mfav GS = Und Gs +-0.2", points: 5 },
    { description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: 5 },
    { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 5 },
    { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 5 },
    { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 5 },
    { description: "Underdog GS >Mfav GS with >=0.4 points", points: -15 },
    { description: "Underdog GA >= 1.5 and GS => 1.8", points: -10 },
    { description: "A match has GS=GS=GA=GA", points: -10 },
    { description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: 15 },
    { description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -15 },
    { description: "Odds for underdog >= 2.80 to 3.0", points: -5 },
    { description: "Odds for underdog <= odds for draw but < 2.8", points: -15 },
    { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -10 },
    { description: "LE : Underdog won the last encounter", points: -15 },
    { description: "LE Underdog won with 2+ goals", points: -20 },
    { description: "Underdog was away on LE and Won", points: -20 },
    { description: "LE was a draw+Underdog has hidden strength/weakness", points: -15 },
    { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -20 },
    { description: "Youth League (U21,U20,U19)", points: -15 },
    { description: "Match has BB, T12, or BD opw < 10%", points: -10 },
    { description: "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", points: -20 },
    { description: "TS difference >= 1.0", points: 20 },
    { description: "Mfav GA close to Ud GA (+-0.2) + Algo support 45-50%", points: 15 },
    { description: "Both team GS => 1.8 + Mfav GA close to Ud GA (+-0.2)", points: -15 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Odds underdog < 2.8", points: -15 },
    { description: "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Algo support < 40%", points: -20 },
    { description: "Mfav L10 = Und L10", points: -5 },
    { description: "LE was a draw + Mfav L10 = Und L10", points: -15 },
    { description: "LE was a draw + Mfav has hidden strength", points: 15 },
    { description: "Underdog has higher L10 than Mfav", points: -15 },
    { description: "Mfav L10 and Underdog L10 difference <= 1", points: -15 },
    { description: "1X2 Rating 5.0 to 7.0", points: 15 },
    { description: "Mfav GA <= 1.1 and Underdog GA > 1.1", points: 10 },
    { description: "Underdog GS < 1.0 and Mfav GA < 1.0 (Dominant Defense)", points: 20 },
    { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: 15 },
    { description: "Underdog GA >= 1.8 and Mfav GA <= 1.0", points: 20 },
    { description: "PAA Win probability < 35%", points: -15 },
    { description: "PHA Draw probability >= 35%", points: -15 },
    { description: "PHA Underdog probability >= 35%", points: -15 },
    { description: "LE : Underdog won the last encounter+ Underdog has higher L10 than Mfav", points: -20 },
    { description: "LE : Underdog won the last encounter+Youth League (U21,U23,U20,U19)", points: -20 },
    { description: "TS difference <= 0.1+Both teams GA >= 1.1 (volatile match)", points: -20 },
    { description: "LE Underdog won with 2+ goals+Both teams GA >= 1.1 (volatile match)", points: -20 },
    { description: "Youth League (U21,U23,U20,U19)+ Odds for underdog >= 2.80 to 3.0", points: -20 },
    { description: "PAA, SubPattern, and Algo agree on 12 hedge+Both teams GA >= 1.1 (volatile match)", points: -20 },
    { description: "Youth League (U21,U23,U20,U19)+PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -20 },
    { description: "Underdog odds <= 2.80+Underdog GA >= 1.5 and GS => 1.8", points: -20 },
    { description: "Mfav L10 and Underdog L10 difference <= 1+Both teams GA >= 1.1 (volatile match)", points: -20 },
    { description: "LE was a draw+1X2 Rating < 3.0", points: -15 },
    { description: "Mfav L10 = Und L10+ Both teams GA >= 1.1 (volatile match)", points: -20 },
    { description: "Pha Underdog and Pha draw both >20%", points: -20 },
    { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -15 },
    { description: "Mfav is away but was home last LE won with <=1 goal", points: -5 },
    { description: "Mfav is away but was home last LE won with <=1 goal+ Odds for underdog >= 2.80 to 3.0", points: -20 },
    { description: "Mfav L10 = Und L10+ Mfav L10 and Underdog L10 difference <= 1", points: -15 },
    { description: "Mfav GS = Und Gs +-0.2+Mfav is away but was home last LE won with <=1 goal", points: -15 },
    { description: "Match has Banned:Upset risk tag", points: -5 },
    { description: "Match has Banned:Draw risk tag", points: -5 },
    { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -10 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: -5 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -15 },
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
    { description: "PHA for Mfav <40%", points: -15 },
    { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: -15 },
    { description: "PHA on draw =>30%", points: -25 },
    { description: "M.fav has hidden strength+Underdog has hidden strength", points: -15 },
    { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -15 },
    { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: 20 },
    { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -25 },
    { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -10 },
    { description: "Match has PHA TIE tag", points: -30 },
    { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: -30 },
    { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: -20 },
    { description: "Points for Draw =>30 on the point system", points: -10 },
    { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: 15 },
], 'value_picks', { preserveExact: true });
export const MASTER_UPSETS_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "Mfav is playing at home", points: -25 },
    { description: "Both team L10 <= 5", points: 15 },
    { description: "1X2 supports the underdog", points: 15 },
    { description: "1X2 pred supports the underdog", points: 15 },
    { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: 15 },
    { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: -20 },
    { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: 15 },
    { description: "Youth League (U21,U20,U19)", points: -15 },
    { description: "Algo primary prediction supports the underdog", points: 25 },
    { description: "Seer score on underdog >= 45%", points: 25 },
    { description: "Seer primary predicts on underdog", points: 25 },
    { description: "Underdog was away on LE and Won", points: 20 },
    { description: "Odds for underdog <= odds for draw but < 2.8", points: -20 },
    { description: "Odds for underdog >= 2.80 to 3.0", points: -15 },
    { description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: -15 },
    { description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 20 },
    { description: "Both teams GA > GS and Both team GS <=1.0", points: 15 },
    { description: "LE Underdog won with 2+ goals", points: 25 },
    { description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 15 },
    { description: "LE : Underdog won the last encounter", points: 20 },
    { description: "Dead-Heat Draw Trap (Fav >= 2.50 + Ud <= 2.80 + Draw < 3.30)", points: -25 },
    { description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: 10 },
    { description: "Mfav GS >= 1.5 and Underdog GS < 1.0", points: -25 },
    { description: "Underdog GS >Mfav GS with >=0.4 points", points: -25 },
    { description: "Underdog GA >= 1.5 and GS => 1.8", points: -25 },
    { description: "TS difference <= 0.1", points: 10 },
    { description: "Odds for underdog <= odds for draw but >= 3.0", points: 25 },
    { description: "Pha Underdog and Pha draw both >20%", points: 10 },
    { description: "Seer score on draw >= 35%+1X2 Rating < 3.0", points: -20 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2", points: 5 },
    { description: "Mfav GS=>2.0=Underdog GA +-0.2+Seer score on draw >= 35%", points: -20 },
    { description: "Mfav was away and won last Encounter <=1 goal", points: 5 },
    { description: "Mfav was home and won last Encounter <=1 goal", points: 5 },
    { description: "Mfav was home and won last Encounter >1 to =<3 goal", points: -10 },
    { description: "Mfav was Away and won last Encounter >1 to =<3 goal", points: -10 },
    { description: "Mfav was home and won last Encounter >3 goal", points: -10 },
    { description: "Mfav was Away and won last Encounter >3 goal", points: -10 },
    { description: "Mfav was away and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
    { description: "Mfav was home and won last Encounter <=1 goal + Mfav L10 > Und L10 with >=3 points", points: 15 },
    { description: "Mfav was home and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
    { description: "Mfav was Away and won last Encounter >1 to =<3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
    { description: "Mfav was home and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
    { description: "Mfav was Away and won last Encounter >3 goal + Mfav L10 > Und L10 with >=3 points", points: -10 },
    { description: "Mfav L10(wins) >5 to 7", points: -15 },
    { description: "Mfav L10(wins) >7", points: -25 },
    { description: "Mfav has hidden strength/weakness+Underdog has hidden strength/weakness", points: -15 },
    { description: "PHA for Mfav <40%", points: -15 },
    { description: "Both teams GS < 1.0", points: 10 },
    { description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: 5 },
    { description: "Both teams GA >= 1.1 +Pha Underdog and Pha draw both >20%", points: 15 },
    { description: "PHA on draw =>30%", points: 25 },
    { description: "Match has PHA TIE tag", points: 30 },
    { description: "Points for Draw =>30 on the point system", points: 10 },
    { description: "Both team GS => 1.8+Mfav GS = Und Gs +-0.2", points: 30 },
    { description: "Underdog odds <= 2.80+Both team GS => 1.8", points: 20 },
    { description: "Underdog has >= 5 more points on point system+Mfav is playing at home", points: -15 },
    { description: "M.fav has hidden strength+Underdog has hidden strength", points: 15 },
    { description: "Underdog has hidden weakness+M.fav has hidden weakness", points: -15 },
    { description: "M.fav has hidden weakness+Mfav GS = Und Gs +-0.2", points: -20 },
    { description: "Seer score on Mfav <40%", points: 10 },
    { description: "Seer score on Mfav =>40%  to <50%", points: -10 },
    { description: "Seer score on Mfav =>50%  to <60%", points: -15 },
    { description: "Seer score on Mfav =>60%  to <70%", points: -20 },
    { description: "Seer score on Mfav =>70%", points: -25 },
    { description: "Algo Mfav support =>50 to <55%", points: -10 },
    { description: "Algo Mfav support =>55 to <60%", points: -15 },
    { description: "Algo Mfav support =>60", points: -20 },
    { description: "Seer score on draw >= 35% to <40%", points: -5 },
    { description: "Seer score on draw >= 40%", points: 25 },
    { description: "Youth League (U21,U20,U19)+ Both team GS => 1.8", points: -20 },
    { description: "Mfav GS = Und Gs +-0.2+ 1X2 Rating < 3.0", points: -15 },
    { description: "Underdog is at home", points: 5 },
    { description: "Underdog has hidden strength+Underdog is at home", points: 30 },
    { description: "Underdog has hidden weakness", points: 10 },
    { description: "Underdog has hidden weakness+Match has PHA TIE tag", points: 30 },

], 'upsets', { preserveExact: true });
export const MASTER_BOTB_RULES: { description: string; points: number }[] = sanitizeRulePolarity([
    { description: "1X2 supports the underdog", points: -15 },
    { description: "1X2 pred supports the underdog", points: -15 },
    { description: "L10: Mfav Wins+ Draws = Underdog wins +Draws", points: 15 },
    { description: "L10: Mfav Wins+ Draws > Underdog wins +Draws", points: 20 },
    { description: "L10: Mfav Wins+ Draws < Underdog wins +Draws", points: -15 },
    { description: "Odds difference >= 1.50", points: 20 },
], 'botb_best');

/**
 * Builds Value Bets rules from a day's T12 rule set (plus MASTER_TOP_12_RULES & catalog triggers),
 * initializing all Pro-Mfav triggers to +5 points and all Pro-Underdog triggers to -5 points.
 */
export function buildValueBetsRulesFromT12(
    t12Rules: { description: string; points: number }[] = MASTER_TOP_12_RULES
): { description: string; points: number }[] {
    const seen = new Set<string>();
    const combined: { description: string; points: number }[] = [];

    const addRule = (desc: string, fallbackPts: number) => {
        const cleanDesc = (desc || '').trim();
        if (!cleanDesc || seen.has(cleanDesc) || REMOVED_TRIGGER_DESCRIPTIONS.has(cleanDesc)) return;
        seen.add(cleanDesc);

        if (isLeagueTrigger(cleanDesc)) {
            if (USER_MANUAL_PRO_UNDERDOG_LEAGUES.has(cleanDesc)) {
                combined.push({ description: cleanDesc, points: -5 });
            } else {
                combined.push({ description: cleanDesc, points: getNewTriggerDefaultPoints(cleanDesc) });
            }
            return;
        }

        const polarity = getTriggerSemanticPolarity(cleanDesc, 'value_bets');
        if (polarity === 'PRO_UNDERDOG') {
            combined.push({ description: cleanDesc, points: -5 });
        } else if (polarity === 'PRO_MFAV') {
            combined.push({ description: cleanDesc, points: 5 });
        } else {
            combined.push({ description: cleanDesc, points: fallbackPts < 0 ? -5 : 5 });
        }
    };

    t12Rules.forEach(r => addRule(r.description, r.points));
    MASTER_TOP_12_RULES.forEach(r => addRule(r.description, r.points));
    ALL_MASTER_CATALOG_TRIGGERS.forEach(desc => addRule(desc, 5));

    return sanitizeRulePolarity(combined, 'value_bets', { preserveExact: true });
}

export const MASTER_VALUE_BETS_RULES: { description: string; points: number }[] = buildValueBetsRulesFromT12(MASTER_TOP_12_RULES);

/**
 * Starting points for a NEW trigger (one with no saved points for the given day & category):
 * - Premier League trigger (only 1): +40 (both Pro-Mfav and Pro-Underdog categories)
 * - Baseline leagues (BASELINE_20_LEAGUES, excluding Premier League): +30
 * - Every other core or league trigger: +5
 */
export function getNewTriggerDefaultPoints(description: string, isUpsets: boolean = false): number {
    const d = (description || '').trim();
    if (d === "Mfav L10(wins)>Und L10 but >=5" || d === "Mfav L10(wins)>Und L10 but <5") {
        return isUpsets ? -5 : 5;
    }
    if (d === "Und L10(wins)>Mfav L10 but >=5" || d === "Und L10(wins)>Mfav L10 but <5") {
        return isUpsets ? 5 : -5;
    }
    if (isUpsets && isLeagueTrigger(d)) {
        return 5;
    }
    if (isEnglishPremierLeagueTrigger(d)) {
        return 40;
    }
    if (BASELINE_20_LEAGUES.has(d)) {
        return 30;
    }
    return 5;
}

export function getMasterTriggerDefaultPoints(
    description: string,
    objective: 'mfav_draw' | 'mfav_only' | 'underdog_only' = 'mfav_draw',
    categoryId?: string
): number {
    const isUpsets = objective === 'underdog_only' || categoryId === 'upsets' || categoryId === 'upset';
    return getNewTriggerDefaultPoints(description, isUpsets);
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
    day?: string,
    options?: { preserveExact?: boolean; skipMasterInjection?: boolean }
): { description: string; points: number }[] {
    const targetCategory = normalizeOpwCategoryId(categoryId || (objective === 'underdog_only' ? 'upsets' : (objective === 'mfav_only' ? 'best_bet' : 'top_12_value')));
    if (['banker_draws', 'bankers_draws', 'banker_draw'].includes(targetCategory.toLowerCase())) {
        return [];
    }
    const isUpsets = targetCategory === 'upsets' || targetCategory === 'upset' || objective === 'underdog_only';
    const result: { description: string; points: number }[] = [];
    const preserveExact = options?.preserveExact !== undefined ? options.preserveExact : true;
    const seenDescriptions = new Set<string>();

    tunedRules.forEach(r => {
        if (!r.description || seenDescriptions.has(r.description)) return;
        seenDescriptions.add(r.description);
        if (typeof r.points === 'number' && !isNaN(r.points) && (isUpsets || r.points !== 0)) {
            result.push({ description: r.description, points: r.points });
        }
    });

    ALL_MASTER_CATALOG_TRIGGERS.forEach(desc => {
        if (!seenDescriptions.has(desc)) {
            seenDescriptions.add(desc);
            result.push({ description: desc, points: getNewTriggerDefaultPoints(desc, isUpsets) });
        }
    });

    DYNAMIC_LEAGUE_TRIGGERS.forEach(desc => {
        if (!seenDescriptions.has(desc)) {
            seenDescriptions.add(desc);
            result.push({ description: desc, points: getNewTriggerDefaultPoints(desc, isUpsets) });
        }
    });

    const filtered = result.filter(r => {
        // Ensure obsolete triggers are never included
        if (REMOVED_TRIGGER_DESCRIPTIONS.has(r.description || (r as any).trigger || '')) {
            return false;
        }
        if (r.description === "LE : Market Favorite won the last encounter" ||
            r.description === "1X2 Rating <= 2.5" ||
            r.description === "Medium Favorite Odds (1.80 - 2.20)") {
            return false;
        }
        return true;
    });

    return sanitizeRulePolarity(filtered, targetCategory, { preserveExact, day });
}
