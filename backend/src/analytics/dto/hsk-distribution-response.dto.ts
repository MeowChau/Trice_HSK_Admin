import { ApiProperty } from '@nestjs/swagger';

export class HskDistributionResponseDto {
  @ApiProperty({
    example: [10, 5, 2, 1, 0, 0, 0, 0, 0],
    type: [Number],
    description: 'Distribution of current HSK levels from HSK 1 to 9',
  })
  currentHsk: number[];

  @ApiProperty({
    example: [0, 0, 5, 10, 20, 15, 2, 1, 0],
    type: [Number],
    description: 'Distribution of target HSK levels from HSK 1 to 9',
  })
  targetHsk: number[];
}
