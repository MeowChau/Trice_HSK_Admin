import {
  HttpStatus,
  BadRequestException,
  ValidationError,
  ValidationPipeOptions,
} from '@nestjs/common';

type ValidationErrorsTree = {
  [key: string]: string | ValidationErrorsTree;
};

function generateErrors(errors: ValidationError[]): ValidationErrorsTree {
  return errors.reduce<ValidationErrorsTree>(
    (accumulator, currentValue) => ({
      ...accumulator,
      [currentValue.property]:
        (currentValue.children?.length ?? 0) > 0
          ? generateErrors(currentValue.children ?? [])
          : Object.values(currentValue.constraints ?? {}).join(', '),
    }),
    {},
  );
}

const validationOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  errorHttpStatusCode: HttpStatus.BAD_REQUEST,
  exceptionFactory: (errors: ValidationError[]) => {
    return new BadRequestException({
      status: HttpStatus.BAD_REQUEST,
      errors: generateErrors(errors),
    });
  },
};

export default validationOptions;
