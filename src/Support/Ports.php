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
}
