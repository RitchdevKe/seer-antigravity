import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';

/**
 * Dedicated Monday OPW Algorithm Engine (src/opwalgomonday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Monday matches,
 * learning from the main statistical OPW algo while specializing in Monday-specific
 * schedule dynamics, lower volume recovery, and underdog stability.
 */
export const OPWAlgoMonday: React.FC<Omit<OPWAlgoProps, 'initialDay' | 'titlePrefix'>> = (props) => {
  return (
    <OPWAlgo
      {...props}
      initialDay="monday"
      titlePrefix="Monday"
    />
  );
};

export default OPWAlgoMonday;
