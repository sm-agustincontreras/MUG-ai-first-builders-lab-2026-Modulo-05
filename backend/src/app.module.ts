import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Loads backend/.env into process.env as soon as this module is
    // evaluated (before Nest instantiates any provider, including
    // PrismaService) — the only place in the app that reads .env at
    // runtime, since the Prisma CLI does its own (separate) env loading
    // for `prisma migrate`/`prisma generate`.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
  ],
})
export class AppModule {}
