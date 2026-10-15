import { Transform, Type } from 'class-transformer';

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FileDto } from '../../files/dto/file.dto';
import { RoleDto } from '../../roles/dto/role.dto';
import { StatusDto } from '../../statuses/dto/status.dto';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class CreateUserDto {
  // Internal only: no validation decorators, so HTTP whitelist strips this field.
  emailVerifiedAt?: Date | null;

  @ApiPropertyOptional({ example: 'test1@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @MinLength(6)
  @MaxLength(72)
  @IsString()
  password?: string;

  provider?: string;

  socialId?: string | null;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string | null;

  @ApiPropertyOptional({ example: 'Bậc 1', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  position?: string | null;

  @ApiPropertyOptional({ example: 'John', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string | null;

  @ApiPropertyOptional({ example: 'Doe', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'teacher123', type: String })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  username?: string;

  @ApiPropertyOptional({ example: 1, type: Number })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  level?: number;

  @ApiPropertyOptional({ example: 0, type: Number })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  currentExp?: number;

  @ApiPropertyOptional({ example: 'frame-1', type: String })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarFrame?: string;

  @ApiPropertyOptional({ example: 3, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  currentHskLevel?: number | null;

  @ApiPropertyOptional({ example: 6, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  targetHskLevel?: number | null;

  @ApiPropertyOptional({ example: 30, type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  dailyStudyTime?: number | null;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  studentCode?: number | null;

  @ApiPropertyOptional({ type: () => FileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FileDto)
  photo?: FileDto | null;

  @ApiPropertyOptional({ type: () => RoleDto })
  @ValidateIf((_object, value) => value !== undefined)
  @ValidateNested()
  @Type(() => RoleDto)
  role?: RoleDto;

  @ApiPropertyOptional({ type: () => StatusDto })
  @ValidateIf((_object, value) => value !== undefined)
  @ValidateNested()
  @Type(() => StatusDto)
  status?: StatusDto;
}
