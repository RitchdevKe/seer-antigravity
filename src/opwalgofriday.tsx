import React from 'react';
import { OPWAlgo, OPWAlgoProps } from './opwalgo';

/**
 * Dedicated Friday OPW Algorithm Engine (src/opwalgofriday.tsx)
 * 
 * Specifically curates recommendations and points tuning for Friday matches,
 * specializing in weekend-opening league fixtures with strong home bias.
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
