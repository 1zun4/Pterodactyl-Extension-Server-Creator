<?php

declare(strict_types=1);

namespace ServerCreator\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Pterodactyl\Models\Server;

/**
 * A server a user created through this extension.
 *
 * @property int $server_id
 * @property int $user_id
 * @property int|null $game_id
 * @property Server $server
 * @property Game|null $game
 */
final class OwnedServer extends Model
{
    public $incrementing = false;

    protected $table = 'ext_server_creator_servers';

    protected $primaryKey = 'server_id';

    protected $fillable = ['server_id', 'user_id', 'game_id'];

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
