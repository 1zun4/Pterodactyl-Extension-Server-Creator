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
            $table->string('port_range', 191)->nullable()->after('port_variables');
        });
    }

    public function down(): void
    {
        Schema::table('ext_server_creator_games', function (Blueprint $table): void {
            $table->dropColumn('port_range');
        });
    }
};
