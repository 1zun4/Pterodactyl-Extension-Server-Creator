import './styles.css';
import { useQuery } from '@tanstack/react-query';
import { definePterodactylExtension, usePanelLocation, type ScreenContext } from '@pterodactyl/sdk';
import { getOwnedServer, keys } from './api';
import CreateBanner from './components/CreateBanner';
import DuplicateButton from './components/DuplicateButton';

/** Listed for servers the user created here while any of resize, switch or delete is allowed. */
function useResourcesScreen(context: ScreenContext) {
    const identifier = context.server?.attributes.identifier ?? '';
    const { pathname, params } = usePanelLocation();
    const owned = useQuery({ queryKey: keys.server(identifier), queryFn: () => getOwnedServer(identifier), enabled: identifier !== '', retry: false, staleTime: 30_000 });
    const data = owned.data;

    // Keep the screen routable while the answer loads, so opening its URL directly does not bounce.
    return Boolean(data?.owned && (data.allow_resize || data.allow_switch || data.allow_delete)) || (owned.isPending && pathname.replace(/\/$/, '') === `/server/${params.id ?? identifier}/resources`);
}

export default definePterodactylExtension({
    setup({ screens, slots }) {
        screens.register('create', () => import('./screens/CreateScreen'));
        screens.register('admin', () => import('./screens/AdminScreen'));
        screens.register('user-tab', () => import('./screens/UserTab'));
        screens.register('resources', () => import('./screens/ResourcesScreen'), { visible: useResourcesScreen });
        slots.register('dashboard.before', CreateBanner);
        slots.register('panel.servers.detail.actions', DuplicateButton);
    },
});
