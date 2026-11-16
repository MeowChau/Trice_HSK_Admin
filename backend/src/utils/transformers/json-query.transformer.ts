import { HttpStatus, BadRequestException } from '@nestjs/common';

export function parseJsonQuery(value: unknown, property: string): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new BadRequestException({
      status: HttpStatus.BAD_REQUEST,
      errors: { [property]: 'invalidJson' },
    });
  }
}
