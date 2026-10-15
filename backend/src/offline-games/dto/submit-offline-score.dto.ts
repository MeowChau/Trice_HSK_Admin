import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class SubmitOfflineScoreDto {
  @ApiProperty({ example: 1500 })
  @IsNotEmpty()
  @IsInt()
  @Max(2147483647)
  @Min(0)
  score: number;
}
