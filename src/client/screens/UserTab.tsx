import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, PanelLink, Spinner, TitledGreyBox, httpErrorToHuman, toast, useCurrentResource } from '@pterodactyl/sdk';
import { getAdminUser, keys, resetUserQuota, saveUserQuota, type AdminUser, type Limits, type Resource } from '../api';
import QuotaFields from '../components/QuotaFields';
import { LABELS, formatResource } from '../lib/format';

/** Quota and self-created servers of one user, on the admin user page. */
export default function UserTab() {
    const context = useCurrentResource();
    const id = context?.kind === 'admin.user' ? context.resource.attributes.id : 0;
    const queryClient = useQueryClient();
    const data = useQuery({ queryKey: keys.user(id), queryFn: () => getAdminUser(id), enabled: id > 0 });
    const [limits, setLimits] = useState<Limits | null>(null);

    useEffect(() => data.data && setLimits(data.data.custom ?? data.data.quota.limits), [data.data]);

    const update = (result: AdminUser) => {
        queryClient.setQueryData(keys.user(id), result);
        queryClient.invalidateQueries({ queryKey: keys.admin });
    };
    const onError = (error: unknown) => toast.error(httpErrorToHuman(error));
    const saving = useMutation({ mutationFn: () => saveUserQuota(id, limits!), onSuccess: (result) => (update(result), toast.success('Quota saved.')), onError });
    const resetting = useMutation({ mutationFn: () => resetUserQuota(id), onSuccess: (result) => (update(result), toast.success('This user uses the default quota again.')), onError });

    if (!data.data || !limits) {
        return data.isError ? <p className='srvc:text-sm srvc:text-destructive'>{httpErrorToHuman(data.error)}</p> : <Spinner centered size={Spinner.Size.LARGE} />;
    }

    const { quota } = data.data;

    return (
        <div className='srvc:grid srvc:items-start srvc:gap-6 srvc:lg:grid-cols-3'>
            <div className='srvc:lg:col-span-2'>
                <TitledGreyBox title='Quota'>
                    <p className='srvc:mb-4 srvc:text-sm srvc:text-muted-foreground'>{data.data.custom ? 'This user has their own quota.' : 'This user has the default quota. Saving gives them their own.'}</p>
                    <QuotaFields prefix='srvc-user' value={limits} onChange={setLimits} />
                    <div className='srvc:mt-4 srvc:flex srvc:justify-end srvc:gap-2'>
                        {data.data.custom && (
                            <Button.Text size='small' isLoading={resetting.isPending} onClick={() => resetting.mutate()}>
                                Use default
                            </Button.Text>
                        )}
                        <Button size='small' isLoading={saving.isPending} onClick={() => saving.mutate()}>
                            Save
                        </Button>
                    </div>
                </TitledGreyBox>
            </div>
            <TitledGreyBox title='In use'>
                <div className='srvc:grid srvc:gap-2 srvc:text-sm'>
                    {(Object.keys(LABELS) as Resource[]).map((resource) => (
                        <div key={resource} className='srvc:flex srvc:justify-between srvc:gap-3'>
                            <span className='srvc:text-muted-foreground'>{LABELS[resource]}</span>
                            <span className='srvc:text-foreground'>
                                {formatResource(resource, quota.used[resource])} of {formatResource(resource, quota.limits[resource])}
                            </span>
                        </div>
                    ))}
                </div>
                {data.data.servers.length > 0 && (
                    <ul className='srvc:mt-4 srvc:grid srvc:gap-1 srvc:border-t srvc:border-border srvc:pt-4 srvc:text-sm'>
                        {data.data.servers.map((server) => (
                            <li key={server.id} className='srvc:flex srvc:justify-between srvc:gap-3'>
                                <PanelLink destination={{ to: '/panel/servers/$id', params: { id: String(server.id) } }} className='srvc:truncate srvc:text-foreground srvc:hover:underline'>
                                    {server.name}
                                </PanelLink>
                                <span className='srvc:shrink-0 srvc:text-muted-foreground'>{server.game}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </TitledGreyBox>
        </div>
    );
}
