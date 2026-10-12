<?php

declare(strict_types=1);

namespace ServerCreator\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use ServerCreator\Exceptions\CreatorException;
use ServerCreator\Models\OwnedServer;
use ServerCreator\Services\Quotas;
use ServerCreator\Services\ServerManager;
use ServerCreator\Settings;
use ServerCreator\Support\Quota;

/**
 * Resize and delete for the owner of a server they created themselves.
 */
final class ServerController
{
    public function __construct(private readonly ServerManager $manager, private readonly Quotas $quotas, private readonly Settings $settings) {}

    public function index(Request $request, Server $server): JsonResponse
    {
        $user = $request->user();
        $owned = OwnedServer::query()->with('game')->where('user_id', $user->id)->find($server->id);

        if ($owned === null) {
            return new JsonResponse(['owned' => false]);
        }

        $quota = $this->quotas->for($user);
        $available = $quota->remaining($this->quotas->used($user, $server));
        $game = $owned->game;

        return new JsonResponse([
            'owned' => true,
            'allow_resize' => $this->settings->allowResize(),
            'allow_delete' => $this->settings->allowDelete(),
            'game' => $game?->name,
            'current' => ['memory' => $server->memory, 'disk' => $server->disk, 'cpu' => $server->cpu],
            'limits' => collect(['memory', 'disk', 'cpu'])->mapWithKeys(static fn (string $resource): array => [$resource => [
                'min' => $game?->{"{$resource}_min"} ?? Quota::SMALLEST[$resource],
                'max' => min($game?->{"{$resource}_max"} ?? PHP_INT_MAX, $available[$resource]),
            ]])->all(),
            'quota' => collect(['memory', 'disk', 'cpu'])->mapWithKeys(static fn (string $resource): array => [$resource => [
                'limit' => $quota->limits[$resource] ?? 0,
                'available' => $available[$resource],
            ]])->all(),
        ]);
    }

    public function update(Request $request, Server $server): JsonResponse
    {
        throw_unless($this->settings->allowResize(), new CreatorException('Resizing servers is turned off.', 403));

        $data = $request->validate([
            'memory' => ['required', 'integer', 'min:0'],
            'disk' => ['required', 'integer', 'min:0'],
            'cpu' => ['required', 'integer', 'min:1'],
        ]);

        $this->manager->resize($request->user(), $server, (int) $data['memory'], (int) $data['disk'], (int) $data['cpu']);

        return $this->index($request, $server->refresh());
    }

    public function destroy(Request $request, Server $server): JsonResponse
    {
        throw_unless($this->settings->allowDelete(), new CreatorException('Deleting servers is turned off.', 403));
        throw_unless($request->input('name') === $server->name, new CreatorException('Type the server name to confirm.'));

        $this->manager->delete($request->user(), $server);

        return new JsonResponse(status: 204);
    }
}
