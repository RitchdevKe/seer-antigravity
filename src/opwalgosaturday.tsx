import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';
export { SATURDAY_RULES_MAP, getSaturdayCategorySettings, evaluateSaturdayScoreDetailed } from './opwsaturday';

/**
 * Dedicated Saturday OPW Algorithm Engine (src/opwalgosaturday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Saturday matches,
 * learning from the main statistical OPW algo while specializing in Saturday-specific
 * schedule dynamics, maximum fixture volume, and league variations.
 */
export const OPWAlgoSaturday: React.FC<Omit<OPWAlgoProps, 'initialDay' | 'titlePrefix'>> = (props) => {
  return (
    <OPWAlgo
      {...props}
      initialDay="saturday"
      titlePrefix="Saturday"
    />
  );
};

export default OPWAlgoSaturday;
