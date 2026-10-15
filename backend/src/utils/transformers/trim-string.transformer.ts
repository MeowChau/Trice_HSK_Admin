import type { TransformFnParams } from 'class-transformer';

export function trimStringTransformer({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
