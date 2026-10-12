import type { Limits, Resource } from '../api';
import { formatCpu, formatMiB, formatSize, isSized } from './resources';

export const LABELS: Record<Resource, string> = {
    servers: 'Servers',
    memory: 'Memory',
    disk: 'Disk',
    cpu: 'CPU',
    databases: 'Databases',
    backups: 'Backups',
    allocations: 'Extra ports',
};

export function formatResource(resource: Resource, value: number): string {
    return isSized(resource) ? formatSize(resource, value) : String(value);
}

/** "2 servers, 4 GiB memory and 20 GiB disk left" style summary of what is left. */
export function remainingText(remaining: Limits): string {
    if (remaining.servers < 1) {
        return 'You have used all of your servers.';
    }

    return `You can create ${remaining.servers} more ${remaining.servers === 1 ? 'server' : 'servers'} with up to ${formatMiB(remaining.memory)} memory, ${formatMiB(remaining.disk)} disk and ${formatCpu(remaining.cpu)}.`;
}
