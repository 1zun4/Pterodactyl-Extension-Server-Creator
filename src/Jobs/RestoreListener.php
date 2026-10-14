<?php

declare(strict_types=1);

namespace ServerCreator\Jobs;

use Pterodactyl\Contracts\Backups\RestoresBackupStatuses;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\Node;
use ServerCreator\Models\Copy;

/**
 * Wings reports a finished restore for the server the backup belongs to. When the backup was
 * restored into a copy instead, this also clears the copy's restoring state and cleans up.
 */
final readonly class RestoreListener implements RestoresBackupStatuses
{
    public function __construct(private RestoresBackupStatuses $inner) {}

    public function restoreStatus(string $backupUuid, Node $node, bool $successful): Backup
    {
        $backup = $this->inner->restoreStatus($backupUuid, $node, $successful);
        $copy = Copy::query()->with('target')->where('backup_uuid', $backupUuid)->where('step', 'restoring')->first();

        if ($copy !== null) {
            $copy->target->update(['status' => null]);
            // Cleanup runs either way so the temporary backup goes; a failed restore ends the copy as failed.
            $copy->update($successful ? ['step' => 'cleanup'] : ['step' => 'cleanup', 'error' => 'Wings could not restore the files into the copy.']);
            CopyFiles::dispatch($copy->id);
        }

        return $backup;
    }
}
