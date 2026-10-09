<?php

declare(strict_types=1);

namespace ServerCreator\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * A request that cannot be fulfilled, with a message that is safe to show to the user.
 */
final class CreatorException extends RuntimeException
{
    public function __construct(string $message, private readonly int $status = 422)
    {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return new JsonResponse(['errors' => [['code' => 'CreatorException', 'status' => (string) $this->status, 'detail' => $this->getMessage()]]], $this->status);
    }
}
