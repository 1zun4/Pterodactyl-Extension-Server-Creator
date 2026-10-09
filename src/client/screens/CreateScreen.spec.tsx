import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createExtensionTestHost } from '@pterodactyl/sdk/testing';
import * as api from '../api';
import CreateScreen from './CreateScreen';

const game = (id: number, name: string, memory_min: number): api.Game => ({
    id,
    egg_id: id,
    egg: 'Egg',
    name,
    description: `${name} server`,
    image: null,
    steam_app_id: null,
    artwork: null,
    docker_image: null,
    enabled: true,
    sort: 0,
    memory_min,
    memory_max: 4096,
    disk_min: 5120,
    disk_max: 20480,
    cpu_min: 100,
    cpu_max: 200,
    databases: 0,
    backups: 0,
    allocations: 0,
    variables: [{ key: 'VERSION', name: 'Version', description: null, default: 'latest', required: true }],
});

const limits = (servers: number, memory: number): api.Limits => ({ servers, memory, disk: 30720, cpu: 300, databases: 0, backups: 0, allocations: 0 });

vi.mock('../api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api')>()), getOverview: vi.fn() }));

afterEach(cleanup);

function renderScreen() {
    const host = createExtensionTestHost({ extensionId: 'server-creator', prefix: 'srvc' });
    render(<CreateScreen />, { wrapper: host.Wrapper });

    return host;
}

test('offers games that fit and fills in their defaults', async () => {
    vi.mocked(api.getOverview).mockResolvedValue({ quota: { limits: limits(2, 6144), used: limits(0, 0), remaining: limits(2, 3072) }, games: [game(1, 'Paper', 1024), game(2, 'Rust', 4096)], servers: [] });
    const host = renderScreen();

    expect(await screen.findByText(/You can create 2 more servers/)).toBeTruthy();
    expect(screen.getByText('Needs 4 GiB memory')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Rust/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Paper/ }));

    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Paper');
    expect((screen.getByLabelText('Memory (MiB)') as HTMLInputElement).value).toBe('1024');
    expect((screen.getByLabelText(/Version/) as HTMLInputElement).value).toBe('latest');
    expect(screen.getByText('Between 1 GiB and 3 GiB.')).toBeTruthy();
    host.dispose();
});

test('explains when the quota is used up', async () => {
    vi.mocked(api.getOverview).mockResolvedValue({ quota: { limits: limits(1, 2048), used: limits(1, 2048), remaining: limits(0, 0) }, games: [game(1, 'Paper', 1024)], servers: [] });
    const host = renderScreen();

    expect(await screen.findByText('You have used all of your servers.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Paper/ })).toBeNull();
    host.dispose();
});
