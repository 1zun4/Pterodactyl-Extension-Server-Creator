import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, Input, TitledGreyBox, httpErrorToHuman, toast, usePanelNavigate } from '@pterodactyl/sdk';
import { deleteServer, keys } from '../api';

export default function DeleteBox({ identifier, name }: { identifier: string; name: string }) {
    const queryClient = useQueryClient();
    const navigate = usePanelNavigate();
    const [deleting, setDeleting] = useState(false);
    const [confirm, setConfirm] = useState('');

    const removal = useMutation({
        mutationFn: () => deleteServer(identifier, confirm),
        onSuccess: () => {
            toast.success(`${name} was deleted.`);
            queryClient.invalidateQueries({ queryKey: keys.overview });
            navigate({ to: '/' });
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    return (
        <TitledGreyBox title='Delete server'>
            <p className='srvc:text-sm srvc:text-muted-foreground'>Deletes the server with all its files, backups and databases. This cannot be undone.</p>
            <div className='srvc:mt-4 srvc:flex srvc:justify-end'>
                <Button.Danger size='small' onClick={() => setDeleting(true)}>
                    Delete server
                </Button.Danger>
            </div>
            <Dialog open={deleting} onClose={() => setDeleting(false)} title={`Delete ${name}?`} preventExternalClose={removal.isPending}>
                <p className='srvc:mb-4 srvc:text-sm srvc:text-muted-foreground'>All files, backups and databases of this server are deleted. Type the server name to confirm.</p>
                <Input aria-label='Server name' placeholder={name} value={confirm} onChange={(event) => setConfirm(event.currentTarget.value)} />
                <Dialog.Footer>
                    <Button.Text className='srvc:w-full srvc:sm:w-auto' disabled={removal.isPending} onClick={() => setDeleting(false)}>
                        Cancel
                    </Button.Text>
                    <Button.Danger className='srvc:w-full srvc:sm:w-auto' disabled={confirm !== name} isLoading={removal.isPending} onClick={() => removal.mutate()}>
                        Delete forever
                    </Button.Danger>
                </Dialog.Footer>
            </Dialog>
        </TitledGreyBox>
    );
}
