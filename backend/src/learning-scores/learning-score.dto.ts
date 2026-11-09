import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
}
export class ScoreLevelQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1)
  @Matches(/^[1-9]$/)
  hskLevel?: string;
}
