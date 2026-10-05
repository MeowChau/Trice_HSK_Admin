import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class PingSessionDto {
  @ApiProperty({
    example: 100,
    description: 'Duration of the study session ping in seconds',
  })
  @IsNotEmpty()
  @IsNumber()
  durationInSeconds: number;

  @ApiProperty({
    example: 'vocab_practice',
    description: 'Name of the module studied',
  })
  @IsNotEmpty()
  @IsString()
  module: string;
}
