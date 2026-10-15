import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { UserIdPipe } from './user-id.pipe';
import { AllConfigType } from '../../config/config.type';

describe('UserIdPipe', () => {
  const relational = new UserIdPipe(
    new ConfigService<AllConfigType>({
      database: { isDocumentDatabase: false },
    }),
  );
  const document = new UserIdPipe(
    new ConfigService<AllConfigType>({
      database: { isDocumentDatabase: true },
    }),
  );

  it('should normalize relational IDs so a user can update their own email without a false conflict', () => {
    expect(relational.transform('7')).toBe(7);
  });

  it.each(['bad', '0', '-1', '1.5', '2147483648'])(
    'should reject invalid relational ID %s',
    (value) => {
      expect(() => relational.transform(value)).toThrow(BadRequestException);
    },
  );

  it('should preserve valid MongoDB IDs', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(document.transform(id)).toBe(id);
    expect(() => document.transform('7')).toThrow(BadRequestException);
  });
});
