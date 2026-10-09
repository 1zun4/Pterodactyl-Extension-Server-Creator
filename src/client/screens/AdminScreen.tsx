import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, PageContentBlock, PanelLink, Select, Spinner, TitledGreyBox, httpErrorToHuman, toast, usePanelNavigate } from '@pterodactyl/sdk';
import { deleteGame, getAdmin, keys, saveDefaultQuota, saveGame, saveLocations, type Admin, type Game, type GameInput, type Limits } from '../api';
import Artwork from '../components/Artwork';
import GameDialog from '../components/GameDialog';
import QuotaFields from '../components/QuotaFields';
import UserSelect from '../components/UserSelect';
import { formatMiB } from '../lib/format';

export default function AdminScreen() {
    const queryClient = useQueryClient();
    const navigate = usePanelNavigate();
    const data = useQuery({ queryKey: keys.admin, queryFn: getAdmin });
    const [editing, setEditing] = useState<Game | 'new' | null>(null);
    const [removing, setRemoving] = useState<Game | null>(null);
    const [quota, setQuota] = useState<Limits | null>(null);
    const [locations, setLocations] = useState<number[]>([]);

    useEffect(() => {
        if (data.data) {
            setQuota(data.data.quota);
            setLocations(data.data.locations.selected);
        }
    }, [data.data]);

    const update = (result: Admin) => queryClient.setQueryData(keys.admin, result);
    const onError = (error: unknown) => toast.error(httpErrorToHuman(error));

    const saving = useMutation({ mutationFn: (input: GameInput) => saveGame(input, editing && editing !== 'new' ? editing.id : undefined), onSuccess: (result) => (update(result), setEditing(null)), onError });
    const removal = useMutation({ mutationFn: (id: number) => deleteGame(id), onSuccess: (result) => (update(result), setRemoving(null)), onError });
    const quotaSaving = useMutation({ mutationFn: () => saveDefaultQuota(quota!), onSuccess: (result) => (update(result), toast.success('Default quota saved.')), onError });
    const locationSaving = useMutation({ mutationFn: () => saveLocations(locations), onSuccess: (result) => (update(result), toast.success('Locations saved.')), onError });

    return (
        <PageContentBlock title='Server Creator'>
            <header className='srvc:mb-6 srvc:flex srvc:flex-col srvc:gap-3 srvc:sm:flex-row srvc:sm:items-center srvc:sm:justify-between'>
                <div className='srvc:min-w-0'>
                    <h1 className='srvc:font-header srvc:text-2xl srvc:font-semibold srvc:text-foreground'>Server Creator</h1>
                    <p className='srvc:mt-1 srvc:text-sm srvc:leading-relaxed srvc:text-foreground/70'>Games users can create servers from, and how much they may use.</p>
                </div>
                <Button className='srvc:shrink-0' disabled={!data.data?.eggs.length} onClick={() => setEditing('new')}>
                    Add game
                </Button>
            </header>

            {!data.data || !quota ? (
                data.isError ? <p className='srvc:text-sm srvc:text-destructive'>{httpErrorToHuman(data.error)}</p> : <Spinner centered size={Spinner.Size.LARGE} />
            ) : (
                <div className='srvc:grid srvc:gap-6'>
                    {data.data.games.length === 0 ? (
                        <p className='srvc:py-8 srvc:text-center srvc:text-sm srvc:text-muted-foreground'>No games yet. Add one so users have something to pick.</p>
                    ) : (
                        <div className='srvc:grid srvc:grid-cols-1 srvc:gap-4 srvc:sm:grid-cols-2 srvc:lg:grid-cols-4'>
                            {data.data.games.map((game) => (
                                <div key={game.id} className={`srvc:flex srvc:flex-col srvc:gap-3 srvc:rounded-sm srvc:bg-card srvc:p-3 ${game.enabled ? '' : 'srvc:opacity-60'}`}>
                                    <Artwork src={game.artwork} name={game.name} />
                                    <div className='srvc:min-w-0 srvc:flex-1'>
                                        <p className='srvc:truncate srvc:font-medium srvc:text-foreground'>{game.name}</p>
                                        <p className='srvc:truncate srvc:text-xs srvc:text-muted-foreground'>
                                            {game.enabled ? game.egg : `Hidden · ${game.egg}`}
                                        </p>
                                        <p className='srvc:mt-1 srvc:text-xs srvc:text-muted-foreground'>
                                            {formatMiB(game.memory_min)}–{formatMiB(game.memory_max)} memory · {formatMiB(game.disk_min)}–{formatMiB(game.disk_max)} disk
                                        </p>
                                    </div>
                                    <div className='srvc:flex srvc:justify-end srvc:gap-2'>
                                        <Button.Text size='xsmall' onClick={() => setEditing(game)}>
                                            Edit
                                        </Button.Text>
                                        <Button.Danger size='xsmall' onClick={() => setRemoving(game)}>
                                            Delete
                                        </Button.Danger>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className='srvc:grid srvc:items-start srvc:gap-6 srvc:lg:grid-cols-2'>
                        <TitledGreyBox title='Default quota'>
                            <p className='srvc:mb-4 srvc:text-sm srvc:text-muted-foreground'>For everyone without a quota of their own. With 0 servers, users cannot create any.</p>
                            <QuotaFields prefix='srvc-default' value={quota} onChange={setQuota} />
                            <div className='srvc:mt-4 srvc:flex srvc:justify-end'>
                                <Button size='small' isLoading={quotaSaving.isPending} onClick={() => quotaSaving.mutate()}>
                                    Save
                                </Button>
                            </div>
                        </TitledGreyBox>
                        <div className='srvc:grid srvc:gap-6'>
                            <TitledGreyBox title='Users with their own quota'>
                                {data.data.users.length === 0 ? (
                                    <p className='srvc:mb-4 srvc:text-sm srvc:text-muted-foreground'>Nobody yet.</p>
                                ) : (
                                    <ul className='srvc:mb-4 srvc:grid srvc:gap-2'>
                                        {data.data.users.map((user) => (
                                            <li key={user.id} className='srvc:flex srvc:items-center srvc:justify-between srvc:gap-3 srvc:text-sm'>
                                                <PanelLink destination={{ extension: 'server-creator', screen: 'user-tab', params: { id: String(user.id) } }} className='srvc:truncate srvc:text-foreground srvc:hover:underline'>
                                                    {user.username}
                                                </PanelLink>
                                                <span className='srvc:shrink-0 srvc:text-muted-foreground'>
                                                    {user.limits.servers} servers · {formatMiB(user.limits.memory)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <UserSelect id='srvc-add-user' value={null} placeholder='Give a user their own quota' onChange={(user) => navigate({ extension: 'server-creator', screen: 'user-tab', params: { id: String(user.id) } })} />
                            </TitledGreyBox>
                            <TitledGreyBox title='Locations'>
                                <p className='srvc:mb-4 srvc:text-sm srvc:text-muted-foreground'>New servers go to a node with room in these locations. Leave empty for all public nodes.</p>
                                <Select multiple placeholder='All locations' value={locations} onChange={(value) => setLocations(value.map(Number))} options={data.data.locations.all.map((location) => ({ value: location.id, label: location.long ? `${location.short} (${location.long})` : location.short }))} />
                                <div className='srvc:mt-4 srvc:flex srvc:justify-end'>
                                    <Button size='small' isLoading={locationSaving.isPending} onClick={() => locationSaving.mutate()}>
                                        Save
                                    </Button>
                                </div>
                            </TitledGreyBox>
                        </div>
                    </div>
                </div>
            )}

            {editing && data.data && <GameDialog game={editing === 'new' ? null : editing} eggs={data.data.eggs} pending={saving.isPending} onClose={() => setEditing(null)} onSave={(input) => saving.mutate(input)} />}
            <Dialog.Confirm open={removing !== null} onClose={() => setRemoving(null)} title={`Delete ${removing?.name}?`} confirm='Delete' pending={removal.isPending} onConfirmed={() => removing && removal.mutate(removing.id)}>
                Users can no longer pick it. Servers that were created from it keep running.
            </Dialog.Confirm>
        </PageContentBlock>
    );
}
