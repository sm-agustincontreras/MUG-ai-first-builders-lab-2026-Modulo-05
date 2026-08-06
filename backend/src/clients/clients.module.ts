import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsController],
  // RolesGuard is registered here (same pattern as UsersModule) so Nest
  // resolves its `Reflector` dependency through this module's injector.
  providers: [ClientsService, RolesGuard],
})
export class ClientsModule {}
