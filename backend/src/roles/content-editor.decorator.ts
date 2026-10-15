import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ActiveGuard } from '../auth/guards/active.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { RoleEnum } from './roles.enum';

export function ContentEditor() {
  return applyDecorators(
    ApiBearerAuth(),
    Roles(RoleEnum.admin, RoleEnum.teacher),
    UseGuards(AuthGuard('jwt'), ActiveGuard, RolesGuard),
  );
}
