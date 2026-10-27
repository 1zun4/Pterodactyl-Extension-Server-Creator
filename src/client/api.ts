import { http } from '@pterodactyl/sdk';

export type Resource = 'servers' | 'memory' | 'disk' | 'cpu' | 'databases' | 'backups' | 'allocations';
export type Limits = Record<Resource, number>;

export interface Variable {
    key: string;
    name: string;
    description: string | null;
    default: string;
    required: boolean;
}

export interface Game {
    id: number;
    egg_id: number;
    egg: string | null;
    name: string;
    description: string | null;
    image: string | null;
    steam_app_id: number | null;
    artwork: string | null;
    docker_image: string | null;
    enabled: boolean;
    sort: number;
    memory_min: number;
    memory_max: number;
    disk_min: number;
    disk_max: number;
    cpu_min: number;
    cpu_max: number;
    databases: number;
    backups: number;
    allocations: number;
    /** Ports in a row each new server gets; the ones after the first go into `port_variables`. */
    ports: number;
    port_variables: string[];
    /** Ports and ranges new servers get their ports from, such as `25565-25600`; null for any port. */
    port_range: string | null;
    variables?: Variable[];
}

export type GameInput = Omit<Game, 'id' | 'egg' | 'egg_id' | 'artwork' | 'variables'> & {
    /** Null when the egg is imported from the catalog on save. */
    egg_id: number | null;
    catalog_id?: string | null;
};

/** Ready-made settings for a game, with the installed egg it would use. */
export type PopularGame = Omit<GameInput, 'image' | 'docker_image' | 'enabled' | 'sort' | 'databases' | 'backups' | 'allocations' | 'port_range'> & {
    catalog_id: string;
    catalog_egg: string;
    artwork: string | null;
};

export interface QuotaSummary {
    limits: Limits;
    used: Limits;
    remaining: Limits;
}

export interface Overview {
    quota: QuotaSummary;
    games: Game[];
    servers: { identifier: string; name: string; game: string | null }[];
}

export interface CreateInput {
    game: number;
    name: string;
    memory: number;
    disk: number;
    cpu: number;
    environment: Record<string, string>;
}

export interface OwnedServer {
    owned: boolean;
    allow_resize?: boolean;
    allow_switch?: boolean;
    allow_delete?: boolean;
    game?: string | null;
    game_id?: number | null;
    artwork?: string | null;
    current?: { memory: number; disk: number; cpu: number };
    limits?: Record<'memory' | 'disk' | 'cpu', { min: number; max: number }>;
    /** The plan's total, and what is left of it for this server. */
    quota?: Record<'memory' | 'disk' | 'cpu', { limit: number; available: number }>;
    /** What is left of the quota when this server is not counted. */
    remaining?: Limits;
    /** Games the server can switch to. */
    games?: Game[];
}

export interface SwitchInput {
    game: number;
    memory: number;
    disk: number;
    cpu: number;
    keep_variables: boolean;
    reinstall: boolean;
}

export interface Admin {
    games: Game[];
    eggs: { id: number; name: string; images: string[] }[];
    popular: PopularGame[];
    quota: Limits;
    users: { id: number; username: string; email: string; limits: Limits }[];
    locations: { all: { id: number; short: string; long: string | null }[]; selected: number[] };
}

export interface AdminUser {
    custom: Limits | null;
    quota: QuotaSummary;
    servers: { id: number; name: string; game: string | null }[];
}

export interface Copy {
    id: number;
    source: string;
    target: { id: number; name: string };
    step: 'backup' | 'backing-up' | 'restore' | 'restoring' | 'cleanup' | 'done' | 'failed';
    error: string | null;
    created_at: string;
}

const client = '/api/client/extensions/server-creator';
const server = (id: string) => `/api/client/servers/${id}/extensions/server-creator`;
const admin = '/api/admin/extensions/server-creator';

export const keys = {
    overview: ['server-creator', 'overview'] as const,
    server: (id: string) => ['server-creator', 'server', id] as const,
    admin: ['server-creator', 'admin'] as const,
    user: (id: number) => ['server-creator', 'user', id] as const,
    users: (query: string) => ['server-creator', 'users', query] as const,
    steam: (term: string) => ['server-creator', 'steam', term] as const,
    copies: (id: number) => ['server-creator', 'copies', id] as const,
};

export const getOverview = async () => (await http.get<Overview>(client)).data;
export const createServer = async (input: CreateInput) => (await http.post<{ identifier: string }>(`${client}/servers`, input)).data;

export const getOwnedServer = async (id: string) => (await http.get<OwnedServer>(server(id))).data;
export const resizeServer = async (id: string, resources: { memory: number; disk: number; cpu: number }) => (await http.put<OwnedServer>(server(id), resources)).data;
export const switchGame = async (id: string, input: SwitchInput) => (await http.put<OwnedServer>(`${server(id)}/game`, input)).data;
export const deleteServer = async (id: string, name: string) => http.delete(server(id), { data: { name } });

export const getAdmin = async () => (await http.get<Admin>(admin)).data;
export const saveGame = async (game: GameInput, id?: number) => (id ? await http.put<Admin>(`${admin}/games/${id}`, game) : await http.post<Admin>(`${admin}/games`, game)).data;
export const deleteGame = async (id: number) => (await http.delete<Admin>(`${admin}/games/${id}`)).data;
export const saveDefaultQuota = async (limits: Limits) => (await http.put<Admin>(`${admin}/quota`, limits)).data;
export const saveLocations = async (locations: number[]) => (await http.put<Admin>(`${admin}/locations`, { locations })).data;
export const searchUsers = async (query: string) => (await http.get<{ users: { id: number; username: string; email: string }[] }>(`${admin}/users`, { params: { query } })).data.users;
export const getAdminUser = async (id: number) => (await http.get<AdminUser>(`${admin}/users/${id}`)).data;
export const saveUserQuota = async (id: number, limits: Limits) => (await http.put<AdminUser>(`${admin}/users/${id}/quota`, limits)).data;
export const resetUserQuota = async (id: number) => (await http.delete<AdminUser>(`${admin}/users/${id}/quota`)).data;
export const searchSteam = async (term: string) => (await http.get<{ results: { id: number; name: string; image: string }[] }>(`${admin}/steam`, { params: { term } })).data.results;
export const duplicateServer = async (id: number, input: { name: string; owner: number; files: boolean }) => (await http.post<{ id: number; identifier: string }>(`${admin}/servers/${id}/duplicate`, input)).data;
export const getCopies = async (id: number) => (await http.get<{ copies: Copy[] }>(`${admin}/servers/${id}/copies`)).data.copies;
