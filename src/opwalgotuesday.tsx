import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';

/**
 * Dedicated Tuesday OPW Algorithm Engine (src/opwalgotuesday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Tuesday matches,
 * specializing in midweek domestic & European cup fixtures.
 */
export const OPWAlgoTuesday: React.FC<Omit<OPWAlgoProps, 'initialDay' | 'titlePrefix'>> = (props) => {
  return (
    <OPWAlgo
      {...props}
      initialDay="tuesday"
      titlePrefix="Tuesday"
    />
  );
};

export default OPWAlgoTuesday;
