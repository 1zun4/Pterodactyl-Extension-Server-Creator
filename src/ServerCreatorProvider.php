<?php

declare(strict_types=1);

namespace ServerCreator;

use Pterodactyl\Contracts\Backups\RestoresBackupStatuses;
use Pterodactyl\Extensions\ExtensionProvider;
use Pterodactyl\Services\Extensions\ExtensionSettingDefinition;
use Pterodactyl\Services\Extensions\ExtensionSettingsDefinition;
use ServerCreator\Jobs\RestoreListener;

class ServerCreatorProvider extends ExtensionProvider
{
    public function boot(): void
    {
        $this->registerApiRoutes();
        $this->loadExtensionMigrations();

        $this->registerSettings(new ExtensionSettingsDefinition($this->settings(), [
            ExtensionSettingDefinition::make('allow_resize', 'allow_resize', true, ['boolean'])
                ->label('Users can resize their servers')
                ->help('Within their quota and the limits of the game.')
                ->field('toggle'),
            ExtensionSettingDefinition::make('allow_delete', 'allow_delete', false, ['boolean'])
                ->label('Users can delete their servers')
                ->help('Only servers they created themselves. Deleting cannot be undone.')
                ->field('toggle'),
        ]));

        $this->wrapAction(RestoresBackupStatuses::class, static fn (RestoresBackupStatuses $inner): RestoresBackupStatuses => new RestoreListener($inner));
    }
}
