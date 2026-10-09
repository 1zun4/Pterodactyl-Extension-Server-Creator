<?php

declare(strict_types=1);

namespace ServerCreator\Services;

use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use ServerCreator\Models\OwnedServer;
use ServerCreator\Models\QuotaLimit;
use ServerCreator\Support\Quota;

final class Quotas
{
    public function for(User $user): Quota
    {
        $row = QuotaLimit::query()->where('user_id', $user->id)->first() ?? QuotaLimit::query()->whereNull('user_id')->first();

        return new Quota($row?->limits() ?? array_fill_keys(Quota::RESOURCES, 0));
    }

    /**
     * What the user's own servers take up.
     *
     * @return array<string, int>
     */
    public function used(User $user, ?Server $except = null): array
    {
        $servers = Server::query()
            ->whereIn('id', OwnedServer::query()->where('user_id', $user->id)->select('server_id'))
            ->when($except, static fn ($query) => $query->whereKeyNot($except->id))
            ->get(['id', 'memory', 'disk', 'cpu', 'database_limit', 'backup_limit', 'allocation_limit']);

        return [
            'servers' => $servers->count(),
            'memory' => (int) $servers->sum('memory'),
            'disk' => (int) $servers->sum('disk'),
            'cpu' => (int) $servers->sum('cpu'),
            'databases' => (int) $servers->sum('database_limit'),
            'backups' => (int) $servers->sum('backup_limit'),
            'allocations' => (int) $servers->sum('allocation_limit'),
        ];
    }

    /** @return array{limits: array<string, int>, used: array<string, int>, remaining: array<string, int>} */
    public function summary(User $user): array
    {
        $quota = $this->for($user);
        $used = $this->used($user);

        return ['limits' => $quota->limits, 'used' => $used, 'remaining' => $quota->remaining($used)];
    }
}
