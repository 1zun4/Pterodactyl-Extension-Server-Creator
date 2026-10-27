<?php

declare(strict_types=1);

namespace ServerCreator\Jobs;

use Pterodactyl\Contracts\Servers\ChangesServerEgg;
use Pterodactyl\Exceptions\Service\Deployment\NoViableAllocationException;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Server;
use ServerCreator\Models\Game;
use ServerCreator\Models\OwnedServer;
use ServerCreator\Services\ServerManager;

/**
 * Any egg change of a server a user created here, from Egg Changer, Minecraft Content or an admin, keeps it bound
 * to a game: its own when that game uses the new egg, otherwise the first enabled game that does, otherwise its own.
 * The server then moves to ports that game allows.
 */
final readonly class EggListener implements ChangesServerEgg
{
    public function __construct(private ChangesServerEgg $inner) {}

    public function change(Server $server, Egg $egg, bool $keepVariables = false): Server
    {
        $server = $this->inner->change($server, $egg, $keepVariables);
        $owned = OwnedServer::query()->with('game')->find($server->id);

        if ($owned === null) {
            return $server;
        }

        $game = $owned->game?->egg_id === $egg->id
            ? $owned->game
            : Game::query()->where('egg_id', $egg->id)->where('enabled', true)->orderBy('sort')->orderBy('name')->first() ?? $owned->game;

        if ($game === null) {
            return $server;
        }

        if ($game->id !== $owned->game_id) {
            $owned->update(['game_id' => $game->id]);
        }

        try {
            return app(ServerManager::class)->fitPorts($server, $game);
        } catch (NoViableAllocationException) {
            // The egg change stands; the server keeps its ports until some are free in the game's range.
            return $server;
        }
    }
}
