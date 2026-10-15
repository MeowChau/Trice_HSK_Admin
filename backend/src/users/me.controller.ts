import { ActiveGuard } from '../auth/guards/active.guard';
import {
  Controller,
  Patch,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { User } from './domain/user';
import { UpdateUserDto } from './dto/update-user.dto';
import { StudyGoalsDto } from './dto/study-goals.dto';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { SerializeOptions } from '@nestjs/common';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard)
@ApiTags('Me')
@SerializeOptions({ groups: ['me'] })
@Controller({
  path: 'users/me',
  version: '1',
})
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('study-goals')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: User })
  async updateStudyGoals(
    @Request() req: RequestWithUser<JwtPayloadType>,
    @Body() updateDto: StudyGoalsDto,
  ): Promise<User | null> {
    const allowedUpdates = new UpdateUserDto();
    if (updateDto.currentHskLevel !== undefined) {
      allowedUpdates.currentHskLevel = updateDto.currentHskLevel;
    }
    if (updateDto.targetHskLevel !== undefined) {
      allowedUpdates.targetHskLevel = updateDto.targetHskLevel;
    }
    if (updateDto.dailyStudyTime !== undefined) {
      allowedUpdates.dailyStudyTime = updateDto.dailyStudyTime;
    }

    return this.usersService.update(req.user.id, allowedUpdates);
  }
}
