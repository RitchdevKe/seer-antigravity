

export interface SelectionQuality {
  score: number; // 0-100
  isQualified: boolean;
  reason: string;
  recommendedType: 'Single' | 'Hedge' | 'Avoid';
  phaLean: string; // 'Clean' | 'Split' | 'None'
}

export interface Match {
  id: string | number;
  teams: string;
  result: string;
  pred1x2: string;
  rating: string;
  isPrecalculated?: boolean;
  gs: string; // Keep original string for display
  ga: string; // Keep original string for display
  actualResult?: string;
  l10: string;
  le: string;
  mo: string;
  date: string;
  time?: string;
  league?: string;
  country?: string;
  
  // Parsed numerical values for calculations
  tsa?: number;
  tsb?: number;
  group?: number;
  gsHome?: number;
  gsAway?: number;
  gaHome?: number;
  gaAway?: number;
  
  // Optional for raw data handling
  results?: string; 
  
  // Tagged/Calculated fields
  totalPoints?: TotalPoints;
  pointsRange?: string;
  patterns?: string[]; // Legacy P-patterns
  maxPoints?: number;
  
  // Pre-calculated prediction logic
  rawPrediction?: string; // This is the Display Primary Prediction
  finalPrediction?: string;
  hedgeNote?: string;

  // PAA Prediction (Sticky)
  paaPrediction?: string;
  paaPrimaryPrediction?: string;
  
  // SEER Prediction (Sticky)
  seerPrediction?: string;
  seerPrimaryPrediction?: string;
  seerPercentages?: { '1': number; 'X': number; '2': number };
  seerScores?: { '1': number; 'X': number; '2': number };

  priority?: string;
  patternCode?: string;
  
  // New fields for Filtering
  moPrediction?: string; // Prediction based solely on Market Odds
  calculatedPrediction?: string; // Prediction based solely on Total Points (before rules)

  // New Pattern Analysis V2 Data
  patternAnalysis?: {
    mainPattern: string;
    subPattern: string | null;
    subPatternPrediction: string | null;
    primaryPrediction: string | null;
    activeFlags: string[];
    mainPatternDescription: string;
    formattedString?: string;
    appliedPattern?: string; // The main pattern of the specific rule that triggered
    confidenceStars?: number; // 0 to 5
    confidenceColor?: string; // Hex or tailwind class
  };

  subPatternOverride?: {
    primary: string;
    final: string;
    subCode: string;
    applied: boolean;
  } | null;

  // Deployment Updates
  isJackpot?: boolean;
  isDaily?: boolean; // New flag to track Daily list membership explicitly
  isFullyProcessed?: boolean;
  jackpotId?: string; // Legacy: Single ID (Deprecated in favor of ids array)
  jackpotIds?: string[]; // Support for a match belonging to multiple jackpots

  // From NerdyTips scraper
  analysis?: string;
  percentage?: string;
  stars?: string;
  tip?: string;
  odds?: string;

  // AI & Confidence Automation
  probabilityConfidence?: number;
  activeAiFilters?: string[];

  // Extraction Info
  extractedAt?: any;

  // Explicit Algo Run Snapshot
  algoReport?: AlgoReport;

  // Match Evaluator Tags
  evaluatorTags?: string[];
  mandatory_hedge?: boolean;
  qualityAudit?: SelectionQuality;
  phaReliability?: string;
  lockedOpwScores?: Record<string, any>;
  
  // PAA Stats for Filtering
  paaWin?: number;
  paaDraw?: number;
  paaUpset?: number;
  
  // Data Driven ML Info
  mlInfo?: {
      mlApplied: boolean;
      mlPrediction: string;
      mlReasoning?: string;
      tags?: string[];
      matrixStats?: any;
      mlConfidence?: number;
      mlStats?: {
          hitRate: number;
          sampleSize: number;
      };
      mlPrimaryPrediction?: string;
      mlPercentages?: { fav: number, draw: number, underdog: number };
      mlPredictionSource?: string;
      mlEngineMode?: 'testing' | 'self-updating';
      probabilities?: { '1': number; 'X': number; '2': number };
  };
  lockedOpwScore?: any;
}

export interface AlgoReport {
  prediction: string;
  primaryPrediction?: string;
  confidence: number;
  probabilities: { '1': number; 'X': number; '2': number };
  category: string;
  reason: string;
  activeFilters: string[];
  subPattern?: string;
  subPatternPrediction?: string;
  qualityAudit?: SelectionQuality;
}

export interface PatternData {
  name: string;
  filter: (m: Match) => boolean;
  action: string;
  implemented: boolean;
  mainPattern: string;
  accuracy?: string;
  total?: number;
  correct?: number;
}

export interface TotalPoints {
  home: number;
  draw: number;
  away: number;
  breakdown: {
    pts1x2?: { home: number; draw: number; away: number };
    ptsTS?: { home: number; draw: number; away: number };
    ptsGA?: { home: number; draw: number; away: number };
    ptsGS?: { home: number; draw: number; away: number };
    ptsL10?: { home: number; draw: number; away: number };
    ptsMO?: { home: number; draw: number; away: number };
    ptsLE?: { home: number; draw: number; away: number; wasDrawn?: boolean };
    tsIndicators?: string;
    bonuses?: { home: number; away: number };
    upsetPotential?: { team: string; bonus: number } | null;
  };
}

export interface AIAnalysisArchive {
  id: string;
  date: string;
  mode: 'architect' | 'live' | 'jackpot' | 'post_match' | 'self_learn' | 'post_match_daily' | 'post_match_jackpot' | 'system_architecture' | 'supreme_weightings';
  data: any;
  stats?: {
    totalMatches: number;
    accuracy?: number;
    jackpotId?: string;
    strategy?: string; // Added to track specific self-learn strategy (e.g. 'upset', 'value_bets')
  }
}

export interface User {
  id: string;
  name: string;
  username: string;
  phone: string;
  role: 'Super Admin' | 'Admin' | 'User';
  branch?: string;
  email?: string;
  status: 'Active' | 'Inactive';
  regDate?: string;
}