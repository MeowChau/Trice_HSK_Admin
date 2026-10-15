import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class AuthEmailLoginDto {
  @ApiProperty({ example: 'test1@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  password: string;
}
