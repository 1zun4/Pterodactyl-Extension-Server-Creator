/** Unit formatting and slider maths for memory and disk (MiB) and CPU (%, 100 = one core). */
export type Sized = 'memory' | 'disk' | 'cpu';

export interface Scale {
    min: number;
    max: number;
    step: number;
}

export interface Mark {
    value: number;
    /** Position on the track, 0 to 1. */
    at: number;
}

export const STEPS: Record<Sized, number> = { memory: 256, disk: 1024, cpu: 25 };

/** Common sizes, shown as tick marks and used for the "Recommended" preset. */
export const STOPS: Record<Sized, number[]> = {
    memory: [1024, 2048, 4096, 6144, 8192],
    disk: [5120, 10240, 20480, 51200],
    cpu: [50, 100, 200],
};

export const UNITS: Record<Sized, string> = { memory: 'MiB', disk: 'MiB', cpu: '%' };

export const isSized = (resource: string): resource is Sized => resource === 'memory' || resource === 'disk' || resource === 'cpu';

const trimmed = (value: number) => String(Number(value.toFixed(2)));

export function formatMiB(mib: number): string {
    if (mib === 0) return '0 GiB';
    if (mib < 1024) return `${mib} MiB`;
    if (mib < 1024 * 1024) return `${trimmed(mib / 1024)} GiB`;

    return `${trimmed(mib / 1024 / 1024)} TiB`;
}

export function formatCpu(percent: number): string {
    return `${trimmed(percent / 100)} ${percent === 100 ? 'core' : 'cores'}`;
}

export function formatSize(resource: Sized, value: number): string {
    return resource === 'cpu' ? formatCpu(value) : formatMiB(value);
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const scaleFor = (resource: Sized, min: number, max: number): Scale => ({ min, max, step: STEPS[resource] });

/** The multiples of the step strictly between min and max, as step counts. */
function inner({ min, max, step }: Scale) {
    const first = Math.floor(min / step) + 1;
    const last = Math.ceil(max / step) - 1;

    return { first, count: Math.max(0, last - first + 1) };
}

/** A slider stops at min, every multiple of the step in between, and max. */
export function stopCount(scale: Scale): number {
    return scale.max <= scale.min ? 1 : inner(scale).count + 2;
}

export function valueAt(scale: Scale, index: number): number {
    const last = stopCount(scale) - 1;
    const i = clamp(Math.round(index), 0, last);

    if (i === 0) return scale.min;
    if (i === last) return scale.max;

    return (inner(scale).first + i - 1) * scale.step;
}

/** The index of the stop closest to a value. */
export function indexOf(scale: Scale, value: number): number {
    const last = stopCount(scale) - 1;

    if (last === 0 || value <= scale.min) return 0;
    if (value >= scale.max) return last;

    const below = Math.min(Math.max(0, Math.floor(value / scale.step) - inner(scale).first + 1), last);
    const above = Math.min(below + 1, last);

    return value - valueAt(scale, below) < valueAt(scale, above) - value ? below : above;
}

export const snap = (scale: Scale, value: number) => valueAt(scale, indexOf(scale, value));

export const positionOf = (scale: Scale, value: number) => (stopCount(scale) === 1 ? 0 : indexOf(scale, value) / (stopCount(scale) - 1));

/** Tick marks for the common sizes that lie strictly inside the range. */
export function ticks(resource: Sized, scale: Scale): Mark[] {
    return STOPS[resource].filter((value) => value > scale.min && value < scale.max).map((value) => ({ value, at: positionOf(scale, value) }));
}

/** Labels under the track: both ends, plus the ticks that leave at least `gap` of room to their neighbours. */
export function labels(resource: Sized, scale: Scale, gap = 0.2): Mark[] {
    if (scale.max <= scale.min) return [{ value: scale.min, at: 0 }];

    const kept: Mark[] = [{ value: scale.min, at: 0 }];

    for (const tick of ticks(resource, scale)) {
        if (tick.at - kept[kept.length - 1].at >= gap && 1 - tick.at >= gap) kept.push(tick);
    }

    return [...kept, { value: scale.max, at: 1 }];
}

/** The next common size above the game's minimum, when it still fits. */
export function recommended(resource: Sized, scale: Scale): number | null {
    return STOPS[resource].find((value) => value > scale.min && value <= scale.max) ?? null;
}

/** "2 GiB of 4 GiB left" once `value` is taken out of what is available. */
export function leftText(resource: Sized, value: number, available: number, limit: number): string {
    return `${formatSize(resource, Math.max(0, available - value))} of ${formatSize(resource, limit)} left`;
}
