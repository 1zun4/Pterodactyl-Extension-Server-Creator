<?php

declare(strict_types=1);

namespace ServerCreator\Steam;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Finds Steam app IDs by name, so admins can pick artwork for a game.
 */
final class Store
{
    public static function artwork(int $appId): string
    {
        return "https://cdn.cloudflare.steamstatic.com/steam/apps/{$appId}/header.jpg";
    }

    /** @return list<array{id: int, name: string, image: string}> */
    public function search(string $term): array
    {
        $term = mb_trim($term);

        if (mb_strlen($term) < 2) {
            return [];
        }

        return Cache::remember('ext:server-creator:steam:'.sha1(mb_strtolower($term)), 3600, static function () use ($term): array {
            $items = Http::timeout(8)->acceptJson()
                ->get('https://store.steampowered.com/api/storesearch/', ['term' => $term, 'l' => 'english', 'cc' => 'US'])
                ->throw()
                ->json('items') ?? [];

            return array_values(array_map(static fn (array $item): array => [
                'id' => (int) $item['id'],
                'name' => (string) $item['name'],
                'image' => self::artwork((int) $item['id']),
            ], array_slice(array_filter($items, static fn ($item): bool => is_array($item) && isset($item['id'], $item['name'])), 0, 10)));
        });
    }
}
