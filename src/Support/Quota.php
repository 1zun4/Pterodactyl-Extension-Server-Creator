<?php

declare(strict_types=1);

namespace ServerCreator\Support;

/**
 * What a user may still create. A limit of 0 allows nothing.
 */
final readonly class Quota
{
    public const array RESOURCES = ['servers', 'memory', 'disk', 'cpu', 'databases', 'backups', 'allocations'];

    /** The smallest size a self-created server may have; 0 would mean unlimited to Pterodactyl. */
    public const array SMALLEST = ['memory' => 64, 'disk' => 128, 'cpu' => 10];

    /** @param array<string, int> $limits */
    public function __construct(public array $limits) {}

    /**
     * @param  array<string, int>  $used
     * @return array<string, int>
     */
    public function remaining(array $used): array
    {
        $remaining = [];

        foreach (self::RESOURCES as $resource) {
            $remaining[$resource] = max(0, ($this->limits[$resource] ?? 0) - ($used[$resource] ?? 0));
        }

        return $remaining;
    }

    /**
     * The first resource the request does not fit into, or null when everything fits.
     *
     * @param  array<string, int>  $request  One server's resources, without the `servers` count.
     * @param  array<string, int>  $used  For a resize, without the server being resized.
     */
    public function exceeded(array $request, array $used, bool $newServer = true): ?string
    {
        $remaining = $this->remaining($used);

        if ($newServer && $remaining['servers'] < 1) {
            return 'servers';
        }

        foreach ($request as $resource => $amount) {
            if ($resource !== 'servers' && in_array($resource, self::RESOURCES, true) && $amount > $remaining[$resource]) {
                return $resource;
            }
        }

        return null;
    }
}
