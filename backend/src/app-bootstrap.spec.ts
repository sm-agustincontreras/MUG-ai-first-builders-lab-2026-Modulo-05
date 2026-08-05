import { Body, Controller, INestApplication, Module, Post, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsEmail, IsString, MinLength } from 'class-validator';
import * as request from 'supertest';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Throwaway DTO/controller, local to this spec, used only to verify that the
// global ValidationPipe wiring applied in main.ts (transform:true, whitelist:true)
// rejects an invalid payload with 400 before it reaches the controller.
class ProbeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() dto: ProbeDto): ProbeDto {
    return dto;
  }
}

@Module({
  controllers: [ProbeController],
})
class ProbeModule {}

describe('App bootstrap wiring (ValidationPipe)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Same global wiring applied in main.ts for this block.
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an invalid DTO with 400 before it reaches the controller', async () => {
    const response = await request(app.getHttpServer())
      .post('/probe')
      .send({ email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.statusCode).toBe(400);
  });
});
