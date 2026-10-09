import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Dialog, Input, Label, Select, Switch } from '@pterodactyl/sdk';
import { keys, searchSteam, type Admin, type Game, type GameInput } from '../api';
import Artwork from './Artwork';

const RANGES = [
    { key: 'memory', label: 'Memory (MiB)' },
    { key: 'disk', label: 'Disk (MiB)' },
    { key: 'cpu', label: 'CPU (%)' },
] as const;

const FEATURES = [
    { key: 'databases', label: 'Databases' },
    { key: 'backups', label: 'Backups' },
    { key: 'allocations', label: 'Extra ports' },
] as const;

interface Props {
    game: Game | null;
    eggs: Admin['eggs'];
    pending: boolean;
    onClose: () => void;
    onSave: (input: GameInput) => void;
}

export default function GameDialog({ game, eggs, pending, onClose, onSave }: Props) {
    const [input, setInput] = useState<GameInput>(
        game ?? {
            egg_id: eggs[0]?.id ?? 0,
            name: '',
            description: null,
            image: null,
            steam_app_id: null,
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
            backups: 1,
            allocations: 0,
        }
    );
    const [term, setTerm] = useState('');
    const steam = useQuery({ queryKey: keys.steam(term), queryFn: () => searchSteam(term), enabled: term.trim().length >= 2 });
    const set = (changes: Partial<GameInput>) => setInput((current) => ({ ...current, ...changes }));
    const egg = eggs.find((item) => item.id === input.egg_id);
    const artwork = input.image || (input.steam_app_id ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${input.steam_app_id}/header.jpg` : null);
    const valid = input.name.trim() !== '' && input.egg_id > 0 && RANGES.every(({ key }) => input[`${key}_min`] <= input[`${key}_max`]);

    return (
        <Dialog open onClose={onClose} title={game ? `Edit ${game.name}` : 'Add a game'} preventExternalClose={pending}>
            <div className='srvc:grid srvc:gap-4'>
                <div className='srvc:grid srvc:gap-4 srvc:sm:grid-cols-[minmax(0,1fr)_10rem]'>
                    <div className='srvc:grid srvc:content-start srvc:gap-4'>
                        <div>
                            <Label htmlFor='srvc-egg'>Egg</Label>
                            <Select id='srvc-egg' value={input.egg_id} onChange={(value) => set({ egg_id: Number(value), docker_image: null })} options={eggs.map((item) => ({ value: item.id, label: item.name }))} />
                        </div>
                        <div>
                            <Label htmlFor='srvc-game-name'>Name</Label>
                            <Input id='srvc-game-name' value={input.name} maxLength={191} onChange={(event) => set({ name: event.currentTarget.value })} />
                        </div>
                    </div>
                    <Artwork src={artwork} name={input.name || 'No artwork'} className='srvc:self-end' />
                </div>
                <div>
                    <Label htmlFor='srvc-description'>Description</Label>
                    <Input id='srvc-description' value={input.description ?? ''} maxLength={1000} onChange={(event) => set({ description: event.currentTarget.value || null })} />
                </div>
                <div className='srvc:grid srvc:gap-4 srvc:sm:grid-cols-2'>
                    <div>
                        <Label htmlFor='srvc-steam'>Steam artwork</Label>
                        <Select
                            id='srvc-steam'
                            placeholder={input.steam_app_id ? `App ${input.steam_app_id}` : 'Search Steam'}
                            searchPlaceholder='Game name'
                            value={input.steam_app_id}
                            onSearchChange={setTerm}
                            onChange={(value) => {
                                const result = steam.data?.find((item) => item.id === Number(value));
                                set({ steam_app_id: Number(value) || null, name: input.name || result?.name || '' });
                            }}
                            options={(steam.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor='srvc-image'>Or an image URL</Label>
                        <Input id='srvc-image' type='url' placeholder='https://…' value={input.image ?? ''} onChange={(event) => set({ image: event.currentTarget.value || null })} />
                    </div>
                </div>
                {egg && egg.images.length > 1 && (
                    <div>
                        <Label htmlFor='srvc-docker'>Docker image</Label>
                        <Select id='srvc-docker' placeholder='Egg default' value={input.docker_image} onChange={(value) => set({ docker_image: String(value) || null })} options={egg.images.map((image) => ({ value: image, label: image }))} />
                    </div>
                )}
                <div className='srvc:grid srvc:grid-cols-2 srvc:gap-4 srvc:sm:grid-cols-3'>
                    {RANGES.map(({ key, label }) => (
                        <div key={key} className='srvc:grid srvc:gap-2'>
                            <Label htmlFor={`srvc-${key}-min`}>{label}</Label>
                            <div className='srvc:flex srvc:items-center srvc:gap-2'>
                                <Input id={`srvc-${key}-min`} aria-label={`${label} minimum`} type='number' min={0} value={input[`${key}_min`]} onChange={(event) => set({ [`${key}_min`]: Number(event.currentTarget.value) })} />
                                <span className='srvc:text-muted-foreground'>–</span>
                                <Input aria-label={`${label} maximum`} type='number' min={0} value={input[`${key}_max`]} onChange={(event) => set({ [`${key}_max`]: Number(event.currentTarget.value) })} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className='srvc:grid srvc:grid-cols-3 srvc:gap-4'>
                    {FEATURES.map(({ key, label }) => (
                        <div key={key}>
                            <Label htmlFor={`srvc-${key}`}>{label}</Label>
                            <Input id={`srvc-${key}`} type='number' min={0} max={100} value={input[key]} onChange={(event) => set({ [key]: Number(event.currentTarget.value) })} />
                        </div>
                    ))}
                </div>
                <label className='srvc:flex srvc:items-center srvc:justify-between srvc:gap-3 srvc:text-sm'>
                    <span>Users can pick this game</span>
                    <Switch aria-label='Enabled' checked={input.enabled} onChange={() => set({ enabled: !input.enabled })} />
                </label>
            </div>
            <Dialog.Footer>
                <Button.Text className='srvc:w-full srvc:sm:w-auto' disabled={pending} onClick={onClose}>
                    Cancel
                </Button.Text>
                <Button className='srvc:w-full srvc:sm:w-auto' disabled={!valid} isLoading={pending} onClick={() => onSave(input)}>
                    Save
                </Button>
            </Dialog.Footer>
        </Dialog>
    );
}
