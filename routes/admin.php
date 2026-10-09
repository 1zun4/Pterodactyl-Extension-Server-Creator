<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use ServerCreator\Http\Controllers\AdminController;

Route::get('/', [AdminController::class, 'index']);
Route::post('/games', [AdminController::class, 'storeGame']);
Route::put('/games/{id}', [AdminController::class, 'updateGame'])->whereNumber('id');
Route::delete('/games/{id}', [AdminController::class, 'destroyGame'])->whereNumber('id');
Route::put('/quota', [AdminController::class, 'updateQuota']);
Route::put('/locations', [AdminController::class, 'updateLocations']);
Route::get('/users', [AdminController::class, 'users']);
Route::get('/users/{id}', [AdminController::class, 'user'])->whereNumber('id');
Route::put('/users/{id}/quota', [AdminController::class, 'updateUser'])->whereNumber('id');
Route::delete('/users/{id}/quota', [AdminController::class, 'resetUser'])->whereNumber('id');
Route::get('/steam', [AdminController::class, 'steam']);
Route::post('/servers/{id}/duplicate', [AdminController::class, 'duplicate'])->whereNumber('id');
Route::get('/servers/{id}/copies', [AdminController::class, 'copies'])->whereNumber('id');
