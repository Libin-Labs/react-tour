import { Tour, calculatePosition, type TourProps } from '@lp-labs/react-tour';

const props: TourProps = {
  open: false,
  steps: [],
  index: 0,
  onStepChange(index) {
    index.toFixed();
  },
  onClose(reason) {
    const value: 'skip' | 'complete' | 'escape' = reason;
    void value;
  },
};
Tour(props);
calculatePosition({
  target: { top: 0, left: 0, width: 10, height: 10 },
  panel: { width: 100, height: 100 },
  viewport: { width: 800, height: 600 },
});
