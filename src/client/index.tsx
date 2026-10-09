import './styles.css';
import { definePterodactylExtension } from '@pterodactyl/sdk';
import CreateBanner from './components/CreateBanner';
import DuplicateButton from './components/DuplicateButton';
import ResourcesBox from './components/ResourcesBox';

export default definePterodactylExtension({
    setup({ screens, slots }) {
        screens.register('create', () => import('./screens/CreateScreen'));
        screens.register('admin', () => import('./screens/AdminScreen'));
        screens.register('user-tab', () => import('./screens/UserTab'));
        slots.register('dashboard.before', CreateBanner);
        slots.register('server.settings.before', ResourcesBox);
        slots.register('panel.servers.detail.actions', DuplicateButton);
    },
});
