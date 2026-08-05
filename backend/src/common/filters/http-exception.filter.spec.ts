import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function createMockHost(): { host: ArgumentsHost; jsonMock: jest.Mock; statusMock: jest.Mock } {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  const request = { method: 'GET', url: '/test' };
  const response = { status: statusMock };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, jsonMock, statusMock };
}

describe('HttpExceptionFilter', () => {
  it('transforms an HttpException into { statusCode, message, error }', () => {
    const filter = new HttpExceptionFilter();
    const { host, jsonMock, statusMock } = createMockHost();
    const exception = new BadRequestException('Invalid payload');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Invalid payload',
        error: expect.any(String),
      }),
    );
  });

  it('catches an uncontrolled (non-HttpException) error and returns a generic 500 with no stack trace', () => {
    const filter = new HttpExceptionFilter();
    const { host, jsonMock, statusMock } = createMockHost();
    const exception = new Error('Something exploded internally, sensitive detail here');

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(500);
    const payload = jsonMock.mock.calls[0][0];
    expect(payload.statusCode).toBe(500);
    expect(payload.message).not.toContain('sensitive detail here');
    expect(JSON.stringify(payload)).not.toContain('.ts:');
    expect(payload).not.toHaveProperty('stack');
  });

  it('si getResponse() devuelve un objeto sin campo message, usa exception.message como fallback', () => {
    const filter = new HttpExceptionFilter();
    const { host, jsonMock, statusMock } = createMockHost();
    const exception = new HttpException({ statusCode: 400 }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: exception.message,
      }),
    );
  });

  it('si getResponse() devuelve un string plano, lo usa directamente como message', () => {
    const filter = new HttpExceptionFilter();
    const { host, jsonMock, statusMock } = createMockHost();
    const exception = new HttpException('plain string response', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'plain string response',
      }),
    );
  });
});
