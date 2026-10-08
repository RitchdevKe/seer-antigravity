import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';

/**
 * Dedicated Sunday OPW Algorithm Engine (src/opwalgosunday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Sunday matches,
 * specializing in Sunday Value Picks, high-draw danger mitigation, and
 * Sunday-specific underdog traps.
 */
export const OPWAlgoSunday: React.FC<Omit<OPWAlgoProps, 'initialDay' | 'titlePrefix'>> = (props) => {
  return (
    <OPWAlgo
      {...props}
      initialDay="sunday"
      titlePrefix="Sunday"
    />
  );
};

export default OPWAlgoSunday;
