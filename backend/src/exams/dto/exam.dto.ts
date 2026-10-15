import { Transform, Type } from 'class-transformer';
import { trimStringTransformer } from '../../utils/transformers/trim-string.transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  ValidateNested,
  IsOptional,
  IsISO8601,
} from 'class-validator';
import { QuestionLinkDto } from '../../utils/dto/question-links.dto';

export class CreateExamDto {
  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(trimStringTransformer)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiProperty({ minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  hskLevel: number;
}

export class CreateExamSectionDto {
  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(trimStringTransformer)
  @IsString()
  @MaxLength(2048)
  audioUrl?: string | null;
}

export class EditExamSectionDto extends CreateExamSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiProperty({ type: [QuestionLinkDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique((question: QuestionLinkDto) => question?.questionId)
  @ValidateNested({ each: true })
  @Type(() => QuestionLinkDto)
  questions: QuestionLinkDto[];
}

export class EditExamDto extends CreateExamDto {
  @ApiProperty()
  @IsISO8601({ strict: true })
  updatedAt: string;

  @ApiProperty({ type: [EditExamSectionDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => EditExamSectionDto)
  sections: EditExamSectionDto[];
}
