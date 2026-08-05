import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function createMockContext(): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('sin @Roles() declarado en el handler/clase, permite el acceso (return true) — comportamiento por diseño (NFR-03)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    const result = guard.canActivate(createMockContext());

    expect(result).toBe(true);
  });
});
