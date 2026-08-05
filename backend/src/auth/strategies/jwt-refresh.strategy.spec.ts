import { ConfigService } from '@nestjs/config';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';

describe('JwtRefreshStrategy', () => {
  it('lanza un error al construirse si JWT_REFRESH_SECRET no está configurado', () => {
    const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    expect(() => new JwtRefreshStrategy(configService)).toThrow('JWT_REFRESH_SECRET is not defined');
  });
});
