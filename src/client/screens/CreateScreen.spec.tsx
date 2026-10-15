import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createExtensionTestHost } from '@pterodactyl/sdk/testing';
import * as api from '../api';
import CreateScreen from './CreateScreen';

const game = (id: number, name: string, memory_min: number, cpu_max = 200): api.Game => ({
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
    cpu_max,
    databases: 0,
    backups: 0,
    allocations: 0,
    variables: [{ key: 'VERSION', name: 'Version', description: null, default: 'latest', required: true }],
});

const limits = (servers: number, memory: number): api.Limits => ({ servers, memory, disk: 30720, cpu: 300, databases: 0, backups: 0, allocations: 0 });

vi.mock('../api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api')>()), getOverview: vi.fn(), createServer: vi.fn() }));

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
    expect(screen.getByRole('slider', { name: 'Memory' }).getAttribute('aria-valuetext')).toBe('1 GiB');
    expect(screen.getByText('2 GiB of 6 GiB left')).toBeTruthy();
    expect((screen.getByLabelText(/Version/) as HTMLInputElement).value).toBe('latest');
    host.dispose();
});

test('picks sizes with sliders and presets but sends MiB and percent', async () => {
    vi.mocked(api.getOverview).mockResolvedValue({ quota: { limits: limits(2, 6144), used: limits(0, 0), remaining: limits(2, 3072) }, games: [game(1, 'Paper', 1024)], servers: [] });
    vi.mocked(api.createServer).mockResolvedValue({ identifier: 'abcd1234' });
    const host = renderScreen();

    fireEvent.click(await screen.findByRole('button', { name: /Paper/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use the recommended 2 GiB' }));
    expect(screen.getByRole('slider', { name: 'Memory' }).getAttribute('aria-valuetext')).toBe('2 GiB');
    expect(screen.getByText('1 GiB of 6 GiB left')).toBeTruthy();

    fireEvent.change(screen.getByRole('slider', { name: 'Disk' }), { target: { value: '5' } });
    expect(screen.getByRole('slider', { name: 'Disk' }).getAttribute('aria-valuetext')).toBe('10 GiB');
    expect(screen.getByRole('slider', { name: 'CPU' }).getAttribute('aria-valuetext')).toBe('1 core');

    fireEvent.click(screen.getByRole('button', { name: 'Create server' }));
    await vi.waitFor(() => expect(api.createServer).toHaveBeenCalledWith({ game: 1, name: 'Paper', memory: 2048, disk: 10240, cpu: 100, environment: { VERSION: 'latest' } }));
    host.dispose();
});

test('shows a size the plan pins as a locked slider', async () => {
    vi.mocked(api.getOverview).mockResolvedValue({ quota: { limits: limits(2, 6144), used: limits(0, 0), remaining: limits(2, 3072) }, games: [game(1, 'Paper', 1024, 100)], servers: [] });
    const host = renderScreen();

    fireEvent.click(await screen.findByRole('button', { name: /Paper/ }));

    expect(screen.getByText('Set by your plan')).toBeTruthy();
    expect((screen.getByRole('slider', { name: 'CPU' }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('slider', { name: 'CPU' }).getAttribute('aria-valuetext')).toBe('1 core');
    host.dispose();
});

test('explains when the quota is used up', async () => {
    vi.mocked(api.getOverview).mockResolvedValue({ quota: { limits: limits(1, 2048), used: limits(1, 2048), remaining: limits(0, 0) }, games: [game(1, 'Paper', 1024)], servers: [] });
    const host = renderScreen();

    expect(await screen.findByText('You have used all of your servers.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Paper/ })).toBeNull();
    host.dispose();
});
