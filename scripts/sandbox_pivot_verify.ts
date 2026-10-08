import { config } from 'dotenv';
config();
import { getOptimalHedge } from '../src/utils/volatilityEngine';
import { Match } from '../src/types/Match';

const test = () => {
    // Mock a highly risky match
    const riskyMatch: Partial<Match> = {
        id: 'test_123',
        status: 'ns',
        odds: {
            o1: 2.1,
            oX: 3.2,
            o2: 3.5,
            u25: 1.8,
            o25: 1.9,
            bttsYes: 1.8,
            bttsNo: 1.9,
            updatedAt: 0
        },
        algoReport: {
            prediction: '1',
            probabilities: {
                '1': 0.45,
                'X': 0.36,
                '2': 0.19,
                'U2.5': 0.55
            }
        },
        seerPercentages: {
            '1': 45,
            'X': 36,
            '2': 19
        },
        isLastResortRisk: true
    } as any;

    const phaStatsMap = {};

    console.log("Evaluating risky match with isLastResortRisk = true");
    const predTrue = getOptimalHedge(riskyMatch as Match, phaStatsMap);
    console.log(`Pivot result (true): ${predTrue}`);

    const safeMatch = { ...riskyMatch, isLastResortRisk: false };
    console.log("Evaluating risky match with isLastResortRisk = false");
    const predFalse = getOptimalHedge(safeMatch as Match, phaStatsMap);
    console.log(`Pivot result (false): ${predFalse}`);
};

test();
