import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AuthResetPasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(4096)
  hash: string;
}
