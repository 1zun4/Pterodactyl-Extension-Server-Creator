<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Eggs users may pick, with the resource range they may choose from.
        Schema::create('ext_server_creator_games', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('egg_id');
            $table->string('name', 191);
            $table->text('description')->nullable();
            $table->string('image', 500)->nullable();
            $table->unsignedInteger('steam_app_id')->nullable();
            $table->string('docker_image', 191)->nullable();
            $table->unsignedInteger('memory_min');
            $table->unsignedInteger('memory_max');
            $table->unsignedInteger('disk_min');
            $table->unsignedInteger('disk_max');
            $table->unsignedInteger('cpu_min');
            $table->unsignedInteger('cpu_max');
            $table->unsignedInteger('databases')->default(0);
            $table->unsignedInteger('backups')->default(0);
            $table->unsignedInteger('allocations')->default(0);
            $table->integer('sort')->default(0);
            $table->boolean('enabled')->default(true);
            $table->timestamps();

            $table->foreign('egg_id')->references('id')->on('eggs')->cascadeOnDelete();
        });

        // A row without a user is the default quota for everyone.
        Schema::create('ext_server_creator_quotas', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable()->unique();
            $table->unsignedInteger('servers')->default(0);
            $table->unsignedInteger('memory')->default(0);
            $table->unsignedInteger('disk')->default(0);
            $table->unsignedInteger('cpu')->default(0);
            $table->unsignedInteger('databases')->default(0);
            $table->unsignedInteger('backups')->default(0);
            $table->unsignedInteger('allocations')->default(0);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        // Servers users created themselves. Only these count against quotas and can be resized or deleted.
        Schema::create('ext_server_creator_servers', function (Blueprint $table): void {
            $table->unsignedInteger('server_id')->primary();
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('game_id')->nullable();
            $table->timestamps();

            $table->foreign('server_id')->references('id')->on('servers')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('game_id')->references('id')->on('ext_server_creator_games')->nullOnDelete();
        });

        Schema::create('ext_server_creator_copies', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('source_id');
            $table->unsignedInteger('target_id');
            $table->unsignedInteger('user_id');
            $table->string('step', 32);
            $table->char('backup_uuid', 36)->nullable();
            $table->string('error', 500)->nullable();
            $table->timestamps();

            $table->foreign('source_id')->references('id')->on('servers')->cascadeOnDelete();
            $table->foreign('target_id')->references('id')->on('servers')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ext_server_creator_copies');
        Schema::dropIfExists('ext_server_creator_servers');
        Schema::dropIfExists('ext_server_creator_quotas');
        Schema::dropIfExists('ext_server_creator_games');
    }
};
