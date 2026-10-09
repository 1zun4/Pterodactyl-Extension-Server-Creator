import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Label, PageContentBlock, Spinner, TitledGreyBox, httpErrorToHuman, toast, usePanelNavigate } from '@pterodactyl/sdk';
import { createServer, getOverview, keys, type Game, type Limits } from '../api';
import Artwork from '../components/Artwork';
import { formatResource, remainingText } from '../lib/format';

type Sized = 'memory' | 'disk' | 'cpu';
const SIZED: { key: Sized; label: string; unit: string }[] = [
    { key: 'memory', label: 'Memory', unit: 'MiB' },
    { key: 'disk', label: 'Disk', unit: 'MiB' },
    { key: 'cpu', label: 'CPU', unit: '%' },
];

/** The range a user may pick from: the game's limits, capped by what is left of their quota. */
function range(game: Game, remaining: Limits, key: Sized) {
    return { min: game[`${key}_min`], max: Math.min(game[`${key}_max`], remaining[key]) };
}

function shortfall(game: Game, remaining: Limits): string | null {
    const missing = SIZED.find(({ key }) => range(game, remaining, key).min > range(game, remaining, key).max);
    const feature = (['databases', 'backups', 'allocations'] as const).find((key) => game[key] > remaining[key]);

    return missing ? `Needs ${formatResource(missing.key, game[`${missing.key}_min`])} ${missing.label.toLowerCase()}` : feature ? 'Not enough left in your quota' : null;
}

