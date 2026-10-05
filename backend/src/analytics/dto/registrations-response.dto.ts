import { ApiProperty } from '@nestjs/swagger';

export class RegistrationsResponseDto {
  @ApiProperty({
    example: 1,
    description: 'The starting month of the 6-month period',
  })
  startMonth: number;

  @ApiProperty({
    example: 6,
    description: 'The ending month of the 6-month period',
  })
  endMonth: number;

  @ApiProperty({
    example: [10, 20, 15, 30, 25, 40],
    type: [Number],
    description: 'Number of new users registered in each of the 6 months',
  })
  newUsers: number[];

  @ApiProperty({
    example: [2, 1, 0, 3, 1, 5],
    type: [Number],
    description: 'Number of new teachers registered in each of the 6 months',
  })
  newTeachers: number[];
}
