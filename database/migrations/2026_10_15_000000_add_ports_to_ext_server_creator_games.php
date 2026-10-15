<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ext_server_creator_games', function (Blueprint $table): void {
            // Ports in a row each new server gets; the ones after the first go into these variables.
            $table->unsignedTinyInteger('ports')->default(1)->after('allocations');
            $table->json('port_variables')->nullable()->after('ports');
        });
    }

    public function down(): void
    {
        Schema::table('ext_server_creator_games', function (Blueprint $table): void {
            $table->dropColumn(['ports', 'port_variables']);
        });
    }
};
