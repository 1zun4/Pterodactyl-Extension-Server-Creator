<?php

declare(strict_types=1);

namespace ServerCreator\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;

/**
 * Copies the files of a duplicated server: back up the original, then restore that backup into the copy.
 *
 * @property int $id
 * @property int $source_id
 * @property int $target_id
 * @property int $user_id
 * @property string $step
 * @property string|null $backup_uuid
 * @property string|null $error
 * @property \Carbon\CarbonImmutable $created_at
 * @property Server $source
 * @property Server $target
 * @property User $user
 */
final class Copy extends Model
{
    public const array STEPS = ['backup', 'backing-up', 'restore', 'restoring', 'cleanup', 'done', 'failed'];

    protected $table = 'ext_server_creator_copies';

    protected $fillable = ['source_id', 'target_id', 'user_id', 'step', 'backup_uuid', 'error'];

    protected function casts(): array
    {
        return ['created_at' => 'immutable_datetime'];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'source_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'target_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
