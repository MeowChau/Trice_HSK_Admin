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

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@ApiTags('Me')
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
    @Request() req: any,
    @Body() updateDto: UpdateUserDto,
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
