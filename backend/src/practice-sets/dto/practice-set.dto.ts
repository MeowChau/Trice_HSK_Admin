import { Transform } from 'class-transformer';
import { trimStringTransformer } from '../../utils/transformers/trim-string.transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { QuestionSkillEnum } from '../../questions/infrastructure/persistence/relational/entities/question.enum';

export class CreatePracticeSetDto {
  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  topic: string;

  @ApiProperty({ enum: QuestionSkillEnum })
  @IsEnum(QuestionSkillEnum)
  skill: QuestionSkillEnum;

  @ApiProperty({ minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  hskLevel: number;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(trimStringTransformer)
  @IsString()
  @MaxLength(2048)
  audioUrl?: string | null;
}

export class UpdatePracticeSetDto extends PartialType(CreatePracticeSetDto, {
  skipNullProperties: false,
}) {}
