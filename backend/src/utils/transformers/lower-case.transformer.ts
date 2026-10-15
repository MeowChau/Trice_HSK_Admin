import { TransformFnParams } from 'class-transformer/types/interfaces';

export const lowerCaseTransformer = (params: TransformFnParams): unknown =>
  typeof params.value === 'string'
    ? params.value.toLowerCase().trim()
    : params.value;
