import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, TitledGreyBox, httpErrorToHuman, invalidateServerData, toast } from '@pterodactyl/sdk';
import { keys, resizeServer, type OwnedServer } from '../api';
import { SIZED } from '../lib/games';
import ResourceSlider from './ResourceSlider';

type Sizes = Record<(typeof SIZED)[number]['key'], number>;

/** The server's current sizes, with anything the plan pins to one value set to that value. */
function startingSizes({ current, limits }: Required<Pick<OwnedServer, 'current' | 'limits'>>): Sizes {
    return Object.fromEntries(SIZED.map(({ key }) => [key, limits[key].min === limits[key].max ? limits[key].min : current[key]])) as Sizes;
}

export default function ResourcesBox({ identifier, data }: { identifier: string; data: OwnedServer }) {
    const queryClient = useQueryClient();
    const [sizes, setSizes] = useState<Sizes>({ memory: 0, disk: 0, cpu: 0 });

    useEffect(() => {
        data.current && data.limits && setSizes(startingSizes({ current: data.current, limits: data.limits }));
    }, [data]);

    const resizing = useMutation({
        mutationFn: () => resizeServer(identifier, sizes),
        onSuccess: (fresh) => {
            queryClient.setQueryData(keys.server(identifier), fresh);
            invalidateServerData(identifier, ['server']);
            toast.success('Resources saved. Restart the server to apply them.');
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    if (!data.limits || !data.current) {
        return null;
    }

    const changed = SIZED.some(({ key }) => sizes[key] !== data.current![key]);
    const valid = SIZED.every(({ key }) => sizes[key] >= data.limits![key].min && sizes[key] <= data.limits![key].max);

    return (
        <TitledGreyBox title='Resources'>
            <div className='srvc:grid srvc:gap-6'>
                {SIZED.map(({ key, label }) => (
                    <ResourceSlider
                        key={key}
                        id={`srvc-${key}`}
                        resource={key}
                        label={label}
                        value={sizes[key]}
                        min={data.limits![key].min}
                        max={data.limits![key].max}
                        onChange={(value) => setSizes((current) => ({ ...current, [key]: value }))}
                        quota={data.quota?.[key]}
                        suggest={Boolean(data.game)}
                    />
                ))}
            </div>
            <div className='srvc:mt-6 srvc:flex srvc:justify-end'>
                <Button size='small' className='srvc:w-full srvc:sm:w-auto' disabled={!changed || !valid} isLoading={resizing.isPending} onClick={() => resizing.mutate()}>
                    Save
                </Button>
            </div>
        </TitledGreyBox>
    );
}
