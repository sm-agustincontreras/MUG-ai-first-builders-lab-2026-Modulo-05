import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

/**
 * Single, global point where HTTP errors are formatted for the whole app
 * (see AGENTS.md — no controller/service is allowed to catch and format
 * errors on its own).
 *
 * Catches EVERYTHING (`@Catch()`, not just `HttpException`): a typed
 * `HttpException` is formatted using its own status/message; anything else
 * (a genuinely uncontrolled error) is logged server-side with the stack and
 * answered with a generic 500 that never leaks internals to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildResponseBody(exception);
    this.logException(exception, request, body.statusCode);

    response.status(body.statusCode).json(body);
  }

  private buildResponseBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        statusCode: status,
        message: this.extractMessage(exception),
        error: HttpStatus[status] ?? 'Error',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private extractMessage(exception: HttpException): string | string[] {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    const responseObj = response as Record<string, unknown>;
    return (responseObj.message as string | string[] | undefined) ?? exception.message;
  }

  private logException(exception: unknown, request: Request, statusCode: number): void {
    const context = `${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}`;
    if (exception instanceof HttpException) {
      this.logger.warn(`${context} -> ${statusCode}`);
      return;
    }
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`${context} -> ${statusCode} (unhandled exception)`, stack);
  }
}
