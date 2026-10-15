import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RoleEnum } from '../roles.enum';

export class RoleDto {
  @ApiProperty()
  @IsIn([RoleEnum.admin, RoleEnum.user, RoleEnum.teacher])
  id: number | string;
}
