import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class StudyGoalsDto extends PickType(CreateUserDto, [
  'currentHskLevel',
  'targetHskLevel',
  'dailyStudyTime',
] as const) {}
