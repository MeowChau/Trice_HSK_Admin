import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuestionLinkDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  questionId: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order: number;
}

export class QuestionLinksDto {
  @ApiProperty({ type: [QuestionLinkDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique((question: QuestionLinkDto) => question?.questionId)
  @ValidateNested({ each: true })
  @Type(() => QuestionLinkDto)
  questions: QuestionLinkDto[];
}
