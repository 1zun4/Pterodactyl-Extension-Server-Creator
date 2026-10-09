<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use ServerCreator\Http\Controllers\ClientController;

Route::get('/', [ClientController::class, 'index']);
Route::post('/servers', [ClientController::class, 'store'])->middleware('throttle:5,1');
