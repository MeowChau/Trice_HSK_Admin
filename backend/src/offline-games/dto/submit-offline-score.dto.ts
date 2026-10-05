import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class SubmitOfflineScoreDto {
  @ApiProperty({ example: 1500 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  score: number;
}
