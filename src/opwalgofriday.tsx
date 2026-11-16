import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';
export { FRIDAY_RULES_MAP, getFridayCategorySettings, evaluateFridayScoreDetailed } from './opwfriday';

/**
 * Dedicated Friday OPW Algorithm Engine (src/opwalgofriday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Friday matches,
 * learning from the main statistical OPW algo while specializing in Friday-specific
 * schedule dynamics, lower volume recovery, and underdog stability.
 */
export const OPWAlgoFriday: React.FC<Omit<OPWAlgoProps, 'initialDay' | 'titlePrefix'>> = (props) => {
  return (
    <OPWAlgo
      {...props}
      initialDay="friday"
      titlePrefix="Friday"
    />
  );
};

export default OPWAlgoFriday;
