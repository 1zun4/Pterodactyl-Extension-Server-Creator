<?php

declare(strict_types=1);

namespace ServerCreator\Services;

use Illuminate\Support\Facades\Cache;
use Pterodactyl\Exceptions\Service\Deployment\NoViableAllocationException;
use Pterodactyl\Exceptions\Service\Deployment\NoViableNodeException;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use ServerCreator\Exceptions\CreatorException;
use ServerCreator\Models\Game;
use ServerCreator\Models\OwnedServer;
use ServerCreator\Panel\Panel;
use ServerCreator\Support\Quota;

/**
 * Creating, resizing and deleting the servers users made themselves.
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
                $allocations = $game->ports > 1 ? $this->panel->allocationsInARow($egg, $input['memory'], $input['disk'], $this->panel->locations(), $game->ports) : [];

                foreach (array_slice($allocations, 1) as $index => $allocation) {
                    $variable = $game->port_variables[$index] ?? null;

                    if ($variable !== null && array_key_exists($variable, $environment)) {
                        $environment[$variable] = (string) $allocation->port;
                    }
                }

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
