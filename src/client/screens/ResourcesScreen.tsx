import { useQuery } from '@tanstack/react-query';
import { ServerContentBlock, Spinner, httpErrorToHuman, useCurrentServerRequired } from '@pterodactyl/sdk';
import { getOwnedServer, keys } from '../api';
import DeleteBox from '../components/DeleteBox';
import GameBox from '../components/GameBox';
import ResourcesBox from '../components/ResourcesBox';

/** Resize, switch the game and delete, for servers the user created themselves. */
export default function ResourcesScreen() {
    const { identifier, uuid, name } = useCurrentServerRequired().attributes;
    const owned = useQuery({ queryKey: keys.server(identifier), queryFn: () => getOwnedServer(identifier), retry: false });
    const data = owned.data;

    if (!data?.owned) {
        return (
            <ServerContentBlock title='Resources'>
                {owned.isPending ? (
                    <Spinner centered size={Spinner.Size.LARGE} />
                ) : (
                    <p className='srvc:text-sm srvc:text-muted-foreground'>{owned.isError ? httpErrorToHuman(owned.error) : 'Only servers you created yourself can be changed here.'}</p>
                )}
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title='Resources'>
            <div className='srvc:grid srvc:items-start srvc:gap-6 srvc:lg:grid-cols-2'>
                {data.allow_resize && <ResourcesBox identifier={identifier} data={data} />}
                <div className='srvc:grid srvc:gap-6'>
                    <GameBox identifier={identifier} uuid={uuid} data={data} />
                    {data.allow_delete && <DeleteBox identifier={identifier} name={name} />}
                </div>
            </div>
        </ServerContentBlock>
    );
}
