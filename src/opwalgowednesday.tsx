import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';
export { WEDNESDAY_RULES_MAP, getWednesdayCategorySettings, evaluateWednesdayScoreDetailed } from './opwwednesday';

/**
 * Dedicated Wednesday OPW Algorithm Engine (src/opwalgowednesday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Wednesday matches,
 * specializing in midweek domestic & European cup fixtures.
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
