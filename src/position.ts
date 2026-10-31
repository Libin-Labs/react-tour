export type Placement = 'top' | 'right' | 'bottom' | 'left';

export interface Rectangle {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PositionOptions {
  target: Rectangle;
  panel: { width: number; height: number };
  viewport: { width: number; height: number };
  placement?: Placement;
  gap?: number;
  padding?: number;
}

export interface TourPosition {
  top: number;
  left: number;
  placement: Placement;
}

export function calculatePosition({
  target,
  panel,
  viewport,
  placement = 'bottom',
  gap = 12,
  padding = 12,
}: PositionOptions): TourPosition {
  for (const value of [
    target.top,
    target.left,
    target.width,
    target.height,
    panel.width,
    panel.height,
    viewport.width,
    viewport.height,
    gap,
    padding,
  ]) {
    if (!Number.isFinite(value)) throw new RangeError('Geometry must be finite');
  }
  if (
    [
      target.width,
      target.height,
      panel.width,
      panel.height,
      viewport.width,
      viewport.height,
      gap,
      padding,
    ].some((value) => value < 0)
  ) {
    throw new RangeError('Sizes, gap and padding must not be negative');
  }
  if (!['top', 'right', 'bottom', 'left'].includes(placement)) {
    throw new RangeError('Invalid placement');
  }
  const opposite: Record<Placement, Placement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  const space: Record<Placement, number> = {
    top: target.top - padding,
    bottom: viewport.height - target.top - target.height - padding,
    left: target.left - padding,
    right: viewport.width - target.left - target.width - padding,
  };
  const needed =
    placement === 'top' || placement === 'bottom' ? panel.height + gap : panel.width + gap;
  if (space[placement] < needed && space[opposite[placement]] > space[placement]) {
    placement = opposite[placement];
  }
  let left = target.left + (target.width - panel.width) / 2;
  let top = target.top + (target.height - panel.height) / 2;
  if (placement === 'top') top = target.top - panel.height - gap;
  if (placement === 'bottom') top = target.top + target.height + gap;
  if (placement === 'left') left = target.left - panel.width - gap;
  if (placement === 'right') left = target.left + target.width + gap;
  return {
    top: Math.max(padding, Math.min(top, viewport.height - panel.height - padding)),
    left: Math.max(padding, Math.min(left, viewport.width - panel.width - padding)),
    placement,
  };
}
