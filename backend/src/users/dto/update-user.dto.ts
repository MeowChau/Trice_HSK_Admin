import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsOptional, MinLength } from 'class-validator';
import { FileDto } from '../../files/dto/file.dto';
import { RoleDto } from '../../roles/dto/role.dto';
import { StatusDto } from '../../statuses/dto/status.dto';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'test1@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @MinLength(6)
  password?: string;

  provider?: string;

  socialId?: string | null;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A', type: String })
  @IsOptional()
  fullName?: string | null;

  @ApiPropertyOptional({ example: 'Bậc 1', type: String })
  @IsOptional()
  position?: string | null;

  @ApiPropertyOptional({ example: 'John', type: String })
  @IsOptional()
  firstName?: string | null;

  @ApiPropertyOptional({ example: 'Doe', type: String })
  @IsOptional()
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'teacher123', type: String })
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 1, type: Number })
  @IsOptional()
  level?: number;

  @ApiPropertyOptional({ example: 0, type: Number })
  @IsOptional()
  currentExp?: number;

  @ApiPropertyOptional({ example: 'frame-1', type: String })
  @IsOptional()
  avatarFrame?: string;

  @ApiPropertyOptional({ example: 3, type: Number })
  @IsOptional()
  currentHskLevel?: number | null;

  @ApiPropertyOptional({ example: 6, type: Number })
  @IsOptional()
  targetHskLevel?: number | null;

  @ApiPropertyOptional({ example: 30, type: Number })
  @IsOptional()
  dailyStudyTime?: number | null;

  @ApiPropertyOptional({ type: Number, example: 1 })
  @IsOptional()
  studentCode?: number | null;

  @ApiPropertyOptional({ type: () => FileDto })
  @IsOptional()
  photo?: FileDto | null;

  @ApiPropertyOptional({ type: () => RoleDto })
  @IsOptional()
  @Type(() => RoleDto)
  role?: RoleDto | null;

  @ApiPropertyOptional({ type: () => StatusDto })
  @IsOptional()
  @Type(() => StatusDto)
  status?: StatusDto;
}
