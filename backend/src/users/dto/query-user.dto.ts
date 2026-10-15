import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsIn,
  IsArray,
  IsObject,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { User } from '../domain/user';
import { RoleDto } from '../../roles/dto/role.dto';
import { StatusDto } from '../../statuses/dto/status.dto';
import { parseJsonQuery } from '../../utils/transformers/json-query.transformer';

export class FilterUserDto {
  @ApiPropertyOptional({ type: [RoleDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => RoleDto)
  roles?: RoleDto[] | null;

  @ApiPropertyOptional({ type: [StatusDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => StatusDto)
  statuses?: StatusDto[] | null;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  currentHskLevel?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  position?: string;
}

export class SortUserDto {
  @ApiProperty()
  @Type(() => String)
  @IsString()
  @IsIn([
    'id',
    'email',
    'username',
    'fullName',
    'position',
    'firstName',
    'lastName',
    'level',
    'currentExp',
    'avatarFrame',
    'currentHskLevel',
    'targetHskLevel',
    'dailyStudyTime',
    'studentCode',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'role',
    'status',
  ])
  orderBy: keyof User;

  @ApiProperty()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  order: 'ASC' | 'DESC';
}

export class QueryUserDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsInt()
  @Min(1)
  @Max(1000000)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) =>
    value
      ? plainToInstance(FilterUserDto, parseJsonQuery(value, 'filters'))
      : undefined,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => FilterUserDto)
  filters?: FilterUserDto | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Transform(({ value }) => {
    return value
      ? plainToInstance(SortUserDto, parseJsonQuery(value, 'sort'))
      : undefined;
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SortUserDto)
  sort?: SortUserDto[] | null;
}
