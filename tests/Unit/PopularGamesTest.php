<?php

declare(strict_types=1);

namespace ServerCreator\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ServerCreator\Support\PopularGames;

final class PopularGamesTest extends TestCase
{
    public function test_installed_eggs_are_found_by_name_and_used_ones_are_left_out(): void
    {
        $eggs = [['id' => 9, 'name' => 'Garrys Mod'], ['id' => 50, 'name' => 'tModLoader'], ['id' => 30, 'name' => 'Paper'], ['id' => 31, 'name' => 'Paper']];
        $games = array_column(PopularGames::available($eggs, [9]), null, 'catalog_id');

        $this->assertArrayNotHasKey('games-garrys-mod', $games);
        $this->assertSame(50, $games['games-tmodloader']['egg_id']);
        $this->assertSame(30, $games['games-paper']['egg_id']);
        $this->assertNull($games['games-terraria-vanilla']['egg_id']);
        $this->assertCount(count(PopularGames::GAMES) - 1, $games);
    }

    public function test_every_game_fits_the_admin_form(): void
    {
        foreach (array_keys(PopularGames::GAMES) as $id) {
            $game = PopularGames::input($id, null);

            foreach (['memory', 'disk', 'cpu'] as $resource) {
                $this->assertLessThanOrEqual($game["{$resource}_max"], $game["{$resource}_min"], "{$id} {$resource}");
            }

            $this->assertLessThan($game['ports'], count($game['port_variables']), $id);
            $this->assertMatchesRegularExpression('/^games-[a-z0-9-]+$/', $id);
        }
    }
}
