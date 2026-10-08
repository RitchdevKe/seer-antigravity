import React from 'react';
import SeerAnalysis from './src/components/SeerAnalysis';

try {
  SeerAnalysis({
    historicalMatches: [],
    liveMatches: [],
    phaStatsMap: {}
  });
  console.log("Success! No error during render body.");
} catch (e) {
  console.error("Render Error:", e);
}
