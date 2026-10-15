import { Transform } from 'class-transformer';
import { trimStringTransformer } from '../../utils/transformers/trim-string.transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateVocabularyDto {
  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  hanzi: string;

  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  pinyin: string;

  @ApiProperty()
  @Transform(trimStringTransformer)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  meaning: string;

  @ApiProperty({ minimum: 1, maximum: 9 })
  @IsInt()
  @Min(1)
  @Max(9)
  hskLevel: number;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(trimStringTransformer)
  @IsString()
  @MaxLength(255)
  topic?: string | null;
}

export class UpdateVocabularyDto extends PartialType(CreateVocabularyDto, {
  skipNullProperties: false,
}) {}

export class BatchAssignVocabularyDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  vocabIds: number[];

  @ApiProperty({ nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @Transform(trimStringTransformer)
  @IsString()
  @MaxLength(255)
  topic: string | null;
}
