<?php

declare(strict_types=1);

namespace ServerCreator\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use ServerCreator\Http\Presenter;
use ServerCreator\Models\Game;
use ServerCreator\Models\OwnedServer;
use ServerCreator\Services\Quotas;
use ServerCreator\Services\ServerManager;

final class ClientController
{
    public function __construct(private readonly Quotas $quotas, private readonly ServerManager $manager) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $summary = $this->quotas->summary($user);

        return new JsonResponse([
            'quota' => $summary,
            'games' => $summary['limits']['servers'] > 0
                ? Game::query()->with('egg')->where('enabled', true)->orderBy('sort')->orderBy('name')->get()->map(static fn (Game $game): array => Presenter::game($game, true))
                : [],
            'servers' => OwnedServer::query()->with(['server' => static fn ($query) => $query->without('allocation')->select(['id', 'uuidShort', 'name']), 'game:id,name'])->where('user_id', $user->id)->get()->map(static fn (OwnedServer $owned): array => [
                'identifier' => $owned->server->uuidShort,
                'name' => $owned->server->name,
                'game' => $owned->game?->name,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'game' => ['required', 'integer'],
            'name' => ['required', 'string', 'min:1', 'max:191'],
            'memory' => ['required', 'integer', 'min:0'],
            'disk' => ['required', 'integer', 'min:0'],
            'cpu' => ['required', 'integer', 'min:0'],
            'environment' => ['present', 'array'],
            'environment.*' => ['nullable', 'string', 'max:1000'],
        ]);

        $game = Game::query()->with('egg')->where('enabled', true)->findOrFail($data['game']);
        $server = $this->manager->create($request->user(), $game, [
            'name' => $data['name'],
            'memory' => (int) $data['memory'],
            'disk' => (int) $data['disk'],
            'cpu' => (int) $data['cpu'],
            'environment' => array_map(strval(...), array_filter($data['environment'], static fn ($value): bool => $value !== null)),
        ]);

        return new JsonResponse(['identifier' => $server->uuidShort], 201);
    }
}
