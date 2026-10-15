import { Exclude, Expose } from 'class-transformer';
import { FileType } from '../../files/domain/file';
import { Role } from '../../roles/domain/role';
import { Status } from '../../statuses/domain/status';
import { ApiProperty } from '@nestjs/swagger';
import databaseConfig from '../../database/config/database.config';
import { DatabaseConfig } from '../../database/config/database-config.type';

// <database-block>
const idType = (databaseConfig() as DatabaseConfig).isDocumentDatabase
  ? String
  : Number;
// </database-block>

export class User {
  @ApiProperty({
    type: () => Date,
    nullable: true,
  })
  @Expose({ groups: ['me', 'admin'] })
  emailVerifiedAt?: Date | null;

  @ApiProperty({
    type: idType,
  })
  id: number | string;

  @ApiProperty({
    type: String,
    example: 'john.doe@example.com',
  })
  @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @Exclude({ toPlainOnly: true })
  password?: string;

  @ApiProperty({
    type: String,
    example: 'email',
  })
  @Expose({ groups: ['me', 'admin'] })
  provider: string;

  @ApiProperty({
    type: String,
    example: '1234567890',
  })
  @Expose({ groups: ['me', 'admin'] })
  socialId?: string | null;

  @ApiProperty({
    type: String,
    example: 'John Doe',
  })
  @Expose({ groups: ['me', 'admin'] })
  fullName?: string | null;

  @ApiProperty({
    type: String,
    example: 'Bậc 1',
  })
  @Expose({ groups: ['me', 'admin'] })
  position?: string | null;

  @ApiProperty({
    type: String,
    example: 'John',
  })
  @Expose({ groups: ['me', 'admin'] })
  firstName?: string | null;

  @ApiProperty({
    type: String,
    example: 'Doe',
  })
  @Expose({ groups: ['me', 'admin'] })
  lastName?: string | null;

  @ApiProperty({
    type: String,
    example: 'johndoe123',
  })
  @Expose({ groups: ['me', 'admin'] })
  username: string;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  level: number;

  @ApiProperty({
    type: Number,
    example: 0,
  })
  currentExp: number;

  @ApiProperty({
    type: String,
    example: 'default-frame',
  })
  avatarFrame: string | null;

  @ApiProperty({
    type: Number,
    example: 3,
    nullable: true,
  })
  @Expose({ groups: ['me', 'admin'] })
  currentHskLevel?: number | null;

  @ApiProperty({
    type: Number,
    example: 6,
    nullable: true,
  })
  @Expose({ groups: ['me', 'admin'] })
  targetHskLevel?: number | null;

  @ApiProperty({
    type: Number,
    example: 30,
    nullable: true,
  })
  dailyStudyTime?: number | null;
  @Expose({ groups: ['me', 'admin'] })
  studentCode?: number | null;

  @ApiProperty({
    type: () => FileType,
  })
  photo?: FileType | null;

  @ApiProperty({
    type: () => Role,
  })
  role?: Role | null;

  @ApiProperty({
    type: () => Status,
  })
  status?: Status;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  deletedAt: Date;
}
