<?php

declare(strict_types=1);

namespace ServerCreator\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ServerCreator\Support\Quota;

final class QuotaTest extends TestCase
{
    public function test_requests_must_fit_into_what_is_left(): void
    {
        $quota = new Quota(['servers' => 2, 'memory' => 4096, 'disk' => 20480, 'cpu' => 200, 'databases' => 1, 'backups' => 2, 'allocations' => 2]);
        $used = ['servers' => 1, 'memory' => 3072, 'disk' => 10240, 'cpu' => 100, 'databases' => 1, 'backups' => 0, 'allocations' => 1];

        $this->assertSame(1024, $quota->remaining($used)['memory']);
        $this->assertNull($quota->exceeded(['memory' => 1024, 'disk' => 10240, 'cpu' => 100], $used));
        $this->assertSame('memory', $quota->exceeded(['memory' => 2048, 'disk' => 1024, 'cpu' => 50], $used));
        $this->assertSame('databases', $quota->exceeded(['memory' => 512, 'databases' => 1], $used));
        $this->assertSame('servers', $quota->exceeded(['memory' => 512], ['servers' => 2]));
    }
}
