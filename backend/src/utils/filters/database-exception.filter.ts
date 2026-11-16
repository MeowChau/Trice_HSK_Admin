import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

/** One HTTP error boundary; retain legacy status/errors for existing app/admin clients. */
@Injectable()
@Catch()
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);
  constructor(private readonly adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }
  catch(exception: unknown, host: ArgumentsHost): void {
    let status = 500;
    let details: Record<string, unknown> = {};
    if (exception instanceof QueryFailedError) {
      const code: unknown =
        'code' in exception.driverError
          ? exception.driverError.code
          : undefined;
      const mapping: Record<string, [number, string]> = {
        '23505': [409, 'A unique value already exists'],
        '23503': [422, 'A referenced record does not exist or is still in use'],
        '23502': [422, 'Data violates a database constraint'],
        '23514': [422, 'Data violates a database constraint'],
        '22003': [400, 'Invalid database value'],
        '22P02': [400, 'Invalid database value'],
      };
      const mapped = typeof code === 'string' ? mapping[code] : undefined;
      if (mapped) {
        status = mapped[0];
        details = { message: mapped[1] };
      } else
        this.logger.error(
          `Database query failed (code: ${typeof code === 'string' ? code : 'unknown'})`,
        );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      details =
        typeof response === 'string' ? { message: response } : { ...response };
    } else {
      // Never log SQL parameters, tokens or user input from unknown exceptions.
      this.logger.error('Unhandled HTTP exception');
    }
    if (status === 500) details = { message: 'Internal server error' };
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    const response = host.switchToHttp().getResponse();
    if (this.adapterHost.httpAdapter.isHeadersSent(response)) {
      this.adapterHost.httpAdapter.end(response);
      return;
    }
    this.adapterHost.httpAdapter.reply(
      response,
      {
        ...details,
        statusCode: status,
        status,
        code: codes[status] || 'HTTP_ERROR',
        message:
          details.message ||
          (details.errors ? 'Validation failed' : 'Request failed'),
      },
      status,
    );
  }
}
