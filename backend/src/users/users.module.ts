import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  // RolesGuard is registered here (like JwtRefreshGuard in AuthModule,
  // Block 2) so Nest resolves its `Reflector` dependency through this
  // module's injector. JwtAuthGuard needs no such registration — it has no
  // constructor dependencies and is reused as-is from Block 2.
  providers: [UsersService, RolesGuard],
})
export class UsersModule {}
