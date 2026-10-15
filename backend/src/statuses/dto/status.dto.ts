import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { StatusEnum } from '../statuses.enum';

export class StatusDto {
  @ApiProperty()
  @IsIn([StatusEnum.active, StatusEnum.inactive, StatusEnum.pending])
  id: number | string;
}
