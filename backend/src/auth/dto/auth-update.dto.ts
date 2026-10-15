import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class AuthUpdateDto extends PickType(CreateUserDto, [
  'photo',
  'firstName',
  'lastName',
  'email',
  'password',
] as const) {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'mustBeNotEmpty' })
  @MaxLength(72)
  oldPassword?: string;
}
