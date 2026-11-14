import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class StudyGoalsDto extends PickType(CreateUserDto, [
  'currentHskLevel',
  'targetHskLevel',
  'dailyStudyTime',
] as const) {}

export function assertHskStudyGoals(
  current?: number | null,
  target?: number | null,
): void {
  if (current != null && target != null && current > target) {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: {
        targetHskLevel:
          'Cấp độ HSK mục tiêu phải bằng hoặc cao hơn cấp độ hiện tại.',
      },
    });
  }
}
