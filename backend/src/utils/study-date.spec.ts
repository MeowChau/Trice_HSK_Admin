import { databaseDate, studyDate } from './study-date';
import { ValidationPipe } from '@nestjs/common';
import validationOptions from './validation-options';
import { QueryUserDto } from '../users/dto/query-user.dto';
import { AuthEmailLoginDto } from '../auth/dto/auth-email-login.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { AuthUpdateDto } from '../auth/dto/auth-update.dto';

describe('Study dates and user query validation', () => {
  it('should keep database civil dates intact for strings and local-midnight Date values', () => {
    expect(databaseDate('2026-10-14')).toBe('2026-10-14');
    expect(databaseDate(new Date(2026, 9, 14))).toBe('2026-10-14');
    expect(databaseDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
  it('should record a new Vietnam study day before UTC midnight', () => {
    expect(studyDate(new Date('2026-10-08T17:00:00Z'))).toBe('2026-10-09');
    expect(studyDate(new Date('2026-10-08T16:59:59Z'))).toBe('2026-10-08');
  });

  const pipe = new ValidationPipe(validationOptions);
  it('should strip verification and permissions from self-service profile updates', async () => {
    await expect(
      pipe.transform(
        {
          firstName: 'Student',
          emailVerifiedAt: '2026-01-01',
          role: { id: 1 },
        },
        { type: 'body', metatype: AuthUpdateDto },
      ),
    ).resolves.toEqual({ firstName: 'Student' });
  });

  it.each([
    { firstName: 123 },
    { password: 'x'.repeat(73) },
    { password: null },
    { photo: { id: 123 } },
  ])('should reject invalid self-service profile fields %j', async (body) => {
    await expect(
      pipe.transform(body, { type: 'body', metatype: AuthUpdateDto }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it('should return a validation error instead of crashing on a numeric email', async () => {
    await expect(
      pipe.transform(
        { email: 123, password: 'password' },
        { type: 'body', metatype: AuthEmailLoginDto },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it.each(['password', 'role', 'status', 'level', 'currentExp'])(
    'should reject null for a mandatory account field %s',
    async (field) => {
      await expect(
        pipe.transform(
          { [field]: null },
          { type: 'body', metatype: UpdateUserDto },
        ),
      ).rejects.toMatchObject({ status: 422 });
    },
  );
  it.each(['filters', 'sort'])(
    'should return a validation error for malformed %s JSON',
    async (property) => {
      await expect(
        pipe.transform(
          { [property]: '{invalid' },
          { type: 'query', metatype: QueryUserDto },
        ),
      ).rejects.toMatchObject({ status: 422 });
    },
  );

  it('should reject arbitrary sorting properties and directions', async () => {
    await expect(
      pipe.transform(
        { sort: JSON.stringify([{ orderBy: 'invalidColumn', order: 'evil' }]) },
        { type: 'query', metatype: QueryUserDto },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('should parse valid nested filters and normalize sorting directions', async () => {
    await expect(
      pipe.transform(
        {
          filters: JSON.stringify({ roles: [{ id: 3 }], position: 'Bậc 1' }),
          sort: JSON.stringify([{ orderBy: 'createdAt', order: 'desc' }]),
        },
        { type: 'query', metatype: QueryUserDto },
      ),
    ).resolves.toMatchObject({
      filters: { roles: [{ id: 3 }], position: 'Bậc 1' },
      sort: [{ orderBy: 'createdAt', order: 'DESC' }],
    });
  });
});
