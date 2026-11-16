import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';
export { THURSDAY_RULES_MAP, getThursdayCategorySettings, evaluateThursdayScoreDetailed } from './opwthursday';

/**
 * Dedicated Thursday OPW Algorithm Engine (src/opwalgothursday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Thursday matches,
 * specializing in European cup nights, South American continental fixtures, and weekend transition.
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
