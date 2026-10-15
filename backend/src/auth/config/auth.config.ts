import { registerAs } from '@nestjs/config';

import { Logger } from '@nestjs/common';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import validateConfig from '../../utils/validate-config';
import { AuthConfig } from './auth-config.type';
import ms from 'ms';

const PLACEHOLDER_SECRETS = {
  AUTH_JWT_SECRET: ['secret', 'secret_trice_hsk_jwt_key'],
  AUTH_REFRESH_SECRET: ['secret_for_refresh', 'secret_trice_hsk_refresh_key'],
  AUTH_FORGOT_SECRET: ['secret_for_forgot'],
  AUTH_CONFIRM_EMAIL_SECRET: ['secret_for_confirm_email'],
} as const;

function checkPlaceholderSecrets(): void {
  const placeholders = Object.entries(PLACEHOLDER_SECRETS)
    .filter(([envVar, placeholders]) =>
      placeholders.some((placeholder) => process.env[envVar] === placeholder),
    )
    .map(([envVar]) => envVar);

  if (placeholders.length === 0) {
    return;
  }

  const message = `${placeholders.join(', ')} still use the placeholder values from env-example. Generate strong secrets before deploying (see "Configure Auth" in docs/auth.md).`;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }

  new Logger('AuthConfig').warn(message);
}

class EnvironmentVariablesValidator {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  AUTH_RATE_LIMIT?: number;

  @IsString()
  AUTH_JWT_SECRET: string;

  @IsString()
  AUTH_JWT_TOKEN_EXPIRES_IN: string;

  @IsString()
  AUTH_REFRESH_SECRET: string;

  @IsString()
  AUTH_REFRESH_TOKEN_EXPIRES_IN: string;

  @IsString()
  AUTH_FORGOT_SECRET: string;

  @IsString()
  AUTH_FORGOT_TOKEN_EXPIRES_IN: string;

  @IsString()
  AUTH_CONFIRM_EMAIL_SECRET: string;

  @IsString()
  AUTH_CONFIRM_EMAIL_TOKEN_EXPIRES_IN: string;

  @IsBooleanString()
  @IsOptional()
  AUTH_UNIFORM_ERRORS: string;
}

export default registerAs<AuthConfig>('auth', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  checkPlaceholderSecrets();

  return {
    secret: process.env.AUTH_JWT_SECRET,
    expires: process.env.AUTH_JWT_TOKEN_EXPIRES_IN as ms.StringValue,
    refreshSecret: process.env.AUTH_REFRESH_SECRET,
    refreshExpires: process.env.AUTH_REFRESH_TOKEN_EXPIRES_IN as ms.StringValue,
    forgotSecret: process.env.AUTH_FORGOT_SECRET,
    forgotExpires: process.env.AUTH_FORGOT_TOKEN_EXPIRES_IN as ms.StringValue,
    confirmEmailSecret: process.env.AUTH_CONFIRM_EMAIL_SECRET,
    confirmEmailExpires: process.env
      .AUTH_CONFIRM_EMAIL_TOKEN_EXPIRES_IN as ms.StringValue,
    uniformErrors: process.env.AUTH_UNIFORM_ERRORS === 'true',
    rateLimit: Number(process.env.AUTH_RATE_LIMIT ?? 10),
  };
});