export default function CreateScreen() {
    const navigate = usePanelNavigate();
    const queryClient = useQueryClient();
    const overview = useQuery({ queryKey: keys.overview, queryFn: getOverview });
    const [game, setGame] = useState<Game | null>(null);
    const [name, setName] = useState('');
    const [sizes, setSizes] = useState<Record<Sized, number>>({ memory: 0, disk: 0, cpu: 0 });
    const [environment, setEnvironment] = useState<Record<string, string>>({});

    const creation = useMutation({
        mutationFn: () => createServer({ game: game!.id, name: name.trim(), ...sizes, environment }),
        onSuccess: ({ identifier }) => {
            toast.success('Server created. It is being installed now.');
            queryClient.invalidateQueries({ queryKey: keys.overview });
            navigate({ to: '/server/$id', params: { id: identifier } });
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    const pick = (picked: Game, remaining: Limits) => {
        setGame(picked);
        setName((current) => current || picked.name);
        setSizes({ memory: range(picked, remaining, 'memory').min, disk: range(picked, remaining, 'disk').min, cpu: range(picked, remaining, 'cpu').min });
        setEnvironment(Object.fromEntries((picked.variables ?? []).map((variable) => [variable.key, variable.default])));
    };

    if (!overview.data) {
        return (
            <PageContentBlock title='Create server'>
                {overview.isError ? <p className='srvc:text-sm srvc:text-destructive'>{httpErrorToHuman(overview.error)}</p> : <Spinner centered size={Spinner.Size.LARGE} />}
            </PageContentBlock>
        );
    }

    const { remaining } = overview.data.quota;
    const valid = game !== null && name.trim() !== '' && SIZED.every(({ key }) => sizes[key] >= range(game, remaining, key).min && sizes[key] <= range(game, remaining, key).max);

    return (
        <PageContentBlock title='Create server'>
            <header className='srvc:mb-6'>
                <h1 className='srvc:font-header srvc:text-2xl srvc:font-semibold srvc:text-foreground'>Create a server</h1>
                <p className='srvc:mt-1 srvc:text-sm srvc:leading-relaxed srvc:text-foreground/70'>{remainingText(remaining)}</p>
            </header>

            {overview.data.games.length === 0 || remaining.servers < 1 ? (
                <p className='srvc:py-8 srvc:text-center srvc:text-sm srvc:text-muted-foreground'>{remaining.servers < 1 ? 'Delete a server or ask an administrator for a higher limit.' : 'There are no games to choose from yet.'}</p>
            ) : (
                <div className='srvc:grid srvc:gap-6'>
                    <section>
                        <h2 className='srvc:mb-3 srvc:font-header srvc:text-sm srvc:font-semibold srvc:uppercase srvc:tracking-wide srvc:text-foreground'>1. Pick a game</h2>
                        <div className='srvc:grid srvc:grid-cols-1 srvc:gap-4 srvc:sm:grid-cols-2 srvc:lg:grid-cols-4'>
                            {overview.data.games.map((item) => {
                                const blocked = shortfall(item, remaining);
                                const selected = game?.id === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        type='button'
                                        disabled={blocked !== null}
                                        aria-pressed={selected}
                                        onClick={() => pick(item, remaining)}
                                        className={`srvc:flex srvc:flex-col srvc:gap-3 srvc:rounded-sm srvc:border srvc:bg-card srvc:p-3 srvc:text-left srvc:transition-colors disabled:srvc:cursor-not-allowed disabled:srvc:opacity-50 ${selected ? 'srvc:border-primary' : 'srvc:border-transparent srvc:hover:border-border'}`}
                                    >
                                        <Artwork src={item.artwork} name={item.name} />
                                        <div className='srvc:min-w-0'>
                                            <p className='srvc:truncate srvc:font-medium srvc:text-foreground'>{item.name}</p>
                                            <p className='srvc:line-clamp-2 srvc:text-xs srvc:text-muted-foreground'>{blocked ?? item.description ?? `${formatResource('memory', item.memory_min)} to ${formatResource('memory', item.memory_max)} memory`}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {game && (
                        <section>
                            <h2 className='srvc:mb-3 srvc:font-header srvc:text-sm srvc:font-semibold srvc:uppercase srvc:tracking-wide srvc:text-foreground'>2. Set it up</h2>
                            <form
                                className='srvc:grid srvc:gap-6 srvc:lg:grid-cols-2'
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    valid && creation.mutate();
                                }}
                            >
                                <TitledGreyBox title='Server'>
                                    <div className='srvc:grid srvc:gap-4'>
                                        <div>
                                            <Label htmlFor='srvc-name'>Name</Label>
                                            <Input id='srvc-name' maxLength={191} value={name} onChange={(event) => setName(event.currentTarget.value)} />
                                        </div>
                                        {SIZED.map(({ key, label, unit }) => {
                                            const { min, max } = range(game, remaining, key);

                                            return (
                                                <div key={key}>
                                                    <Label htmlFor={`srvc-${key}`}>
                                                        {label} ({unit})
                                                    </Label>
                                                    <Input id={`srvc-${key}`} type='number' min={min} max={max} value={sizes[key]} onChange={(event) => setSizes({ ...sizes, [key]: Number(event.currentTarget.value) })} />
                                                    <p className='srvc:mt-1 srvc:text-xs srvc:text-muted-foreground'>
                                                        Between {formatResource(key, min)} and {formatResource(key, max)}.
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </TitledGreyBox>
                                <TitledGreyBox title='Settings'>
                                    <div className='srvc:grid srvc:gap-4'>
                                        {(game.variables ?? []).length === 0 && <p className='srvc:text-sm srvc:text-muted-foreground'>Nothing to set up. You can change startup settings later.</p>}
                                        {(game.variables ?? []).map((variable) => (
                                            <div key={variable.key}>
                                                <Label htmlFor={`srvc-var-${variable.key}`}>
                                                    {variable.name}
                                                    {variable.required && ' *'}
                                                </Label>
                                                <Input id={`srvc-var-${variable.key}`} value={environment[variable.key] ?? ''} onChange={(event) => setEnvironment({ ...environment, [variable.key]: event.currentTarget.value })} />
                                                {variable.description && <p className='srvc:mt-1 srvc:text-xs srvc:text-muted-foreground'>{variable.description}</p>}
                                            </div>
                                        ))}
                                        <div className='srvc:flex srvc:justify-end srvc:pt-2'>
                                            <Button type='submit' disabled={!valid} isLoading={creation.isPending}>
                                                Create server
                                            </Button>
                                        </div>
                                    </div>
                                </TitledGreyBox>
                            </form>
                        </section>
                    )}
                </div>
            )}
        </PageContentBlock>
    );
}
