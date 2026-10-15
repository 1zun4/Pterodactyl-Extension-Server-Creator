import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Label, PageContentBlock, Spinner, TitledGreyBox, httpErrorToHuman, toast, usePanelNavigate } from '@pterodactyl/sdk';
import { createServer, getOverview, keys, type Game, type Limits } from '../api';
import Artwork from '../components/Artwork';
import ResourceSlider from '../components/ResourceSlider';
import { remainingText } from '../lib/format';
import { formatSize, type Sized } from '../lib/resources';

const SIZED: { key: Sized; label: string }[] = [
    { key: 'memory', label: 'Memory' },
    { key: 'disk', label: 'Disk' },
    { key: 'cpu', label: 'CPU' },
];

/** The range a user may pick from: the game's limits, capped by what is left of their quota. */
function range(game: Game, remaining: Limits, key: Sized) {
    return { min: game[`${key}_min`], max: Math.min(game[`${key}_max`], remaining[key]) };
}

function shortfall(game: Game, remaining: Limits): string | null {
    const missing = SIZED.find(({ key }) => range(game, remaining, key).min > range(game, remaining, key).max);
    const feature = (['databases', 'backups', 'allocations'] as const).find((key) => game[key] > remaining[key]);

    if (missing) {
        return `Needs ${formatSize(missing.key, game[`${missing.key}_min`])}${missing.key === 'cpu' ? '' : ` ${missing.label.toLowerCase()}`}`;
    }

    return feature ? 'Not enough left in your quota' : null;
}

export default function CreateScreen() {
    const navigate = usePanelNavigate();
    const queryClient = useQueryClient();
    const overview = useQuery({ queryKey: keys.overview, queryFn: getOverview });
    const [game, setGame] = useState<Game | null>(null);
    const [name, setName] = useState('');
    const [sizes, setSizes] = useState<Record<Sized, number>>({ memory: 0, disk: 0, cpu: 0 });
    const [environment, setEnvironment] = useState<Record<string, string>>({});
    const setup = useRef<HTMLElement>(null);

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
        setName((current) => (current === '' || current === game?.name ? picked.name : current));
        setSizes({ memory: range(picked, remaining, 'memory').min, disk: range(picked, remaining, 'disk').min, cpu: range(picked, remaining, 'cpu').min });
        setEnvironment(Object.fromEntries((picked.variables ?? []).map((variable) => [variable.key, variable.default])));
        // On phones the setup step starts below the game list, so bring it into view.
        requestAnimationFrame(() => {
            const top = setup.current?.getBoundingClientRect().top;
            top !== undefined && top > window.innerHeight * 0.75 && setup.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    if (!overview.data) {
        return (
            <PageContentBlock title='Create server'>
                {overview.isError ? <p className='srvc:text-sm srvc:text-destructive'>{httpErrorToHuman(overview.error)}</p> : <Spinner centered size={Spinner.Size.LARGE} />}
            </PageContentBlock>
        );
    }

    const { remaining, limits } = overview.data.quota;
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
                        <div className='srvc:grid srvc:grid-cols-2 srvc:gap-3 srvc:sm:gap-4 srvc:lg:grid-cols-4'>
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
                                        className={`srvc:flex srvc:min-w-0 srvc:flex-col srvc:gap-2 srvc:rounded-sm srvc:border-2 srvc:bg-card srvc:p-2 srvc:text-left srvc:sm:gap-3 srvc:sm:p-3 srvc:transition-colors srvc:disabled:cursor-not-allowed srvc:disabled:opacity-50 ${selected ? 'srvc:border-primary' : 'srvc:border-transparent srvc:enabled:hover:border-border'}`}
                                    >
                                        <Artwork src={item.artwork} name={item.name} />
                                        <div className='srvc:min-w-0'>
                                            <p className='srvc:line-clamp-2 srvc:break-words srvc:font-medium srvc:text-foreground'>{item.name}</p>
                                            <p className='srvc:line-clamp-2 srvc:text-xs srvc:text-muted-foreground'>{blocked ?? item.description ?? `${formatSize('memory', item.memory_min)} to ${formatSize('memory', item.memory_max)} memory`}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {game && (
                        <section ref={setup} className='srvc:scroll-mt-4'>
                            <h2 className='srvc:mb-3 srvc:font-header srvc:text-sm srvc:font-semibold srvc:uppercase srvc:tracking-wide srvc:text-foreground'>2. Set it up</h2>
                            <form
                                className='srvc:grid srvc:gap-6 srvc:lg:grid-cols-2'
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    valid && creation.mutate();
                                }}
                            >
                                <TitledGreyBox title='Server'>
                                    <div className='srvc:grid srvc:gap-6'>
                                        <div>
                                            <Label htmlFor='srvc-name'>Name</Label>
                                            <Input id='srvc-name' maxLength={191} value={name} onChange={(event) => setName(event.currentTarget.value)} />
                                        </div>
                                        {SIZED.map(({ key, label }) => {
                                            const { min, max } = range(game, remaining, key);

                                            return (
                                                <ResourceSlider
                                                    key={`${game.id}-${key}`}
                                                    id={`srvc-${key}`}
                                                    resource={key}
                                                    label={label}
                                                    value={sizes[key]}
                                                    min={min}
                                                    max={max}
                                                    onChange={(value) => setSizes((current) => ({ ...current, [key]: value }))}
                                                    quota={{ available: remaining[key], limit: limits[key] }}
                                                    suggest
                                                />
                                            );
                                        })}
                                    </div>
                                </TitledGreyBox>
                                <TitledGreyBox title='Settings' className='srvc:flex srvc:flex-col' contentClassName='srvc:flex srvc:flex-1 srvc:flex-col srvc:gap-6'>
                                    <div className='srvc:grid srvc:gap-4'>
                                        {(game.variables ?? []).length === 0 && <p className='srvc:text-sm srvc:text-muted-foreground'>Nothing to set up. You can change startup settings later.</p>}
                                        {(game.variables ?? []).map((variable) => (
                                            <div key={variable.key}>
                                                <Label htmlFor={`srvc-var-${variable.key}`}>
                                                    {variable.name}
                                                    {variable.required && ' *'}
                                                </Label>
                                                <Input id={`srvc-var-${variable.key}`} value={environment[variable.key] ?? ''} onChange={(event) => setEnvironment({ ...environment, [variable.key]: event.currentTarget.value })} />
                                                {variable.description && <p className='srvc:mt-1 srvc:text-xs srvc:break-words srvc:text-muted-foreground'>{variable.description}</p>}
                                            </div>
                                        ))}
                                    </div>
                                    <div className='srvc:mt-auto srvc:flex srvc:justify-end'>
                                        <Button type='submit' className='srvc:w-full srvc:sm:w-auto' disabled={!valid} isLoading={creation.isPending}>
                                            Create server
                                        </Button>
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
