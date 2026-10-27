import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { serverResourcesQueryOptions } from '@pterodactyl/sdk';
import { createExtensionTestHost, createTestServer, type ExtensionTestHost } from '@pterodactyl/sdk/testing';
import * as api from '../api';
import ResourcesScreen from './ResourcesScreen';

vi.mock('../api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../api')>()), getOwnedServer: vi.fn(), switchGame: vi.fn() }));

let host: ExtensionTestHost | undefined;

afterEach(() => {
    cleanup();
    host?.dispose();
    host = undefined;
    vi.clearAllMocks();
});

const game = (id: number, name: string, changes: Partial<api.Game> = {}): api.Game => ({
    id,
    egg_id: id,
    egg: 'Egg',
    name,
    description: null,
    image: null,
    steam_app_id: null,
    artwork: null,
    docker_image: null,
    enabled: true,
    sort: 0,
    memory_min: 1024,
    memory_max: 4096,
    disk_min: 5120,
    disk_max: 20480,
    cpu_min: 100,
    cpu_max: 200,
    databases: 0,
    backups: 0,
    allocations: 0,
    ports: 1,
    port_variables: [],
    port_range: null,
    ...changes,
});

const owned = (changes: Partial<api.OwnedServer> = {}): api.OwnedServer => ({
    owned: true,
    allow_resize: false,
    allow_switch: true,
    allow_delete: false,
    game: 'Paper',
    game_id: 1,
    artwork: null,
    current: { memory: 2048, disk: 10240, cpu: 100 },
    limits: { memory: { min: 1024, max: 4096 }, disk: { min: 5120, max: 20480 }, cpu: { min: 100, max: 200 } },
    quota: { memory: { limit: 8192, available: 6144 }, disk: { limit: 40960, available: 30720 }, cpu: { limit: 400, available: 300 } },
    remaining: { servers: 1, memory: 6144, disk: 30720, cpu: 300, databases: 0, backups: 2, allocations: 0 },
    games: [game(2, 'Valheim', { memory_min: 4096, memory_max: 8192, ports: 2, port_range: '2456-2500' }), game(3, 'Rust', { memory_min: 8192, memory_max: 16384 })],
    ...changes,
});

function renderScreen(data: api.OwnedServer, state = 'offline') {
    vi.mocked(api.getOwnedServer).mockResolvedValue(data);
    host = createExtensionTestHost({ extensionId: 'server-creator', prefix: 'srvc', server: createTestServer({ identifier: 'abcd1234', uuid: 'uuid-1' }) });
    host.queryClient.setQueryData(serverResourcesQueryOptions('uuid-1').queryKey, { attributes: { current_state: state } } as never);
    render(<ResourcesScreen />, { wrapper: host.Wrapper });
}

test('switches to a game with the sizes moved into its limits', async () => {
    renderScreen(owned());
    vi.mocked(api.switchGame).mockResolvedValue(owned({ game: 'Valheim', game_id: 2 }));

    fireEvent.click(await screen.findByRole('button', { name: 'Switch game' }));
    expect((screen.getByRole('button', { name: /Rust/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Needs 8 GiB memory')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Valheim/ }));
    expect(screen.getByRole('slider', { name: 'Memory' }).getAttribute('aria-valuetext')).toBe('4 GiB');
    expect(screen.getByText(/moves to 2 free ports in a row in 2456-2500/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Switch game' }).at(-1)!);
    await waitFor(() => expect(api.switchGame).toHaveBeenCalledWith('abcd1234', { game: 2, memory: 4096, disk: 10240, cpu: 100, keep_variables: true, reinstall: true }));
});

test('asks to stop a running server before switching', async () => {
    renderScreen(owned(), 'running');

    expect(((await screen.findByRole('button', { name: 'Switch game' })) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Stop the server to switch its game.')).toBeTruthy();
});

test('says so for servers the user did not create here', async () => {
    renderScreen({ owned: false });

    expect(await screen.findByText('Only servers you created yourself can be changed here.')).toBeTruthy();
});
