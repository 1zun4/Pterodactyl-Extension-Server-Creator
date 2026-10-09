import type { Limits, Resource } from '../api';

export const LABELS: Record<Resource, string> = {
    servers: 'Servers',
    memory: 'Memory',
    disk: 'Disk',
    cpu: 'CPU',
    databases: 'Databases',
    backups: 'Backups',
    allocations: 'Extra ports',
};

export function formatMiB(mib: number): string {
    return mib >= 1024 ? `${Number((mib / 1024).toFixed(1))} GiB` : `${mib} MiB`;
}

export function formatResource(resource: Resource, value: number): string {
    if (resource === 'memory' || resource === 'disk') return formatMiB(value);
    if (resource === 'cpu') return `${value}%`;

    return String(value);
}

/** "2 servers, 4 GiB memory and 20 GiB disk left" style summary of what is left. */
export function remainingText(remaining: Limits): string {
    if (remaining.servers < 1) {
        return 'You have used all of your servers.';
    }

    return `You can create ${remaining.servers} more ${remaining.servers === 1 ? 'server' : 'servers'} with up to ${formatMiB(remaining.memory)} memory, ${formatMiB(remaining.disk)} disk and ${remaining.cpu}% CPU.`;
}
