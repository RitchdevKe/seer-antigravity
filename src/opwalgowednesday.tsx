import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';

/**
 * Dedicated Wednesday OPW Algorithm Engine (src/opwalgowednesday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Wednesday matches,
 * specializing in European Champions League, domestic cup semi-finals, and prime favorites.
 */
export const OPWAlgoWednesday: React.FC<Omit<OPWAlgoProps, 'initialDay' | 'titlePrefix'>> = (props) => {
  return (
    <OPWAlgo
      {...props}
      initialDay="wednesday"
      titlePrefix="Wednesday"
    />
  );
};

export default OPWAlgoWednesday;
