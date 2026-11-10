import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { HskQueryDto } from '../utils/dto/content-query.dto';
import { SKILLS, LearningSkill } from './score-types';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';
export class SubmitLearningScoreDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{8,100}$/)
  attemptId: string;
  @ApiProperty({ enum: ['exam', 'set'] }) @IsIn(['exam', 'set']) kind:
    | 'exam'
    | 'set';
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) sourceId: number;
  @ApiProperty() @IsObject() answers: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() writingProgress?: Record<
    string,
    unknown
  >;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(604800)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  startedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  sourceVersion?: string;
}

export class LearningHistoryQueryDto extends HskQueryDto {
  @ApiPropertyOptional({ enum: ['exam', 'set'] })
  @IsOptional()
  @IsIn(['exam', 'set'])
  kind?: 'exam' | 'set';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  sourceId?: number;

  @ApiPropertyOptional({ enum: SKILLS })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? SKILLS.find((skill) => skill.toLowerCase() === value.toLowerCase()) ||
        value
      : value,
  )
  @IsIn(SKILLS)
  skill?: LearningSkill;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;
}
export class ScoreLevelQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1)
  @Matches(/^[1-9]$/)
  hskLevel?: string;
}
