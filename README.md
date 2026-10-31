# @lp-labs/react-tour

Package version: `1.0.0`.

A controlled guided-tour dialog with selector/ref targets, a spotlight, viewport
placement, next/back/skip controls, keyboard handling and focus restoration.
React 18.2 or 19 is the only runtime peer. There are no runtime dependencies and
no ReactDOM import or portal. ESM, CommonJS, declarations and optional CSS ship
together.

## Use

```sh
npm install @lp-labs/react-tour react
```

```tsx
import { useRef, useState } from "react";
import { Tour, type TourStep } from "@lp-labs/react-tour";
import "@lp-labs/react-tour/styles.css";

export function Welcome() {
  const save = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const steps: TourStep[] = [
    { target: "#workspace", title: "Workspace", content: "Your projects live here." },
    { target: save, title: "Save", content: "Save your changes.", placement: "left" }
  ];
  return (
    <>
      <button onClick={() => { setIndex(0); setOpen(true); }}>Start tour</button>
      <main id="workspace">Projects</main>
      <button ref={save}>Save</button>
      <Tour
        open={open}
        steps={steps}
        index={index}
        onStepChange={setIndex}
        onClose={(reason) => { setOpen(false); console.log(reason); }}
        onTargetMissing={({ index, reason }) => {
          console.warn(`Step ${index}: ${reason}`);
          setOpen(false);
        }}
      />
    </>
  );
}
```

The parent must apply `onStepChange` and close on `onClose`. The component never
changes `open` or `index` itself. A final Next requests `onClose("complete")`;
Skip requests `"skip"`; Escape requests `"escape"`. Back is disabled at zero.
No completion callback is triggered on unmount or an externally closed tour.

## Target and step model

`TourStep` contains required `target`, `title: ReactNode`, `content: ReactNode`
and optional `placement: "top" | "right" | "bottom" | "left"` (default bottom).
`TourTarget` is one of:

* A CSS selector string, resolved with `document.querySelector`.
* A React ref object with `current: Element | null`.
* A function `() => Element | null`.

Targets must be connected to the same document. Resolution happens when the
step, index, open state or geometry options change. Mount targets before opening;
to retry an absent target, replace the step object or close/reopen. There is no
polling, automatic skip, cross-document/iframe or shadow-root selector search.
Use a ref/function for elements inside a shadow root.

When a target is missing or disconnected at resolution,
`onTargetMissing({index, step, reason: "missing-target"})` runs. Invalid CSS
selectors use `"invalid-selector"`. If the callback is omitted, the component
throws an `Error` on the next render for a React error boundary to handle.
Handle this callback by closing or changing steps; the dialog is hidden until
there is a measured target. Disconnecting a previously resolved target is
detected on its next resize/scroll measurement. A connected but hidden/zero-size
target is not classified as missing. Errors thrown by a target function propagate.

## Tour props

| Prop | Default | Contract |
| --- | --- | --- |
| `open` | required | Whether the tour is active. Closed tours render nothing. |
| `steps` | required | Readonly array of `TourStep`. |
| `index` | required | Nonnegative integer; must address an existing step while open. |
| `onStepChange(index)` | required | Requests previous/next step. |
| `onClose(reason)` | required | Requests close: `"complete"`, `"skip"` or `"escape"`. |
| `onTargetMissing(details)` | absent | Explicit missing-target handling; absent means an error is thrown. |
| `width` | `320` | Positive finite panel width in pixels, limited by viewport padding. |
| `gap` | `12` | Finite nonnegative target-to-panel spacing in pixels. |
| `padding` | `12` | Finite nonnegative viewport inset in pixels. |
| `spotlightPadding` | `4` | Finite nonnegative expansion of the visual target outline. |
| `zIndex` | `1000` | Finite inline overlay stacking level. |
| `labels` | English | Partial `{next, back, skip, finish}` string overrides; defaults Next, Back, Skip, Finish. |
| `className`, `style` | `""`, absent | Root class and React inline style overrides. Avoid overriding fixed geometry. |

Invalid index/dimensions throw `RangeError`, including while closed (a closed
index may exceed the steps array but cannot be negative/noninteger). Invalid
step placement throws `RangeError` during measurement. Callback exceptions are
not swallowed.

