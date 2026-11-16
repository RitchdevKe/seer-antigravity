import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';
export { SUNDAY_RULES_MAP, getSundayCategorySettings, evaluateSundayScoreDetailed } from './opwsunday';

/**
 * Dedicated Sunday OPW Algorithm Engine (src/opwalgosunday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Sunday matches,
 * specializing in weekend closing dynamics, heavy volume, and late European derbies.
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
