import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  QuestionSkillEnum,
  QuestionTypeEnum,
} from '../../questions/infrastructure/persistence/relational/entities/question.enum';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;
}

export class HskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  hskLevel?: number;
}

export class PracticeSetQueryDto extends HskQueryDto {
  @ApiPropertyOptional({ enum: QuestionSkillEnum })
  @IsOptional()
  @IsEnum(QuestionSkillEnum)
  skill?: QuestionSkillEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  topic?: string;
}

export class QuestionQueryDto extends HskQueryDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  sourceLesson?: number;

  @ApiPropertyOptional({
    enum: ['ready', 'needs_audio', 'needs_answer', 'needs_review'],
  })
  @IsOptional()
  @IsEnum({
    ready: 'ready',
    needs_audio: 'needs_audio',
    needs_answer: 'needs_answer',
    needs_review: 'needs_review',
  })
  preparation?: 'ready' | 'needs_audio' | 'needs_answer' | 'needs_review';

  @ApiPropertyOptional({ enum: QuestionSkillEnum })
  @IsOptional()
  @IsEnum(QuestionSkillEnum)
  skill?: QuestionSkillEnum;

  @ApiPropertyOptional({ enum: QuestionTypeEnum })
  @IsOptional()
  @IsEnum(QuestionTypeEnum)
  type?: QuestionTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  difficulty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isGameQuestion?: boolean;
}

export class VocabularyQueryDto extends HskQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  topic?: string;
}

export class LeaderboardQueryDto extends HskQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'month', 'week'] })
  @IsOptional()
  @IsEnum({ all: 'all', month: 'month', week: 'week' })
  timeframe?: 'all' | 'month' | 'week';
}

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}
