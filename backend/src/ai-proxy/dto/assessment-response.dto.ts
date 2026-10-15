import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class GrammarErrorDto {
  @IsString()
  @MaxLength(5000)
  error: string;

  @IsString()
  @MaxLength(5000)
  correction: string;
}

export class WritingAssessmentResponseDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsArray()
  @ArrayMaxSize(100)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => GrammarErrorDto)
  grammarErrors: GrammarErrorDto[];

  @IsString()
  @MaxLength(10000)
  feedback: string;
}
