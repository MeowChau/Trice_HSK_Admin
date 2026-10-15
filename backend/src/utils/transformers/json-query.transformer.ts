import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';

export function parseJsonQuery(value: unknown, property: string): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { [property]: 'invalidJson' },
    });
  }
}
