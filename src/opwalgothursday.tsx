import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';

/**
 * Dedicated Thursday OPW Algorithm Engine (src/opwalgothursday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Thursday matches,
 * specializing in UEFA Europa League / Conference League volatility and high draw frequency.
 */
export const OPWAlgoThursday: React.FC<Omit<OPWAlgoProps, 'initialDay' | 'titlePrefix'>> = (props) => {
  return (
    <OPWAlgo
      {...props}
      initialDay="thursday"
      titlePrefix="Thursday"
    />
  );
};

export default OPWAlgoThursday;
