<?php

declare(strict_types=1);

namespace ServerCreator\Http;

use Pterodactyl\Models\EggVariable;
use ServerCreator\Models\Game;

final class Presenter
{
    /** @return array<string, mixed> */
    public static function game(Game $game, bool $withVariables = false): array
    {
        $data = [
            'id' => $game->id,
            'egg_id' => $game->egg_id,
            'egg' => $game->egg?->name,
            'name' => $game->name,
            'description' => $game->description,
            'image' => $game->image,
            'steam_app_id' => $game->steam_app_id,
            'artwork' => $game->artwork(),
            'docker_image' => $game->docker_image,
            'enabled' => $game->enabled,
            'sort' => $game->sort,
        ] + $game->only(['memory_min', 'memory_max', 'disk_min', 'disk_max', 'cpu_min', 'cpu_max', 'databases', 'backups', 'allocations']);

        if ($withVariables) {
            $data['variables'] = $game->egg->variables()
                ->where('user_viewable', true)
                ->where('user_editable', true)
                ->orderBy('sort_order')->orderBy('id')
                ->get()
                ->map(static fn (EggVariable $variable): array => [
                    'key' => $variable->env_variable,
                    'name' => $variable->name,
                    'description' => $variable->description,
                    'default' => (string) ($variable->default_value ?? ''),
                    'required' => str_contains((string) $variable->rules, 'required'),
                ])
                ->all();
        }

        return $data;
    }
}