`TourProps` is the exported props interface. `MissingTarget` is the type of the
missing callback argument:
`{ index: number; step: TourStep; reason: "missing-target" | "invalid-selector" }`.
Callback signatures are `onStepChange(index: number): void`,
`onClose(reason: "complete" | "skip" | "escape"): void`, and optional
`onTargetMissing(details: MissingTarget): void`.
Runtime exports are only `Tour` and `calculatePosition`; type-only exports are
`TourProps`, `TourTarget`, `TourStep`, `MissingTarget`, `Placement`,
`PositionOptions`, `Rectangle`, and `TourPosition`. All are named exports.

## Placement helper

```ts
import { calculatePosition } from "@lp-labs/react-tour";

const position = calculatePosition({
  target: { top: 100, left: 200, width: 80, height: 40 },
  panel: { width: 320, height: 180 },
  viewport: { width: 1024, height: 768 },
  placement: "bottom",
  gap: 12,
  padding: 12
});
// { top, left, placement }
```

`PositionOptions` requires target `Rectangle` (`top`, `left`, `width`, `height`),
panel and viewport sizes, with placement/gap/padding defaults matching the
component. `TourPosition` contains numeric `top`, `left` and actual `placement`.
The helper flips to the opposite side when preferred space is insufficient
and the opposite side has more room, then clamps coordinates to viewport
padding. It does not choose all four sides or guarantee no target overlap when
space is insufficient. Oversized panels anchor at the padding; the component
separately constrains its size and provides overflow scrolling. Geometry must
be finite; sizes, gap and padding must not be negative, otherwise `RangeError`.

`Placement = "top" | "right" | "bottom" | "left"`.
`calculatePosition(options: PositionOptions): TourPosition` is synchronous and
DOM-independent. `PositionOptions.panel` and `.viewport` each require numeric
`width` and `height`; `.target` is a `Rectangle`. Placement, gap, and padding
are optional; no other component options are accepted by the helper.

## Behavior, accessibility and limitations

The inline fixed overlay blocks pointer interaction with the target and
background; the spotlight is visual, not an interactive hole. The dialog uses
`role="dialog"`, `aria-modal`, title/content relationships and a polite progress
label. Focus moves to its first eligible control, Tab/Shift+Tab wrap inside,
Escape requests close, and closing/unmounting restores the previously focused
connected HTML element. There is no automatic page scrolling or scroll lock.

The component does not apply `inert`/`aria-hidden` to the rest of the application:
virtual-cursor screen-reader navigation and programmatic focus can still reach
background content. Tab trapping filters disabled and hidden-attribute controls,
not every CSS visibility rule. Do not hide all controls through CSS. Mount only
one tour at a time; it is not a general-purpose modal manager. Content is trusted
React content; normal text is escaped, but consumers remain responsible for
custom HTML rendering.

Scroll (including nested scrolling) and window resize update positions. When
available, `ResizeObserver` watches the target and panel, with cleanup on step
change/close/unmount. Without it, content-only size changes require a subsequent
scroll/resize. No mutation observer tracks layout-only movement or target
replacement. Browser zoom, mobile visual viewport/keyboard behavior, transformed
ancestors and stacking contexts are not normalized. Mount near the document root,
outside transformed/clipping ancestors: without a portal, ancestor CSS can
constrain fixed positioning and z-index. Off-screen targets are not scrolled into
view automatically; call `scrollIntoView` before opening if appropriate.

Importing the module does not resolve targets, focus elements, or access browser
globals. A mounted open tour needs a DOM and the application's React renderer;
TypeScript needs DOM declarations for Element/ref targets. There is no async
task/AbortSignal API or worker dependency. Close/unmount performs listener,
observer, and focus cleanup. Frequent scroll/resize measurements cost layout
work; avoid expensive target functions/content and don't run multiple overlays
expecting a coordinated performance or accessibility guarantee.

## Customization

Import the CSS export or style the `lp-tour`, `lp-tour__panel`,
`lp-tour__spotlight`, `lp-tour__blocker`, `lp-tour__progress` and
`lp-tour__controls` classes yourself. Panel placement and essential contrast/
geometry have inline defaults. Use root `style` for font overrides and CSS for
controls. The panel's `data-placement` exposes the actual side.

```css
.product-tour .lp-tour__controls button {
  border-color: #7c3aed;
  color: #5b21b6;
}
.product-tour .lp-tour__panel { box-shadow: 0 16px 48px #0006; }
```

Use `className="product-tour"` and `labels` for control text localization;
the progress phrase remains English.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
