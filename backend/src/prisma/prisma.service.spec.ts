import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

describe('PrismaService (bootstrap smoke test)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prismaService = moduleRef.get<PrismaService>(PrismaService);

    // Mirrors what happens on real app bootstrap: onModuleInit() connects.
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('connects to the test database on app bootstrap', async () => {
    const result = await prismaService.$queryRaw<Array<{ result: number }>>`SELECT 1 as result`;
    expect(result[0].result).toBe(1);
  });
});
