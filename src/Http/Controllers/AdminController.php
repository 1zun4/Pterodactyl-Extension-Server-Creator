<?php

declare(strict_types=1);

namespace ServerCreator\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use ServerCreator\Http\Presenter;
use ServerCreator\Models\Copy;
use ServerCreator\Models\Game;
use ServerCreator\Models\OwnedServer;
use ServerCreator\Models\QuotaLimit;
use ServerCreator\Panel\Panel;
use ServerCreator\Services\Duplicator;
use ServerCreator\Services\Quotas;
use ServerCreator\Steam\Store;
use ServerCreator\Support\Quota;

final class AdminController
{
    public function __construct(private readonly Panel $panel, private readonly Quotas $quotas) {}

    public function index(): JsonResponse
    {
        return new JsonResponse([
            'games' => Game::query()->with('egg:id,name')->orderBy('sort')->orderBy('name')->get()->map(static fn (Game $game): array => Presenter::game($game)),
            'eggs' => $this->panel->eggs()->map(static fn ($egg): array => ['id' => $egg->id, 'name' => $egg->name, 'images' => array_values($egg->docker_images)]),
            'quota' => QuotaLimit::query()->whereNull('user_id')->first()?->limits() ?? array_fill_keys(Quota::RESOURCES, 0),
            'users' => QuotaLimit::query()->with('user:id,username,email')->whereNotNull('user_id')->get()->map(static fn (QuotaLimit $row): array => [
                'id' => $row->user_id,
                'username' => $row->user->username,
                'email' => $row->user->email,
                'limits' => $row->limits(),
            ]),
            'locations' => [
                'all' => Location::query()->orderBy('short')->get(['id', 'short', 'long']),
                'selected' => $this->panel->locations(),
            ],
        ]);
    }

    public function storeGame(Request $request): JsonResponse
    {
        Game::query()->create($this->validatedGame($request));

        return $this->index();
    }

    public function updateGame(Request $request, int $id): JsonResponse
    {
        Game::query()->findOrFail($id)->update($this->validatedGame($request));

        return $this->index();
    }

    public function destroyGame(int $id): JsonResponse
    {
        Game::query()->findOrFail($id)->delete();

        return $this->index();
    }

    public function updateQuota(Request $request): JsonResponse
    {
        QuotaLimit::query()->updateOrCreate(['user_id' => null], $this->validatedQuota($request));

        return $this->index();
    }

    public function updateLocations(Request $request): JsonResponse
    {
        $data = $request->validate(['locations' => ['present', 'array'], 'locations.*' => ['integer', 'exists:locations,id']]);
        $this->panel->setLocations(array_values(array_unique(array_map(intval(...), $data['locations']))));

        return $this->index();
    }

    public function users(Request $request): JsonResponse
    {
        $query = (string) $request->query('query', '');

        return new JsonResponse(['users' => User::query()
            ->when($query !== '', static fn ($builder) => $builder->where(static fn ($inner) => $inner->where('username', 'like', "%{$query}%")->orWhere('email', 'like', "%{$query}%")))
            ->orderBy('username')
            ->limit(25)
            ->get(['id', 'username', 'email'])]);
    }

    public function user(int $id): JsonResponse
    {
        $user = User::query()->findOrFail($id);
        $own = QuotaLimit::query()->where('user_id', $user->id)->first();

        return new JsonResponse([
            'custom' => $own?->limits(),
            'quota' => $this->quotas->summary($user),
            'servers' => OwnedServer::query()->with(['server' => static fn ($query) => $query->without('allocation')->select(['id', 'name']), 'game:id,name'])->where('user_id', $user->id)->get()->map(static fn (OwnedServer $owned): array => [
                'id' => $owned->server->id,
                'name' => $owned->server->name,
                'game' => $owned->game?->name,
            ]),
        ]);
    }

    public function updateUser(Request $request, int $id): JsonResponse
    {
        $user = User::query()->findOrFail($id);
        QuotaLimit::query()->updateOrCreate(['user_id' => $user->id], $this->validatedQuota($request));

        return $this->user($id);
    }

    public function resetUser(int $id): JsonResponse
    {
        QuotaLimit::query()->where('user_id', $id)->delete();

        return $this->user($id);
    }

    public function steam(Request $request, Store $store): JsonResponse
    {
        return new JsonResponse(['results' => $store->search((string) $request->query('term', ''))]);
    }

    public function duplicate(Request $request, Duplicator $duplicator, int $id): JsonResponse
    {
        $source = Server::query()->with('node')->findOrFail($id);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'owner' => ['required', 'integer', 'exists:users,id'],
            'files' => ['boolean'],
        ]);

        $server = $duplicator->duplicate($source, $request->user(), $data['name'], User::query()->findOrFail($data['owner']), (bool) ($data['files'] ?? false));

        return new JsonResponse(['id' => $server->id, 'identifier' => $server->uuidShort], 201);
    }

    public function copies(int $id): JsonResponse
    {
        $names = static fn ($query) => $query->without('allocation')->select(['id', 'name']);

        return new JsonResponse(['copies' => Copy::query()
            ->with(['source' => $names, 'target' => $names])
            ->where(static fn ($query) => $query->where('source_id', $id)->orWhere('target_id', $id))
            ->latest()
            ->limit(5)
            ->get()
            ->map(static fn (Copy $copy): array => [
                'id' => $copy->id,
                'source' => $copy->source->name,
                'target' => ['id' => $copy->target_id, 'name' => $copy->target->name],
                'step' => $copy->step,
                'error' => $copy->error,
                'created_at' => $copy->created_at->toAtomString(),
            ])]);
    }

    /** @return array<string, mixed> */
    private function validatedGame(Request $request): array
    {
        $data = $request->validate([
            'egg_id' => ['required', 'integer', 'exists:eggs,id'],
            'name' => ['required', 'string', 'max:191'],
            'description' => ['nullable', 'string', 'max:1000'],
            'image' => ['nullable', 'url:https', 'max:500'],
            'steam_app_id' => ['nullable', 'integer', 'min:1'],
            'docker_image' => ['nullable', 'string', 'max:191', 'regex:/^~?[\w\.\/\-:@ ]*$/'],
            'memory_min' => ['required', 'integer', 'min:64'],
            'memory_max' => ['required', 'integer', 'gte:memory_min', 'max:1048576'],
            'disk_min' => ['required', 'integer', 'min:128'],
            'disk_max' => ['required', 'integer', 'gte:disk_min', 'max:10485760'],
            'cpu_min' => ['required', 'integer', 'min:10'],
            'cpu_max' => ['required', 'integer', 'gte:cpu_min', 'max:10000'],
            'databases' => ['required', 'integer', 'min:0', 'max:100'],
            'backups' => ['required', 'integer', 'min:0', 'max:100'],
            'allocations' => ['required', 'integer', 'min:0', 'max:100'],
            'sort' => ['integer', 'min:-1000', 'max:1000'],
            'enabled' => ['boolean'],
        ]);

        return $data + ['sort' => 0, 'enabled' => true];
    }

    /** @return array<string, int> */
    private function validatedQuota(Request $request): array
    {
        return array_map(intval(...), $request->validate(
            collect(Quota::RESOURCES)->mapWithKeys(static fn (string $resource): array => [$resource => ['required', 'integer', 'min:0', 'max:100000000']])->all(),
        ));
    }
}
