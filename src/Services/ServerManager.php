<?php

declare(strict_types=1);

namespace ServerCreator\Services;

use Illuminate\Support\Facades\Cache;
use Pterodactyl\Exceptions\Service\Deployment\NoViableAllocationException;
use Pterodactyl\Exceptions\Service\Deployment\NoViableNodeException;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use ServerCreator\Exceptions\CreatorException;
use ServerCreator\Models\Game;
use ServerCreator\Models\OwnedServer;
use ServerCreator\Panel\Panel;
use ServerCreator\Support\Ports;
use ServerCreator\Support\Quota;

/**
 * Creating, resizing, switching and deleting the servers users made themselves.
 */
final readonly class ServerManager
{
    private const array NAMES = ['servers' => 'servers', 'memory' => 'memory', 'disk' => 'disk space', 'cpu' => 'CPU', 'databases' => 'databases', 'backups' => 'backups', 'allocations' => 'ports'];

    public function __construct(private Panel $panel, private Quotas $quotas) {}

    /** @param array{name: string, memory: int, disk: int, cpu: int, environment: array<string, string>} $input */
    public function create(User $user, Game $game, array $input): Server
    {
        $this->assertWithin($game, $input);

        return Cache::lock("ext:server-creator:user:{$user->id}", 60)->block(15, function () use ($user, $game, $input): Server {
            $resources = ['memory' => $input['memory'], 'disk' => $input['disk'], 'cpu' => $input['cpu'], 'databases' => $game->databases, 'backups' => $game->backups, 'allocations' => $game->allocations];
            $this->assertQuota($this->quotas->for($user)->exceeded($resources, $this->quotas->used($user)));

            $egg = $game->egg;
            $environment = $this->panel->environment($egg, $input['environment']);

            try {
                $ranges = Ports::ranges((string) $game->port_range) ?? [];
                $allocations = $game->ports > 1 || $ranges !== [] ? $this->panel->allocationsInARow($egg, $input['memory'], $input['disk'], $this->panel->locations(), $game->ports, $ranges) : [];

                $environment = Ports::fill($environment, array_map(static fn (Allocation $allocation): int => $allocation->port, $allocations), $game->port_variables ?? []);

                $server = $this->panel->create([
                    'name' => $input['name'],
                    'description' => '',
                    'owner_id' => $user->id,
                    'egg_id' => $egg->id,
                    'image' => $game->docker_image ?: (string) (array_values($egg->docker_images)[0] ?? ''),
                    'startup' => $egg->startup,
                    'environment' => $environment,
                    'memory' => $input['memory'],
                    'swap' => 0,
                    'disk' => $input['disk'],
                    'io' => 500,
                    'cpu' => $input['cpu'],
                    'threads' => null,
                    'oom_disabled' => true,
                    'skip_scripts' => false,
                    'start_on_completion' => true,
                    'database_limit' => $game->databases,
                    'allocation_limit' => $game->allocations,
                    'backup_limit' => $game->backups,
                ], $this->panel->locations(), $allocations);
            } catch (NoViableNodeException|NoViableAllocationException) {
                throw new CreatorException('No node has room for this server right now. Try smaller resources or ask an administrator.');
            }

            OwnedServer::query()->create(['server_id' => $server->id, 'user_id' => $user->id, 'game_id' => $game->id]);

            return $server;
        });
    }

    public function resize(User $user, Server $server, int $memory, int $disk, int $cpu): Server
    {
        $owned = $this->owned($user, $server);
        $this->assertWithin($owned->game, compact('memory', 'disk', 'cpu'));

        $resources = ['memory' => $memory, 'disk' => $disk, 'cpu' => $cpu, 'databases' => (int) $server->database_limit, 'backups' => (int) $server->backup_limit, 'allocations' => (int) $server->allocation_limit];
        $this->assertQuota($this->quotas->for($user)->exceeded($resources, $this->quotas->used($user, $server), false));

        if (! $server->node->isViable(max(0, $memory - $server->memory), max(0, $disk - $server->disk))) {
            throw new CreatorException('The node this server runs on has no room for that much.');
        }

        return $this->panel->resize($server, $memory, $disk, $cpu);
    }

    /**
     * Moves the server to another game: its egg, image, feature limits, sizes and ports. Sizes, quota, node room
     * and free ports are checked before anything changes.
     *
     * @param  array{memory: int, disk: int, cpu: int, keep_variables: bool, reinstall: bool}  $input
     */
    public function switchGame(User $user, Server $server, Game $game, array $input): Server
    {
        $owned = $this->owned($user, $server);
        throw_if($owned->game_id === $game->id, new CreatorException('The server already runs this game.'));
        $this->assertWithin($game, $input);

        return Cache::lock("ext:server-creator:user:{$user->id}", 60)->block(15, function () use ($user, $server, $game, $input, $owned): Server {
            $limits = ['databases' => $game->databases, 'allocations' => $game->allocations, 'backups' => $game->backups];
            $this->assertQuota($this->quotas->for($user)->exceeded(['memory' => $input['memory'], 'disk' => $input['disk'], 'cpu' => $input['cpu']] + $limits, $this->quotas->used($user, $server), false));

            if (! $server->node->isViable(max(0, $input['memory'] - $server->memory), max(0, $input['disk'] - $server->disk))) {
                throw new CreatorException('The node this server runs on has no room for that much.');
            }

            throw_unless($this->panel->isStopped($server), new CreatorException('Stop the server before switching the game.', 409));

            $ranges = Ports::ranges((string) $game->port_range) ?? [];

            if (Ports::runFrom($this->panel->allocationsOf($server), $server->allocation_id, $game->ports, $ranges) === null) {
                try {
                    $this->panel->freeRunOnNode($server, $game->ports, $ranges);
                } catch (NoViableAllocationException) {
                    throw new CreatorException('The node this server runs on has no free ports for this game. Ask an administrator.');
                }
            }

            $previous = $owned->game?->name;
            // Bound first, so the egg change keeps this game instead of picking one by egg.
            $owned->update(['game_id' => $game->id]);

            if ($server->egg_id !== $game->egg_id) {
                $server = $this->panel->changeEgg($server, $game->egg, $input['keep_variables']);
            }

            $image = $game->docker_image ?: (string) (array_values($game->egg->docker_images)[0] ?? '');

            if ($image !== '' && $server->image !== $image) {
                $server = $this->panel->setImage($server, $image);
            }

            $server = $this->fitPorts($this->panel->resize($server, $input['memory'], $input['disk'], $input['cpu'], $limits), $game);
            $this->panel->log('server:startup.edit', $server, ['variable' => 'Game', 'old' => $previous, 'new' => $game->name]);

            if ($input['reinstall']) {
                $this->panel->reinstall($server);
            }

            return $server;
        });
    }

    /**
     * Gives the server the ports its game needs: when its own do not fit the game's range and ports in a row,
     * free ones on its node replace all of them. The extra ports go into the game's port variables.
     *
     * @throws NoViableAllocationException
     */
    public function fitPorts(Server $server, Game $game): Server
    {
        $ranges = Ports::ranges((string) $game->port_range) ?? [];
        $ports = Ports::runFrom($this->panel->allocationsOf($server), $server->allocation_id, $game->ports, $ranges);

        if ($ports === null) {
            $run = $this->panel->freeRunOnNode($server, $game->ports, $ranges);
            $server = $this->panel->replaceAllocations($server, $run);
            $ports = array_map(static fn (Allocation $allocation): int => $allocation->port, $run);
        }

        $environment = $this->panel->variableValues($server);
        $this->panel->setVariables($server, array_diff_assoc(Ports::fill($environment, $ports, $game->port_variables ?? []), $environment));

        return $server;
    }

    public function delete(User $user, Server $server): void
    {
        $this->owned($user, $server);
        $this->panel->delete($server);
    }

    public function owned(User $user, Server $server): OwnedServer
    {
        return OwnedServer::query()->with('game')->where('user_id', $user->id)->where('server_id', $server->id)->firstOr(
            static fn () => throw new CreatorException('Only servers you created yourself can be changed here.', 403),
        );
    }

    /**
     * Servers whose game was deleted still may not drop to 0, which Pterodactyl treats as unlimited.
     *
     * @param  array{memory: int, disk: int, cpu: int}  $resources
     */
    private function assertWithin(?Game $game, array $resources): void
    {
        foreach (['memory', 'disk', 'cpu'] as $resource) {
            $min = $game?->{"{$resource}_min"} ?? Quota::SMALLEST[$resource];
            $max = $game?->{"{$resource}_max"} ?? PHP_INT_MAX;

            if ($resources[$resource] < $min || $resources[$resource] > $max) {
                throw new CreatorException($game === null
                    ? sprintf('%s has to be at least %d.', ucfirst(self::NAMES[$resource]), $min)
                    : sprintf('%s has to be between %d and %d.', ucfirst(self::NAMES[$resource]), $min, $max));
            }
        }
    }

    private function assertQuota(?string $exceeded): void
    {
        if ($exceeded !== null) {
            throw new CreatorException($exceeded === 'servers' ? 'You cannot create more servers.' : 'You do not have enough '.self::NAMES[$exceeded].' left.');
        }
    }
}
