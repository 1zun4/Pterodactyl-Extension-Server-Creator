import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Checkbox, Dialog, Input, Label, httpErrorToHuman, toast, usePanelNavigate, type ExtensionResourceContext } from '@pterodactyl/sdk';
import { duplicateServer, getCopies, keys, type Copy } from '../api';
import UserSelect from './UserSelect';

const STEPS: Record<Copy['step'], string> = {
    backup: 'Starting a backup of the original',
    'backing-up': 'Backing up the original',
    restore: 'Waiting for the copy to finish installing',
    restoring: 'Restoring the backup into the copy',
    cleanup: 'Deleting the temporary backup',
    done: 'Files copied',
    failed: 'Copying files failed',
};

/** "Duplicate" on the admin server page, plus the progress of file copies from or to this server. */
export default function DuplicateButton({ data }: { data: ExtensionResourceContext }) {
    const navigate = usePanelNavigate();
    const server = data.kind === 'admin.server' ? data.resource.attributes : null;
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [owner, setOwner] = useState<number | null>(null);
    const [files, setFiles] = useState(true);

    const copies = useQuery({
        queryKey: keys.copies(server?.id ?? 0),
        queryFn: () => getCopies(server!.id),
        enabled: server !== null,
        refetchInterval: (query) => (query.state.data?.some((copy) => !['done', 'failed'].includes(copy.step)) ? 5000 : false),
    });

    const duplication = useMutation({
        mutationFn: () => duplicateServer(server!.id, { name: name.trim(), owner: owner ?? server!.user, files }),
        onSuccess: ({ id }) => {
            toast.success(files ? 'Server duplicated. Its files are copied in the background.' : 'Server duplicated.');
            setOpen(false);
            navigate({ to: '/panel/servers/$id', params: { id: String(id) } });
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    if (!server) {
        return null;
    }

    const active = (copies.data ?? []).filter((copy) => !['done'].includes(copy.step) && Date.now() - new Date(copy.created_at).getTime() < 86_400_000);

    return (
        <div className='srvc:mb-4 srvc:flex srvc:flex-col srvc:gap-3'>
            <div className='srvc:flex srvc:justify-end'>
                <Button.Text
                    size='small'
                    onClick={() => {
                        setName(`${server.name} (copy)`);
                        setOwner(server.user);
                        setOpen(true);
                    }}
                >
                    Duplicate
                </Button.Text>
            </div>
            {active.map((copy) => (
                <p key={copy.id} className={`srvc:rounded-sm srvc:border srvc:px-4 srvc:py-2 srvc:text-sm ${copy.step === 'failed' ? 'srvc:border-destructive/25 srvc:bg-destructive/10 srvc:text-destructive' : 'srvc:border-border srvc:bg-card srvc:text-muted-foreground'}`}>
                    {copy.target.id === server.id ? `Copying files from ${copy.source}` : `Copying files to ${copy.target.name}`}: {STEPS[copy.step]}
                    {copy.error ? `. ${copy.error}` : copy.step === 'failed' ? '.' : '…'}
                </p>
            ))}
            <Dialog open={open} onClose={() => setOpen(false)} title={`Duplicate ${server.name}`} preventExternalClose={duplication.isPending}>
                <div className='srvc:grid srvc:gap-4'>
                    <p className='srvc:text-sm srvc:text-muted-foreground'>Creates a server with the same egg, startup, variables and limits on the same node, with a new port.</p>
                    <div>
                        <Label htmlFor='srvc-copy-name'>Name</Label>
                        <Input id='srvc-copy-name' value={name} maxLength={191} onChange={(event) => setName(event.currentTarget.value)} />
                    </div>
                    <div>
                        <Label htmlFor='srvc-copy-owner'>Owner</Label>
                        <UserSelect id='srvc-copy-owner' value={owner} fallback={{ id: server.user, label: 'Current owner' }} onChange={(user) => setOwner(user.id)} />
                    </div>
                    <label className='srvc:flex srvc:items-center srvc:gap-2 srvc:text-sm srvc:text-foreground'>
                        <Checkbox checked={files} onChange={setFiles} />
                        Copy files
                    </label>
                    {files && <p className='srvc:-mt-2 srvc:text-xs srvc:text-muted-foreground'>Takes a backup of this server and restores it into the copy. The backup is deleted afterwards.</p>}
                </div>
                <Dialog.Footer>
                    <Button.Text className='srvc:w-full srvc:sm:w-auto' disabled={duplication.isPending} onClick={() => setOpen(false)}>
                        Cancel
                    </Button.Text>
                    <Button className='srvc:w-full srvc:sm:w-auto' disabled={name.trim() === ''} isLoading={duplication.isPending} onClick={() => duplication.mutate()}>
                        Duplicate
                    </Button>
                </Dialog.Footer>
            </Dialog>
        </div>
    );
}
