import { useQuery } from '@tanstack/react-query';
import { Button, usePanelNavigate } from '@pterodactyl/sdk';
import { getOverview, keys } from '../api';
import { remainingText } from '../lib/format';

/** Shown above the server list for users who may create servers. */
export default function CreateBanner() {
    const navigate = usePanelNavigate();
    const overview = useQuery({ queryKey: keys.overview, queryFn: getOverview, staleTime: 30_000, retry: false });

    if (!overview.data || overview.data.quota.limits.servers < 1 || overview.data.games.length === 0) {
        return null;
    }

    return (
        <div className='srvc:mb-4 srvc:flex srvc:flex-col srvc:gap-3 srvc:rounded-sm srvc:border srvc:border-border srvc:bg-card srvc:px-4 srvc:py-3 srvc:sm:flex-row srvc:sm:items-center srvc:sm:justify-between'>
            <p className='srvc:text-sm srvc:text-muted-foreground'>{remainingText(overview.data.quota.remaining)}</p>
            {overview.data.quota.remaining.servers > 0 && (
                <Button size='small' className='srvc:shrink-0' onClick={() => navigate({ extension: 'server-creator', screen: 'create' })}>
                    Create server
                </Button>
            )}
        </div>
    );
}
