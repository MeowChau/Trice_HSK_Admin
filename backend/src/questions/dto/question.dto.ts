import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  QuestionSkillEnum,
  QuestionTypeEnum,
} from '../infrastructure/persistence/relational/entities/question.enum';

export class CreateQuestionDto {
  @ApiProperty({ enum: QuestionTypeEnum })
  @IsEnum(QuestionTypeEnum)
  type: QuestionTypeEnum;

  @ApiProperty({ enum: QuestionSkillEnum })
  @IsEnum(QuestionSkillEnum)
  skill: QuestionSkillEnum;

  @ApiProperty()
  @IsInt()
  @Min(1)
  difficulty: number;

  @ApiProperty({ minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  hskLevel: number;

  @ApiProperty({ type: Object })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsObject()
  correctAnswer?: Record<string, unknown> | null;

  @ApiPropertyOptional({ default: false })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isGameQuestion?: boolean;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto, {
  skipNullProperties: false,
}) {}
