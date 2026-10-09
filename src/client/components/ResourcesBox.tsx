import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, Input, Label, TitledGreyBox, httpErrorToHuman, invalidateServerData, toast, useCurrentServerRequired, usePanelNavigate } from '@pterodactyl/sdk';
import { deleteServer, getOwnedServer, keys, resizeServer } from '../api';
import { formatResource } from '../lib/format';

const SIZED = [
    { key: 'memory', label: 'Memory (MiB)' },
    { key: 'disk', label: 'Disk (MiB)' },
    { key: 'cpu', label: 'CPU (%)' },
] as const;

/** Resize and delete on the Settings page, for servers the user created themselves. */
export default function ResourcesBox() {
    const server = useCurrentServerRequired().attributes;
    const queryClient = useQueryClient();
    const navigate = usePanelNavigate();
    const owned = useQuery({ queryKey: keys.server(server.identifier), queryFn: () => getOwnedServer(server.identifier), retry: false });
    const [sizes, setSizes] = useState({ memory: 0, disk: 0, cpu: 0 });
    const [deleting, setDeleting] = useState(false);
    const [confirm, setConfirm] = useState('');

    useEffect(() => owned.data?.current && setSizes(owned.data.current), [owned.data]);

    const resizing = useMutation({
        mutationFn: () => resizeServer(server.identifier, sizes),
        onSuccess: (data) => {
            queryClient.setQueryData(keys.server(server.identifier), data);
            invalidateServerData(server.identifier, ['server']);
            toast.success('Resources saved. Restart the server to apply them.');
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });
    const removal = useMutation({
        mutationFn: () => deleteServer(server.identifier, confirm),
        onSuccess: () => {
            toast.success(`${server.name} was deleted.`);
            queryClient.invalidateQueries({ queryKey: keys.overview });
            navigate({ to: '/' });
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    const data = owned.data;

    if (!data?.owned || (!data.allow_resize && !data.allow_delete) || !data.limits || !data.current) {
        return null;
    }

    const changed = SIZED.some(({ key }) => sizes[key] !== data.current![key]);
    const valid = SIZED.every(({ key }) => sizes[key] >= data.limits![key].min && sizes[key] <= data.limits![key].max);

    return (
        <div className='srvc:mx-4 srvc:mt-4 srvc:grid srvc:max-w-panel srvc:gap-6 srvc:sm:mt-6 srvc:xl:mx-auto srvc:lg:grid-cols-2'>
            {data.allow_resize && (
                <TitledGreyBox title='Resources'>
                    <div className='srvc:grid srvc:gap-4 srvc:sm:grid-cols-3'>
                        {SIZED.map(({ key, label }) => (
                            <div key={key}>
                                <Label htmlFor={`srvc-${key}`}>{label}</Label>
                                <Input id={`srvc-${key}`} type='number' min={data.limits![key].min} max={data.limits![key].max} value={sizes[key]} onChange={(event) => setSizes({ ...sizes, [key]: Number(event.currentTarget.value) })} />
                                <p className='srvc:mt-1 srvc:text-xs srvc:text-muted-foreground'>Up to {formatResource(key, data.limits![key].max)}</p>
                            </div>
                        ))}
                    </div>
                    <div className='srvc:mt-4 srvc:flex srvc:justify-end'>
                        <Button size='small' disabled={!changed || !valid} isLoading={resizing.isPending} onClick={() => resizing.mutate()}>
                            Save
                        </Button>
                    </div>
                </TitledGreyBox>
            )}
            {data.allow_delete && (
                <TitledGreyBox title='Delete server'>
                    <p className='srvc:text-sm srvc:text-muted-foreground'>Deletes the server with all its files, backups and databases. This cannot be undone.</p>
                    <div className='srvc:mt-4 srvc:flex srvc:justify-end'>
                        <Button.Danger size='small' onClick={() => setDeleting(true)}>
                            Delete server
                        </Button.Danger>
                    </div>
                </TitledGreyBox>
            )}
            <Dialog open={deleting} onClose={() => setDeleting(false)} title={`Delete ${server.name}?`} preventExternalClose={removal.isPending}>
                <p className='srvc:mb-4 srvc:text-sm srvc:text-muted-foreground'>All files, backups and databases of this server are deleted. Type the server name to confirm.</p>
                <Input aria-label='Server name' placeholder={server.name} value={confirm} onChange={(event) => setConfirm(event.currentTarget.value)} />
                <Dialog.Footer>
                    <Button.Text className='srvc:w-full srvc:sm:w-auto' disabled={removal.isPending} onClick={() => setDeleting(false)}>
                        Cancel
                    </Button.Text>
                    <Button.Danger className='srvc:w-full srvc:sm:w-auto' disabled={confirm !== server.name} isLoading={removal.isPending} onClick={() => removal.mutate()}>
                        Delete forever
                    </Button.Danger>
                </Dialog.Footer>
            </Dialog>
        </div>
    );
}
