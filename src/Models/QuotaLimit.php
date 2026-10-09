<?php

declare(strict_types=1);

namespace ServerCreator\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Pterodactyl\Models\User;
use ServerCreator\Support\Quota;

/**
 * @property int $id
 * @property int|null $user_id
 * @property int $servers
 * @property int $memory
 * @property int $disk
 * @property int $cpu
 * @property int $databases
 * @property int $backups
 * @property int $allocations
 */
final class QuotaLimit extends Model
{
    protected $table = 'ext_server_creator_quotas';

    protected $fillable = ['user_id', 'servers', 'memory', 'disk', 'cpu', 'databases', 'backups', 'allocations'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return array<string, int> */
    public function limits(): array
    {
        return array_map(intval(...), $this->only(Quota::RESOURCES));
    }
}
