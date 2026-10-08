import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';

/**
 * Dedicated Saturday OPW Algorithm Engine (src/opwalgosaturday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Saturday matches,
 * specializing in the largest weekly European matchday with extensive Top 12 volume,
 * defense-heavy bankers, and market favorite stability.
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
