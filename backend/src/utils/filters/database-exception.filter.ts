import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

@Injectable()
@Catch(QueryFailedError)
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const code: unknown =
      'code' in exception.driverError ? exception.driverError.code : undefined;
    switch (code) {
      case '23505':
        super.catch(
          new ConflictException('A unique value already exists'),
          host,
        );
        return;
      case '23503':
        super.catch(
          new UnprocessableEntityException(
            'A referenced record does not exist or is still in use',
          ),
          host,
        );
        return;
      case '23502':
      case '23514':
        super.catch(
          new UnprocessableEntityException(
            'Data violates a database constraint',
          ),
          host,
        );
        return;
      case '22003':
      case '22P02':
        super.catch(new BadRequestException('Invalid database value'), host);
        return;
      default:
        // QueryFailedError carries SQL parameters; keep credentials and user data out of logs.
        this.logger.error(
          `Database query failed (code: ${typeof code === 'string' ? code : 'unknown'})`,
        );
        super.catch(new InternalServerErrorException(), host);
    }
  }
}
