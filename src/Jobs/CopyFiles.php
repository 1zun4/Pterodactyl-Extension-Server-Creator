<?php

declare(strict_types=1);

namespace ServerCreator\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\Server;
use RuntimeException;
use ServerCreator\Models\Copy;
use ServerCreator\Panel\Panel;
use Throwable;

/**
 * Runs one step of a file copy, then queues itself again until the copy is done.
 * Wings reports a finished restore to the panel, which moves the copy on (see RestoreListener).
 */
final class CopyFiles implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    private const int GIVE_UP_AFTER_HOURS = 3;

    public int $tries = 1;

    public int $timeout = 50;

    public function __construct(public int $copy)
    {
        $this->onQueue('low');
    }

    public function handle(Panel $panel): void
    {
        $copy = Copy::query()->with(['source', 'target', 'user'])->find($this->copy);

        if ($copy === null || in_array($copy->step, ['done', 'failed'], true)) {
            return;
        }

        try {
            if ($copy->created_at->lt(now()->subHours(self::GIVE_UP_AFTER_HOURS))) {
                throw new RuntimeException('Copying took too long and was stopped.');
            }

            $next = $this->step($copy, $panel);
        } catch (Throwable $exception) {
            report($exception);
            $this->fail($copy, $panel, mb_substr($exception->getMessage(), 0, 500));

            return;
        }

        if ($next !== null) {
            self::dispatch($copy->id)->delay(now()->addSeconds($next));
        }
    }

    /** Returns the seconds until the next step, or null when nothing is left to do. */
    private function step(Copy $copy, Panel $panel): ?int
    {
        $backup = $copy->backup_uuid ? Backup::query()->where('uuid', $copy->backup_uuid)->first() : null;

        switch ($copy->step) {
            case 'backup':
                $backup = $panel->backup($copy->source, "Copy to {$copy->target->name}");
                $copy->update(['step' => 'backing-up', 'backup_uuid' => $backup->uuid]);

                return 15;

            case 'backing-up':
                if ($backup === null || ($backup->completed_at !== null && ! $backup->is_successful)) {
                    throw new RuntimeException('The backup of the original server failed.');
                }

                if ($backup->completed_at === null) {
                    return 15;
                }

                $copy->update(['step' => 'restore']);

                return 1;

            case 'restore':
                // The copy's install script has to finish first.
                if (! $copy->target->fresh()->isInstalled()) {
                    return 15;
                }

                $panel->restoreInto($copy->target, $backup, $copy->user);
                $copy->update(['step' => 'restoring']);

                return 300;

            case 'restoring':
                // Only reached when Wings never reported back; RestoreListener normally finishes the copy.
                return 300;

            case 'cleanup':
                $backup && $panel->deleteBackup($backup);
                $copy->update(['step' => 'done']);

                return null;
        }

        return null;
    }

    private function fail(Copy $copy, Panel $panel, string $error): void
    {
        $copy->update(['step' => 'failed', 'error' => $error]);

        if ($copy->step === 'restoring' || $copy->target->status === Server::STATUS_RESTORING_BACKUP) {
            $copy->target->update(['status' => null]);
        }

        try {
            $backup = $copy->backup_uuid ? Backup::query()->where('uuid', $copy->backup_uuid)->first() : null;
            $backup && $panel->deleteBackup($backup);
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
