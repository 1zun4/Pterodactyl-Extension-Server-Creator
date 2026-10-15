<?php

declare(strict_types=1);

namespace ServerCreator\Panel;

use Illuminate\Support\Collection;
use Pterodactyl\Contracts\Backups\DeletesBackups;
use Pterodactyl\Contracts\Backups\InitiatesBackups;
use Pterodactyl\Contracts\Backups\RestoresBackups;
use Pterodactyl\Contracts\Eggs\ImportsCatalogEggs;
use Pterodactyl\Contracts\Servers\CreatesServers;
use Pterodactyl\Contracts\Servers\DeletesServers;
use Pterodactyl\Contracts\Servers\UpdatesServerBuild;
use Pterodactyl\Exceptions\Service\Deployment\NoViableAllocationException;
use Pterodactyl\Exceptions\Service\Deployment\NoViableNodeException;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Facades\Extensions;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Objects\DeploymentObject;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use Pterodactyl\Services\Servers\VariableValidatorService;
use ServerCreator\Support\Ports;

/**
 * The only place this extension touches Panel internals.
 */
final readonly class Panel
{
    public function __construct(
        private CreatesServers $creator,
        private UpdatesServerBuild $builder,
        private DeletesServers $deleter,
        private InitiatesBackups $backups,
        private RestoresBackups $restorer,
        private DeletesBackups $backupDeleter,
        private ImportsCatalogEggs $catalog,
    ) {}

    /**
     * Validates the variables a user may edit and fills every other one with its default.
     *
     * @param  array<string, string>  $values
     * @return array<string, string>
     */
    public function environment(Egg $egg, array $values): array
    {
        $validated = app(VariableValidatorService::class)
            ->validate($egg, $values, User::USER_LEVEL_USER)
            ->filter(static fn ($variable): bool => $variable->value !== null)
            ->mapWithKeys(static fn ($variable): array => [$variable->key => (string) $variable->value]);

        return $egg->variables()->get()
            ->mapWithKeys(static fn ($variable): array => [$variable->env_variable => (string) ($variable->default_value ?? '')])
            ->merge($validated)
            ->all();
    }

    /**
     * Creates a server on a node of the given locations, or on the given allocations (the first one is the primary).
     *
     * @param  array<string, mixed>  $data
     * @param  list<int>  $locations  Empty for every location.
     * @param  list<Allocation>  $allocations
     */
    public function create(array $data, array $locations = [], array $allocations = []): Server
    {
        if ($allocations !== []) {
            return $this->creator->create($data + [
                'allocation_id' => $allocations[0]->id,
                'allocation_additional' => array_map(static fn (Allocation $allocation): int => $allocation->id, array_slice($allocations, 1)),
            ]);
        }

        return $this->creator->create($data, (new DeploymentObject())->setDedicated(false)->setLocations($locations)->setPorts([]));
    }

    public function freeAllocation(Node $node): Allocation
    {
        return Allocation::query()->unassigned()->onNodes([$node->id])->inRandomOrder()->first()
            ?? throw new NoViableAllocationException(trans('exceptions.deployment.no_viable_allocations'));
    }

    /**
     * `count` free allocations with consecutive ports on a node that the panel's own deployment would pick.
     *
     * @param  list<int>  $locations
     * @return list<Allocation>
     */
    public function allocationsInARow(Egg $egg, int $memory, int $disk, array $locations, int $count): array
    {
        $nodes = Node::query()->viableFor($memory, $disk)->inLocations($locations)->forEggTags($egg->tagSlugs())->forDeployTags([])->get()->pluck('id')->all();
        throw_if($nodes === [], NoViableNodeException::class, trans('exceptions.deployment.no_viable_nodes'));

        $free = Allocation::query()->unassigned()->onNodes($nodes)->toBase()->get(['id', 'node_id', 'ip', 'port'])
            ->map(static fn (object $row): array => ['id' => (int) $row->id, 'node' => (int) $row->node_id, 'ip' => (string) $row->ip, 'port' => (int) $row->port]);
        $runs = Ports::runs($free, $count);
        throw_if($runs === [], NoViableAllocationException::class, trans('exceptions.deployment.no_viable_allocations'));

        $ids = $runs[array_rand($runs)];
        $allocations = Allocation::query()->whereIn('id', $ids)->get()->keyBy('id');

        return array_map(static fn (int $id): Allocation => $allocations[$id], $ids);
    }

    public function importCatalogEgg(string $id): Egg
    {
        return $this->catalog->import($id);
    }

    /** Only memory, disk and CPU change. The feature limits are always written, so they are passed along unchanged. */
    public function resize(Server $server, int $memory, int $disk, int $cpu): Server
    {
        return $this->builder->update($server, [
            'memory' => $memory,
            'disk' => $disk,
            'cpu' => $cpu,
            'database_limit' => $server->database_limit,
            'allocation_limit' => $server->allocation_limit,
            'backup_limit' => $server->backup_limit,
        ]);
    }

    public function delete(Server $server): void
    {
        $this->deleter->delete($server);
    }

    public function backup(Server $server, string $name): Backup
    {
        return $this->backups->setIsLocked(false)->setIgnoredFiles([])->initiate($server, $name, true);
    }

    /** Unpacks a backup into another server. Local backups only work on the node they were taken on. */
    public function restoreInto(Server $server, Backup $backup, User $user): void
    {
        $this->restorer->restore($server, $backup, $user, true);
    }

    public function deleteBackup(Backup $backup): void
    {
        $this->backupDeleter->delete($backup);
    }

    /** @param array<string, mixed> $properties */
    public function log(string $event, Server $server, array $properties = []): void
    {
        Activity::event($event)->subject($server)->property($properties + ['via' => 'server-creator'])->log();
    }

    /** @return list<int> */
    public function locations(): array
    {
        return array_values(array_map(intval(...), (array) Extensions::settings('server-creator')->get('locations', [])));
    }

    /** @param list<int> $locations */
    public function setLocations(array $locations): void
    {
        Extensions::settings('server-creator')->set('locations', $locations);
    }

    /** @return Collection<int, Egg> */
    public function eggs(): Collection
    {
        return Egg::query()->orderBy('name')->get(['id', 'name', 'docker_images']);
    }
}
