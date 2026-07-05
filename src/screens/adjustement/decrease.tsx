import React from 'react';
import PriceAdjustmentForm from './increase';
;

const DecreaseScreen = ({ onComplete }: { onComplete?: () => void }) => {
  return <PriceAdjustmentForm mode="decrease" onComplete={onComplete} />;
};

export default DecreaseScreen;