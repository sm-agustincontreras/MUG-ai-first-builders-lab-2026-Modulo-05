import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController],
  // RolesGuard is registered here (same pattern as ClientsModule) so Nest
  // resolves its `Reflector` dependency through this module's injector.
  providers: [TeamsService, RolesGuard],
})
export class TeamsModule {}
