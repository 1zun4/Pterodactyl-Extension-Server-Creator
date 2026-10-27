import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Dialog, Switch, TitledGreyBox, httpErrorToHuman, invalidateServerData, toast, useServerResources } from '@pterodactyl/sdk';
import { keys, switchGame, type Game, type OwnedServer } from '../api';
import { SIZED, range, shortfall } from '../lib/games';
import { clamp, type Sized } from '../lib/resources';
import Artwork from './Artwork';
import ResourceSlider from './ResourceSlider';

interface Props {
    identifier: string;
    uuid: string;
    data: OwnedServer;
}

export default function GameBox({ identifier, uuid, data }: Props) {
    const [open, setOpen] = useState(false);
    const state = useServerResources(uuid, (resources) => resources.attributes.current_state).data;
    const stopped = state === 'offline' || state === 'stopped';
    const games = data.games ?? [];

    return (
        <TitledGreyBox title='Game'>
            <div className='srvc:flex srvc:flex-col srvc:gap-4 srvc:sm:flex-row srvc:sm:items-center'>
                <Artwork src={data.artwork ?? null} name={data.game ?? 'No game'} className='srvc:w-full srvc:shrink-0 srvc:sm:w-40' />
                <div className='srvc:min-w-0 srvc:flex-1'>
                    <p className='srvc:font-medium srvc:text-foreground'>{data.game ?? 'No game'}</p>
                    <p className='srvc:mt-1 srvc:text-sm srvc:text-muted-foreground'>
                        {data.allow_switch && games.length > 0 ? 'Switch to another game. The server takes on its egg, limits and ports.' : 'The game this server was created for.'}
                    </p>
                </div>
            </div>
            {data.allow_switch && games.length > 0 && (
                <div className='srvc:mt-4 srvc:flex srvc:flex-col srvc:items-end srvc:gap-2'>
                    <Button size='small' className='srvc:w-full srvc:sm:w-auto' disabled={!stopped} onClick={() => setOpen(true)}>
                        Switch game
                    </Button>
                    {!stopped && <p className='srvc:text-xs srvc:text-warning'>Stop the server to switch its game.</p>}
                </div>
            )}
            {open && <SwitchDialog identifier={identifier} data={data} games={games} onClose={() => setOpen(false)} />}
        </TitledGreyBox>
    );
}

function SwitchDialog({ identifier, data, games, onClose }: { identifier: string; data: OwnedServer; games: Game[]; onClose: () => void }) {
    const queryClient = useQueryClient();
    const remaining = data.remaining!;
    const [game, setGame] = useState<Game | null>(null);
    const [sizes, setSizes] = useState<Record<Sized, number>>({ memory: 0, disk: 0, cpu: 0 });
    const [keepVariables, setKeepVariables] = useState(true);
    const [reinstall, setReinstall] = useState(true);

    const switching = useMutation({
        mutationFn: () => switchGame(identifier, { game: game!.id, ...sizes, keep_variables: keepVariables, reinstall }),
        onSuccess: (fresh) => {
            queryClient.setQueryData(keys.server(identifier), fresh);
            invalidateServerData(identifier, ['server', 'startup']);
            toast.success(reinstall ? `Switched to ${game!.name}. The server is reinstalling.` : `Switched to ${game!.name}.`);
            onClose();
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    const pick = (picked: Game) => {
        setGame(picked);
        setSizes(Object.fromEntries(SIZED.map(({ key }) => [key, clamp(data.current![key], range(picked, remaining, key).min, range(picked, remaining, key).max)])) as Record<Sized, number>);
    };

    const valid = game !== null && SIZED.every(({ key }) => sizes[key] >= range(game, remaining, key).min && sizes[key] <= range(game, remaining, key).max);

    return (
        <Dialog open onClose={onClose} title='Switch game' preventExternalClose={switching.isPending}>
            <div className='srvc:grid srvc:gap-5'>
                <div className='srvc:grid srvc:grid-cols-2 srvc:gap-2 srvc:sm:grid-cols-4'>
                    {games.map((item) => {
                        const blocked = shortfall(item, remaining);
                        const selected = game?.id === item.id;

                        return (
                            <button
                                key={item.id}
                                type='button'
                                disabled={blocked !== null}
                                aria-pressed={selected}
                                onClick={() => pick(item)}
                                className={`srvc:flex srvc:min-w-0 srvc:flex-col srvc:gap-1.5 srvc:rounded-sm srvc:border-2 srvc:bg-card srvc:p-1.5 srvc:text-left srvc:transition-colors srvc:disabled:cursor-not-allowed srvc:disabled:opacity-50 ${selected ? 'srvc:border-primary' : 'srvc:border-transparent srvc:enabled:hover:border-border'}`}
                            >
                                <Artwork src={item.artwork} name={item.name} />
                                <span className='srvc:line-clamp-1 srvc:break-words srvc:text-sm srvc:font-medium srvc:text-foreground'>{item.name}</span>
                                {blocked && <span className='srvc:line-clamp-1 srvc:text-xs srvc:text-muted-foreground'>{blocked}</span>}
                            </button>
                        );
                    })}
                </div>
                {game && (
                    <>
                        <div className='srvc:grid srvc:gap-6'>
                            {SIZED.map(({ key, label }) => {
                                const { min, max } = range(game, remaining, key);

                                return (
                                    <ResourceSlider
                                        key={`${game.id}-${key}`}
                                        id={`srvc-switch-${key}`}
                                        resource={key}
                                        label={label}
                                        value={sizes[key]}
                                        min={min}
                                        max={max}
                                        onChange={(value) => setSizes((current) => ({ ...current, [key]: value }))}
                                        quota={data.quota?.[key]}
                                        suggest
                                    />
                                );
                            })}
                        </div>
                        <div className='srvc:grid srvc:gap-3'>
                            <Switch label='Keep variable values' description='Values the new egg still accepts are kept; everything else goes back to its default.' checked={keepVariables} onChange={setKeepVariables} />
                            <label className='srvc:flex srvc:items-center srvc:gap-2 srvc:text-sm'>
                                <Checkbox checked={reinstall} onChange={setReinstall} />
                                Reinstall afterwards, so the new game installs its files
                            </label>
                        </div>
                        <p className='srvc:text-xs srvc:text-muted-foreground'>
                            The startup command and Docker image are reset for {game.name}.
                            {(game.port_range || game.ports > 1) &&
                                ` The server moves to ${game.ports > 1 ? `${game.ports} free ports in a row` : 'a free port'}${game.port_range ? ` in ${game.port_range}` : ''} unless its own already fit.`}
                            {reinstall && ' The install script runs afterwards and can overwrite files.'}
                        </p>
                    </>
                )}
            </div>
            <Dialog.Footer>
                <Button.Text className='srvc:w-full srvc:sm:w-auto' disabled={switching.isPending} onClick={onClose}>
                    Cancel
                </Button.Text>
                <Button className='srvc:w-full srvc:sm:w-auto' disabled={!valid} isLoading={switching.isPending} onClick={() => switching.mutate()}>
                    Switch game
                </Button>
            </Dialog.Footer>
        </Dialog>
    );
}
