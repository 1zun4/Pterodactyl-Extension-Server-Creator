import type { Game, Limits } from '../api';
import { formatSize, type Sized } from './resources';

export const SIZED: { key: Sized; label: string }[] = [
    { key: 'memory', label: 'Memory' },
    { key: 'disk', label: 'Disk' },
    { key: 'cpu', label: 'CPU' },
];

/** The range a user may pick from: the game's limits, capped by what is left of their quota. */
export function range(game: Game, remaining: Limits, key: Sized) {
    return { min: game[`${key}_min`], max: Math.min(game[`${key}_max`], remaining[key]) };
}

/** Why the quota left cannot fit the game, or null when it can. */
export function shortfall(game: Game, remaining: Limits): string | null {
    const missing = SIZED.find(({ key }) => range(game, remaining, key).min > range(game, remaining, key).max);
    const feature = (['databases', 'backups', 'allocations'] as const).find((key) => game[key] > remaining[key]);

    if (missing) {
        return `Needs ${formatSize(missing.key, game[`${missing.key}_min`])}${missing.key === 'cpu' ? '' : ` ${missing.label.toLowerCase()}`}`;
    }

    return feature ? 'Not enough left in your quota' : null;
}
