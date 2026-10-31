import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  calculatePosition,
  type Placement,
  type Rectangle,
  type TourPosition,
} from './position.js';

export type TourTarget = string | RefObject<Element | null> | (() => Element | null);

export interface TourStep {
  target: TourTarget;
  title: ReactNode;
  content: ReactNode;
  placement?: Placement;
}

export interface MissingTarget {
  index: number;
  step: TourStep;
  reason: 'missing-target' | 'invalid-selector';
}

export interface TourProps {
  open: boolean;
  steps: readonly TourStep[];
  index: number;
  onStepChange: (index: number) => void;
  onClose: (reason: 'complete' | 'skip' | 'escape') => void;
  onTargetMissing?: (details: MissingTarget) => void;
  width?: number;
  gap?: number;
  padding?: number;
  spotlightPadding?: number;
  zIndex?: number;
  labels?: Partial<{ next: string; back: string; skip: string; finish: string }>;
  className?: string;
  style?: CSSProperties;
}

interface Measurement {
  target: Rectangle;
  position: TourPosition;
}

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Tour({
  open,
  steps,
  index,
  onStepChange,
  onClose,
  onTargetMissing,
  width = 320,
  gap = 12,
  padding = 12,
  spotlightPadding = 4,
  zIndex = 1000,
  labels,
  className = '',
  style,
}: TourProps) {
  if (!Number.isInteger(index) || index < 0 || (open && index >= steps.length)) {
    throw new RangeError('index must refer to an existing step when open');
  }
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    [gap, padding, spotlightPadding].some((value) => !Number.isFinite(value) || value < 0) ||
    !Number.isFinite(zIndex)
  ) {
    throw new RangeError('Invalid tour dimensions');
  }
  const step = steps[index];
  const panel = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  const callbacks = useRef({ onClose, onTargetMissing });
  callbacks.current = { onClose, onTargetMissing };
  const titleId = useId();
  const contentId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        callbacks.current.onClose('escape');
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const controls = Array.from(
        panel.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      const first = controls[0] ?? panel.current;
      const last = controls[controls.length - 1] ?? panel.current;
      const active = document.activeElement;
      if (
        !panel.current.contains(active) ||
        (event.shiftKey && active === first) ||
        (!event.shiftKey && active === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('keydown', keyboard, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    setMeasurement(null);
    setFailure(null);
    if (!open || !step) return;
    let target: Element | null = null;
    let reason: MissingTarget['reason'] = 'missing-target';
    try {
      target =
        typeof step.target === 'string'
          ? document.querySelector(step.target)
          : typeof step.target === 'function'
            ? step.target()
            : step.target.current;
    } catch (error) {
      if (typeof step.target !== 'string') throw error;
      reason = 'invalid-selector';
    }
    const missing = () => {
      setMeasurement(null);
      const details: MissingTarget = { index, step, reason };
      if (callbacks.current.onTargetMissing) callbacks.current.onTargetMissing(details);
      else setFailure(new Error(`Tour step ${index}: ${reason}`));
    };
    if (!target || !target.isConnected) {
      missing();
      return;
    }
    let reported = false;
    const measure = () => {
      if (!target.isConnected) {
        if (!reported) {
          reported = true;
          missing();
        }
        return;
      }
      const rect = target.getBoundingClientRect();
      const targetRect = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
      const panelRect = panel.current?.getBoundingClientRect();
      setMeasurement({
        target: targetRect,
        position: calculatePosition({
          target: targetRect,
          panel: {
            width:
              panelRect?.width || Math.min(width, Math.max(0, window.innerWidth - padding * 2)),
            height: panelRect?.height || 180,
          },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          placement: step.placement,
          gap,
          padding,
        }),
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(target);
    if (panel.current) observer?.observe(panel.current);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      observer?.disconnect();
    };
  }, [open, step, index, width, gap, padding]);

  const ready = measurement !== null;
  useEffect(() => {
    if (open && ready) {
      const first = panel.current?.querySelector<HTMLElement>(focusableSelector);
      (first ?? panel.current)?.focus();
    }
  }, [open, index, ready]);

  if (failure && open) throw failure;
  if (!open || !step) return null;
  const rect = measurement?.target;
  return (
    <div
      className={`lp-tour ${className}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        ...style,
      }}
    >
      <div
        className="lp-tour__blocker"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: rect ? 'transparent' : 'rgba(0,0,0,.6)',
        }}
      />
      {rect && (
        <div
          className="lp-tour__spotlight"
          aria-hidden="true"
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            top: rect.top - spotlightPadding,
            left: rect.left - spotlightPadding,
            width: rect.width + spotlightPadding * 2,
            height: rect.height + spotlightPadding * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,.6)',
            borderRadius: 4,
          }}
        />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={contentId}
        tabIndex={-1}
        className="lp-tour__panel"
        data-placement={measurement?.position.placement}
        style={{
          position: 'fixed',
          boxSizing: 'border-box',
          width,
          maxWidth: `calc(100vw - ${padding * 2}px)`,
          maxHeight: `calc(100vh - ${padding * 2}px)`,
          overflow: 'auto',
          visibility: ready ? 'visible' : 'hidden',
          top: measurement?.position.top ?? padding,
          left: measurement?.position.left ?? padding,
          background: 'white',
          color: '#172033',
          padding: 20,
          borderRadius: 8,
        }}
      >
        <div className="lp-tour__progress" aria-live="polite">
          Step {index + 1} of {steps.length}
        </div>
        <h2 id={titleId}>{step.title}</h2>
        <div id={contentId}>{step.content}</div>
        <div className="lp-tour__controls">
          <button type="button" onClick={() => onClose('skip')}>
            {labels?.skip ?? 'Skip'}
          </button>
          <button type="button" disabled={index === 0} onClick={() => onStepChange(index - 1)}>
            {labels?.back ?? 'Back'}
          </button>
          <button
            type="button"
            onClick={() =>
              index === steps.length - 1 ? onClose('complete') : onStepChange(index + 1)
            }
          >
            {index === steps.length - 1 ? (labels?.finish ?? 'Finish') : (labels?.next ?? 'Next')}
          </button>
        </div>
      </div>
    </div>
  );
}
