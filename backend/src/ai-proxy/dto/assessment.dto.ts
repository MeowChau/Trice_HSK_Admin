import { Transform } from 'class-transformer';
import { trimStringTransformer } from '../../utils/transformers/trim-string.transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
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
  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  referenceText: string;
}
