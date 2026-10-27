<?php

declare(strict_types=1);

namespace ServerCreator\Panel;

use Illuminate\Support\Collection;
use Pterodactyl\Contracts\Backups\DeletesBackups;
use Pterodactyl\Contracts\Backups\InitiatesBackups;
use Pterodactyl\Contracts\Backups\RestoresBackups;
use Pterodactyl\Contracts\Eggs\ImportsCatalogEggs;
use Pterodactyl\Contracts\Servers\ChangesServerEgg;
use Pterodactyl\Contracts\Servers\CreatesServers;
use Pterodactyl\Contracts\Servers\DeletesServers;
use Pterodactyl\Contracts\Servers\ReinstallsServers;
use Pterodactyl\Contracts\Servers\UpdatesServerBuild;
use Pterodactyl\Contracts\Servers\UpdatesServerDockerImage;
use Pterodactyl\Contracts\Servers\UpdatesServerVariable;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
use Pterodactyl\Exceptions\Service\Deployment\NoViableAllocationException;
use Pterodactyl\Exceptions\Service\Deployment\NoViableNodeException;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Facades\Daemon;
use Pterodactyl\Facades\Extensions;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Objects\DeploymentObject;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerVariable;
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
        private ChangesServerEgg $eggs,
        private UpdatesServerDockerImage $images,
        private UpdatesServerVariable $variables,
        private ReinstallsServers $reinstaller,
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
     * With ranges, every port of the run lies within them.
     *
     * @param  list<int>  $locations
     * @param  list<array{int, int}>  $ranges
     * @return list<Allocation>
     */
    public function allocationsInARow(Egg $egg, int $memory, int $disk, array $locations, int $count, array $ranges = []): array
    {
        $nodes = Node::query()->viableFor($memory, $disk)->inLocations($locations)->forEggTags($egg->tagSlugs())->forDeployTags([])->get()->pluck('id')->all();
        throw_if($nodes === [], NoViableNodeException::class, trans('exceptions.deployment.no_viable_nodes'));

        $free = Allocation::query()->unassigned()->onNodes($nodes)->onPorts([], $ranges)->toBase()->get(['id', 'node_id', 'ip', 'port'])
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

    /**
     * Memory, disk and CPU change, and the feature limits when given. The feature limits are always written,
     * so the current ones are passed along otherwise.
     *
     * @param  array{databases: int, allocations: int, backups: int}|null  $limits
     */
    public function resize(Server $server, int $memory, int $disk, int $cpu, ?array $limits = null): Server
    {
        return $this->builder->update($server, [
            'memory' => $memory,
            'disk' => $disk,
            'cpu' => $cpu,
            'database_limit' => $limits['databases'] ?? $server->database_limit,
            'allocation_limit' => $limits['allocations'] ?? $server->allocation_limit,
            'backup_limit' => $limits['backups'] ?? $server->backup_limit,
        ]);
    }

    /** An unreachable node counts as running. */
    public function isStopped(Server $server): bool
    {
        try {
            return in_array(Daemon::server($server)->details()['state'] ?? 'offline', ['offline', 'stopped'], true);
        } catch (DaemonConnectionException) {
            return false;
        }
    }

    public function changeEgg(Server $server, Egg $egg, bool $keepVariables): Server
    {
        return $this->eggs->change($server, $egg, $keepVariables);
    }

    public function setImage(Server $server, string $image): Server
    {
        return $this->images->update($server, $image);
    }

    public function reinstall(Server $server): void
    {
        $this->reinstaller->reinstall($server);
    }

    /** @return list<array{id: int, ip: string, port: int}> */
    public function allocationsOf(Server $server): array
    {
        return Allocation::query()->where('server_id', $server->id)->toBase()->get(['id', 'ip', 'port'])
            ->map(static fn (object $row): array => ['id' => (int) $row->id, 'ip' => (string) $row->ip, 'port' => (int) $row->port])
            ->all();
    }

    /**
     * `count` free allocations with consecutive ports within the ranges, on the server's own node.
     *
     * @param  list<array{int, int}>  $ranges
     * @return list<Allocation>
     */
    public function freeRunOnNode(Server $server, int $count, array $ranges): array
    {
        $free = Allocation::query()->unassigned()->onNodes([$server->node_id])->onPorts([], $ranges)->toBase()->get(['id', 'node_id', 'ip', 'port'])
            ->map(static fn (object $row): array => ['id' => (int) $row->id, 'node' => (int) $row->node_id, 'ip' => (string) $row->ip, 'port' => (int) $row->port]);
        $runs = Ports::runs($free, max(1, $count));
        throw_if($runs === [], NoViableAllocationException::class, trans('exceptions.deployment.no_viable_allocations'));

        $ids = $runs[array_rand($runs)];
        $allocations = Allocation::query()->whereIn('id', $ids)->get()->keyBy('id');

        return array_map(static fn (int $id): Allocation => $allocations[$id], $ids);
    }

    /**
     * Gives the server exactly these allocations, the first one as its primary, and frees every other one it had.
     *
     * @param  list<Allocation>  $allocations
     */
    public function replaceAllocations(Server $server, array $allocations): Server
    {
        $ids = array_map(static fn (Allocation $allocation): int => $allocation->id, $allocations);
        $server = $this->builder->update($server, [
            'allocation_id' => $ids[0],
            'add_allocations' => $ids,
            'remove_allocations' => array_values(array_diff(array_column($this->allocationsOf($server), 'id'), $ids)),
            'database_limit' => $server->database_limit,
            'allocation_limit' => $server->allocation_limit,
            'backup_limit' => $server->backup_limit,
        ]);

        Activity::event('server:allocation.primary')->subject($server, $allocations[0])->property(['allocation' => $allocations[0]->toString(), 'via' => 'server-creator'])->log();

        return $server;
    }

    /** @return array<string, string> Each variable of the server's egg with the value the server uses. */
    public function variableValues(Server $server): array
    {
        $stored = ServerVariable::query()->where('server_id', $server->id)->pluck('variable_value', 'variable_id');

        return $server->egg->variables()->get()
            ->mapWithKeys(static fn ($variable): array => [$variable->env_variable => (string) ($stored[$variable->id] ?? $variable->default_value ?? '')])
            ->all();
    }

    /** @param array<string, string> $values */
    public function setVariables(Server $server, array $values): void
    {
        foreach ($server->egg->variables()->whereIn('env_variable', array_keys($values))->get() as $variable) {
            $this->variables->update($server, $variable->id, $values[$variable->env_variable]);
        }
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
