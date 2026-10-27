<?php

declare(strict_types=1);

namespace ServerCreator\Support;

final class Ports
{
    /**
     * Every set of `count` free allocations whose ports follow each other on one node and IP.
     * Runs do not overlap, so `[1, 2, 3, 4]` with a count of 2 gives `[1, 2]` and `[3, 4]`.
     *
     * @param  iterable<array{id: int, node: int, ip: string, port: int}>  $free
     * @return list<list<int>> The allocation IDs of each run, lowest port first.
     */
    public static function runs(iterable $free, int $count): array
    {
        $groups = [];

        foreach ($free as $allocation) {
            $groups[$allocation['node'].'|'.$allocation['ip']][$allocation['port']] = $allocation['id'];
        }

        $runs = [];

        foreach ($groups as $ports) {
            ksort($ports);
            $run = [];
            $last = null;

            foreach ($ports as $port => $id) {
                $run = $last !== null && $port === $last + 1 ? [...$run, $id] : [$id];
                $last = $port;

                if (count($run) === $count) {
                    $runs[] = $run;
                    $run = [];
                    $last = null;
                }
            }
        }

        return $runs;
    }

    /**
     * Parses comma separated ports and ranges such as `25565-25600, 27015`.
     *
     * @return list<array{int, int}>|null Each entry as [first, last]; null when an entry is not a port or range.
     */
    public static function ranges(string $value): ?array
    {
        $ranges = [];

        foreach (preg_split('/\s*,\s*/', mb_trim($value), -1, PREG_SPLIT_NO_EMPTY) ?: [] as $entry) {
            if (preg_match('/^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/', $entry, $matches) !== 1) {
                return null;
            }

            $first = (int) $matches[1];
            $last = (int) ($matches[2] ?? $first);

            if ($first < 1 || $last > 65535 || $first > $last) {
                return null;
            }

            $ranges[] = [$first, $last];
        }

        return $ranges;
    }

    /** @param list<array{int, int}> $ranges */
    public static function format(array $ranges): string
    {
        return implode(', ', array_map(static fn (array $range): string => $range[0] === $range[1] ? (string) $range[0] : "{$range[0]}-{$range[1]}", $ranges));
    }
}
