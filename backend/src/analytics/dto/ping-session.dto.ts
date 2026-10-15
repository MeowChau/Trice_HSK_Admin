import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class PingSessionDto {
  @ApiProperty({
    example: 100,
    description: 'Duration of the study session ping in seconds',
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(3600)
  durationInSeconds: number;

  @ApiProperty({
    example: 'vocab_practice',
    description: 'Name of the module studied',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  module: string;
}
