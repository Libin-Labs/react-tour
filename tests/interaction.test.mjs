import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  "<!doctype html><html><body><button id='launch'>Launch</button><div id='target'>Target</div></body></html>",
  {
    url: 'http://localhost',
  },
);
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
]) {
  globalThis[name] = dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = React;
const { Tour } = await import('../dist/esm/index.js');
const h = React.createElement;
let targetTop = 100;
document.querySelector('#target').getBoundingClientRect = () => ({
  top: targetTop,
  left: 100,
  width: 80,
  height: 40,
});
const steps = [
  { target: '#target', title: 'First', content: 'Try the feature' },
  { target: { current: document.querySelector('#target') }, title: 'Second', content: 'Finish up' },
];

async function mount(props = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const base = { open: true, steps, index: 0, onStepChange() {}, onClose() {}, ...props };
  await act(async () => root.render(h(Tour, base)));
  return {
    container,
    async render(next) {
      Object.assign(base, next);
      await act(async () => root.render(h(Tour, base)));
    },
    async close() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

test('selector/ref targets, next/back/finish and skip callbacks are controlled', async () => {
  const indexes = [];
  const closes = [];
  const app = await mount({
    onStepChange: (value) => indexes.push(value),
    onClose: (reason) => closes.push(reason),
  });
  try {
    assert.equal(app.container.querySelector('[role="dialog"]').style.visibility, 'visible');
    assert.equal(app.container.querySelectorAll('button')[1].disabled, true);
    await act(async () => app.container.querySelectorAll('button')[2].click());
    assert.deepEqual(indexes, [1]);
    assert.equal(app.container.querySelector('h2').textContent, 'First');
    await app.render({ index: 1 });
    assert.equal(app.container.querySelector('h2').textContent, 'Second');
    await act(async () => {
      app.container.querySelectorAll('button')[1].click();
      app.container.querySelectorAll('button')[2].click();
      app.container.querySelectorAll('button')[0].click();
    });
    assert.deepEqual(indexes, [1, 0]);
    assert.deepEqual(closes, ['complete', 'skip']);
  } finally {
    await app.close();
  }
});

test('focus is trapped, Escape closes and original focus is restored', async () => {
  const launch = document.querySelector('#launch');
  launch.focus();
  const closes = [];
  const app = await mount({ onClose: (reason) => closes.push(reason) });
  try {
    const buttons = app.container.querySelectorAll('button');
    assert.equal(document.activeElement, buttons[0]);
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    assert.equal(document.activeElement, buttons[2]);
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    assert.equal(document.activeElement, buttons[0]);
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    assert.deepEqual(closes, ['escape']);
    await app.render({ open: false });
    assert.equal(document.activeElement, launch);
  } finally {
    await app.close();
  }
});

test('resize and captured scroll remeasure and listeners clean up on unmount', async () => {
  const added = [];
  const removed = [];
  const add = window.addEventListener;
  const remove = window.removeEventListener;
  window.addEventListener = function (...args) {
    added.push(args);
    return add.apply(this, args);
  };
  window.removeEventListener = function (...args) {
    removed.push(args);
    return remove.apply(this, args);
  };
  const app = await mount();
  try {
    const initial = app.container.querySelector('.lp-tour__spotlight').style.top;
    targetTop = 200;
    await act(async () => window.dispatchEvent(new Event('scroll')));
    assert.notEqual(app.container.querySelector('.lp-tour__spotlight').style.top, initial);
    targetTop = 250;
    await act(async () => window.dispatchEvent(new Event('resize')));
    assert.equal(app.container.querySelector('.lp-tour__spotlight').style.top, '246px');
  } finally {
    await app.close();
    window.addEventListener = add;
    window.removeEventListener = remove;
    targetTop = 100;
  }
  for (const [type, handler, capture] of added.filter(([type]) =>
    ['scroll', 'resize'].includes(type),
  )) {
    assert.ok(
      removed.some((entry) => entry[0] === type && entry[1] === handler && entry[2] === capture),
    );
  }
});

test('missing and invalid selector targets invoke an explicit callback', async () => {
  const missing = [];
  const app = await mount({
    steps: [{ target: '#absent', title: 'Absent', content: 'Unavailable' }],
    onTargetMissing: (details) => missing.push(details),
  });
  try {
    assert.equal(missing.length, 1);
    assert.equal(missing[0].reason, 'missing-target');
    await app.render({ steps: [{ target: '[', title: 'Bad', content: 'Unavailable' }] });
    assert.equal(missing[1].reason, 'invalid-selector');
  } finally {
    await app.close();
  }
});

test('ResizeObserver observes both target and panel and disconnects', async () => {
  const observed = [];
  let disconnected = false;
  globalThis.ResizeObserver = class {
    observe(element) {
      observed.push(element);
    }
    disconnect() {
      disconnected = true;
    }
  };
  const app = await mount();
  try {
    assert.equal(observed.length, 2);
    assert.equal(observed[0], document.querySelector('#target'));
  } finally {
    await app.close();
    delete globalThis.ResizeObserver;
  }
  assert.equal(disconnected, true);
});

test('a missing target without a handler reaches an error boundary', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let captured;
  class Boundary extends React.Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
      return { error };
    }
    componentDidCatch(error) {
      captured = error;
    }
    render() {
      return this.state.error ? h('p', null, 'Tour failed') : this.props.children;
    }
  }
  const originalError = console.error;
  console.error = () => {};
  try {
    await act(async () =>
      root.render(
        h(
          Boundary,
          null,
          h(Tour, {
            open: true,
            index: 0,
            steps: [{ target: '#absent', title: 'Missing', content: 'Body' }],
            onStepChange() {},
            onClose() {},
          }),
        ),
      ),
    );
    assert.match(captured.message, /Tour step 0: missing-target/);
    assert.equal(container.textContent, 'Tour failed');
  } finally {
    console.error = originalError;
    await act(async () => root.unmount());
    container.remove();
  }
});
