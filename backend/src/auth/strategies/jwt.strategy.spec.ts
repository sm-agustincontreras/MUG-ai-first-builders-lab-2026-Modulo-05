import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('lanza un error al construirse si JWT_ACCESS_SECRET no está configurado', () => {
    const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    expect(() => new JwtStrategy(configService)).toThrow('JWT_ACCESS_SECRET is not defined');
  });
});
