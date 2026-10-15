<?php

declare(strict_types=1);

namespace ServerCreator\Support;

/**
 * Ready-made settings for popular games, keyed by their ID in the Pterodactyl egg catalog
 * (eggs.pterodactyl.io). Sizes are in MiB and percent of a core.
 */
final class PopularGames
{
    public const array GAMES = [
        'games-paper' => ['egg' => 'Paper', 'name' => 'Minecraft: Paper', 'description' => 'Fast Minecraft server with plugin support.', 'steam_app_id' => null, 'memory' => [1024, 8192], 'disk' => [5120, 20480], 'cpu' => [100, 400]],
        'games-counter-strike-2' => ['egg' => 'Counter-Strike 2', 'name' => 'Counter-Strike 2', 'description' => 'Competitive and casual matches with your own rules.', 'steam_app_id' => 730, 'memory' => [2048, 8192], 'disk' => [76800, 102400], 'cpu' => [100, 400]],
        'games-valheim' => ['egg' => 'Valheim', 'name' => 'Valheim', 'description' => 'Viking survival for up to 10 players.', 'steam_app_id' => 892970, 'memory' => [2048, 8192], 'disk' => [4096, 10240], 'cpu' => [200, 400], 'ports' => 2],
        'games-team-fortress-2' => ['egg' => 'Team Fortress 2', 'name' => 'Team Fortress 2', 'description' => 'Class-based team shooter.', 'steam_app_id' => 440, 'memory' => [2048, 4096], 'disk' => [20480, 30720], 'cpu' => [100, 200]],
        'games-palworld' => ['egg' => 'Palworld', 'name' => 'Palworld', 'description' => 'Catch creatures and survive together.', 'steam_app_id' => 1623730, 'memory' => [8192, 32768], 'disk' => [10240, 30720], 'cpu' => [200, 800]],
        'games-project-zomboid' => ['egg' => 'Project Zomboid', 'name' => 'Project Zomboid', 'description' => 'Zombie survival sandbox.', 'steam_app_id' => 108600, 'memory' => [4096, 16384], 'disk' => [10240, 30720], 'cpu' => [200, 400], 'ports' => 2, 'port_variables' => ['STEAM_PORT']],
        'games-terraria-vanilla' => ['egg' => 'Terraria Vanilla', 'name' => 'Terraria', 'description' => 'Dig, fight, explore and build.', 'steam_app_id' => 105600, 'memory' => [1024, 4096], 'disk' => [1024, 5120], 'cpu' => [100, 200]],
        'games-tmodloader' => ['egg' => 'tModloader', 'name' => 'Terraria: tModLoader', 'description' => 'Terraria with mods.', 'steam_app_id' => 1281930, 'memory' => [2048, 8192], 'disk' => [2048, 10240], 'cpu' => [100, 200]],
        'games-left-4-dead-2' => ['egg' => 'Left 4 Dead 2', 'name' => 'Left 4 Dead 2', 'description' => 'Co-op zombie shooter for four.', 'steam_app_id' => 550, 'memory' => [1024, 4096], 'disk' => [12288, 20480], 'cpu' => [100, 200]],
        'games-don-t-starve-together' => ['egg' => "Don't Starve Together", 'name' => "Don't Starve Together", 'description' => 'Co-op wilderness survival.', 'steam_app_id' => 322330, 'memory' => [2048, 4096], 'disk' => [6144, 10240], 'cpu' => [100, 200]],
        'games-factorio' => ['egg' => 'Factorio', 'name' => 'Factorio', 'description' => 'Build and automate factories together.', 'steam_app_id' => 427520, 'memory' => [1024, 8192], 'disk' => [2048, 10240], 'cpu' => [100, 400]],
        'games-the-isle' => ['egg' => 'The Isle', 'name' => 'The Isle', 'description' => 'Survive as a dinosaur.', 'steam_app_id' => 376210, 'memory' => [4096, 16384], 'disk' => [5120, 20480], 'cpu' => [200, 400], 'ports' => 3, 'port_variables' => ['RCON_PORT', 'QUEUE_PORT']],
        'games-satisfactory' => ['egg' => 'Satisfactory', 'name' => 'Satisfactory', 'description' => 'Build factories together.', 'steam_app_id' => 526870, 'memory' => [8192, 16384], 'disk' => [15360, 30720], 'cpu' => [200, 400], 'ports' => 2, 'port_variables' => ['RELIABLE_PORT']],
        'games-7-days-to-die' => ['egg' => '7 Days To Die', 'name' => '7 Days To Die', 'description' => 'Zombie survival crafting.', 'steam_app_id' => 251570, 'memory' => [4096, 12288], 'disk' => [15360, 30720], 'cpu' => [200, 400]],
        'games-garrys-mod' => ['egg' => 'Garrys Mod', 'name' => "Garry's Mod", 'description' => 'Sandbox with endless game modes.', 'steam_app_id' => 4000, 'memory' => [1024, 4096], 'disk' => [10240, 30720], 'cpu' => [100, 200]],
    ];

    /**
     * The games not added yet, as game input with the installed egg they would use (or null
     * when it has to be imported from the catalog).
     *
     * @param  iterable<array{id: int, name: string}>  $eggs
     * @param  list<int>  $usedEggs  Eggs that already have a game.
     * @return list<array<string, mixed>>
     */
    public static function available(iterable $eggs, array $usedEggs): array
    {
        $installed = [];

        foreach ($eggs as $egg) {
            $installed[mb_strtolower($egg['name'])] ??= $egg['id'];
        }

        $games = [];

        foreach (self::GAMES as $id => $game) {
            $egg = $installed[mb_strtolower($game['egg'])] ?? null;

            if ($egg !== null && in_array($egg, $usedEggs, true)) {
                continue;
            }

            $games[] = self::input($id, $egg);
        }

        return $games;
    }

    /** @return array<string, mixed> */
    public static function input(string $id, ?int $egg): array
    {
        $game = self::GAMES[$id];

        return [
            'catalog_id' => $id,
            'catalog_egg' => $game['egg'],
            'egg_id' => $egg,
            'name' => $game['name'],
            'description' => $game['description'],
            'steam_app_id' => $game['steam_app_id'],
            'memory_min' => $game['memory'][0],
            'memory_max' => $game['memory'][1],
            'disk_min' => $game['disk'][0],
            'disk_max' => $game['disk'][1],
            'cpu_min' => $game['cpu'][0],
            'cpu_max' => $game['cpu'][1],
            'ports' => $game['ports'] ?? 1,
            'port_variables' => $game['port_variables'] ?? [],
        ];
    }
}
