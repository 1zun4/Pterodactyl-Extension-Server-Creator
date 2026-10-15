<?php

declare(strict_types=1);

namespace ServerCreator\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ServerCreator\Support\Ports;

final class PortsTest extends TestCase
{
    public function test_runs_need_consecutive_ports_on_one_node_and_ip(): void
    {
        $free = [
            ['id' => 1, 'node' => 1, 'ip' => '10.0.0.1', 'port' => 2456],
            ['id' => 3, 'node' => 1, 'ip' => '10.0.0.1', 'port' => 2459],
            ['id' => 2, 'node' => 1, 'ip' => '10.0.0.2', 'port' => 2457],
            ['id' => 4, 'node' => 2, 'ip' => '10.0.0.1', 'port' => 2457],
            ['id' => 6, 'node' => 1, 'ip' => '10.0.0.1', 'port' => 2461],
            ['id' => 5, 'node' => 1, 'ip' => '10.0.0.1', 'port' => 2460],
        ];

        $this->assertSame([[3, 5]], Ports::runs($free, 2));
        $this->assertSame([[3, 5, 6]], Ports::runs($free, 3));
        $this->assertSame([], Ports::runs($free, 4));
    }

    public function test_runs_do_not_share_allocations(): void
    {
        $free = array_map(static fn (int $port): array => ['id' => $port, 'node' => 1, 'ip' => '10.0.0.1', 'port' => $port], [7777, 7778, 7779, 7780, 7781]);

        $this->assertSame([[7777, 7778], [7779, 7780]], Ports::runs($free, 2));
        $this->assertCount(5, Ports::runs($free, 1));
    }
}
