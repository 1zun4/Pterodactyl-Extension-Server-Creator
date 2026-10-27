<?php

declare(strict_types=1);

namespace ServerCreator;

use Pterodactyl\Services\Extensions\ExtensionSettingsRegistry;

final readonly class Settings
{
    public function __construct(private ExtensionSettingsRegistry $registry) {}

    public function allowDelete(): bool
    {
        return (bool) ($this->registry->get('server-creator')?->get('allow_delete') ?? false);
    }

    public function allowResize(): bool
    {
        return (bool) ($this->registry->get('server-creator')?->get('allow_resize') ?? true);
    }

    public function allowSwitch(): bool
    {
        return (bool) ($this->registry->get('server-creator')?->get('allow_switch') ?? true);
    }
}
