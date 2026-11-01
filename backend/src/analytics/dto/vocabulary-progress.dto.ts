import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export class VocabularyProgressDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  vocabularyId: number;

  @ApiProperty({ enum: ['studied', 'remembered', 'unknown'] })
  @IsIn(['studied', 'remembered', 'unknown'])
  action: 'studied' | 'remembered' | 'unknown';
}
