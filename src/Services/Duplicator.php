<?php

declare(strict_types=1);

namespace ServerCreator\Services;

use Pterodactyl\Exceptions\Service\Deployment\NoViableAllocationException;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use ServerCreator\Exceptions\CreatorException;
use ServerCreator\Jobs\CopyFiles;
use ServerCreator\Models\Copy;
use ServerCreator\Panel\Panel;

/**
 * Creates a server with the same egg, startup, variables and limits on the same node.
 */
final readonly class Duplicator
{
    public function __construct(private Panel $panel) {}

    public function duplicate(Server $source, User $admin, string $name, User $owner, bool $copyFiles): Server
    {
        try {
            $allocation = $this->panel->freeAllocation($source->node);
        } catch (NoViableAllocationException) {
            throw new CreatorException("{$source->node->name} has no free port left.");
        }

        $environment = $source->variables()->get()
            ->mapWithKeys(static fn ($variable): array => [$variable->env_variable => (string) ($variable->server_value ?? $variable->default_value ?? '')])
            ->all();

        $server = $this->panel->create([
            'name' => $name,
            'description' => (string) $source->description,
            'owner_id' => $owner->id,
            'egg_id' => $source->egg_id,
            'image' => $source->image,
            'startup' => $source->startup,
            'environment' => $environment,
            'memory' => $source->memory,
            'swap' => $source->swap,
            'disk' => $source->disk,
            'io' => $source->io,
            'cpu' => $source->cpu,
            'threads' => $source->threads,
            'oom_disabled' => $source->oom_disabled,
            'skip_scripts' => $source->skip_scripts,
            'start_on_completion' => false,
            'database_limit' => $source->database_limit,
            'allocation_limit' => $source->allocation_limit,
            'backup_limit' => $source->backup_limit,
        ], allocation: $allocation);

        if ($copyFiles) {
            $copy = Copy::query()->create(['source_id' => $source->id, 'target_id' => $server->id, 'user_id' => $admin->id, 'step' => 'backup']);
            CopyFiles::dispatch($copy->id);
        }

        return $server;
    }
}
