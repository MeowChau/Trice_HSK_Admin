import { Transform } from 'class-transformer';
import { trimStringTransformer } from '../../utils/transformers/trim-string.transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  Matches,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';

export class WritingAssessmentDto {
  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  questionId: string;

  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  userText: string;

  @ApiProperty({ minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  hskLevel: number;
}

export class PronunciationAssessmentDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{8,100}$/)
  attemptId?: string;

  @IsOptional()
  @IsIn(['exam', 'set'])
  kind?: 'exam' | 'set';

  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,9}$/)
  sourceId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,9}$/)
  questionId?: string;

  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  referenceText: string;
}
