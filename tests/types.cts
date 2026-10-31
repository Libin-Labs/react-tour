import tour = require('@lp-labs/react-tour');

const props: tour.TourProps = {
  open: false,
  steps: [{ target: { current: null }, title: 'Title', content: 'Body' }],
  index: 0,
  onStepChange() {},
  onClose() {},
};
tour.Tour(props);
