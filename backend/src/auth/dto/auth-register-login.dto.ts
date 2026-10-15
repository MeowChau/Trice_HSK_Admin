import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class AuthRegisterLoginDto {
  @ApiProperty({ example: 'test1@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty()
  @MinLength(6)
  @IsString()
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'johndoe123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  username: string;
}
