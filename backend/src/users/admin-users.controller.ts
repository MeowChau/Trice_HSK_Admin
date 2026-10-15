import { ActiveGuard } from '../auth/guards/active.guard';
import { UserIdPipe } from '../utils/pipes/user-id.pipe';
import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  SerializeOptions,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { User } from './domain/user';
import { UsersService } from './users.service';
import { RolesGuard } from '../roles/roles.guard';
import { StatusEnum } from '../statuses/statuses.enum';

@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), ActiveGuard, RolesGuard)
@ApiTags('Admin Users')
@Controller({
  path: 'admin/users',
  version: '1',
})
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiCreatedResponse({
    type: User,
    description: 'Create a new user (automatically sets status to active)',
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProfileDto: CreateUserDto): Promise<User> {
    createProfileDto.status = { id: StatusEnum.active }; // Admin created users are active
    return this.usersService.create(createProfileDto);
  }

  @ApiCreatedResponse({
    type: User,
    description: 'Create a new teacher account',
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Post('teacher')
  @HttpCode(HttpStatus.CREATED)
  createTeacher(@Body() createProfileDto: CreateUserDto): Promise<User> {
    createProfileDto.role = { id: RoleEnum.teacher };
    createProfileDto.status = { id: StatusEnum.active }; // Teachers are active by default
    return this.usersService.create(createProfileDto);
  }

  @ApiOkResponse({
    type: User,
    description: 'Approve a user account (set status to active)',
  })
  @SerializeOptions({
    groups: ['admin'],
  })
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  approve(@Param('id', UserIdPipe) id: User['id']): Promise<User | null> {
    const updateProfileDto = new UpdateUserDto();
    updateProfileDto.status = { id: StatusEnum.active };
    return this.usersService.update(id, updateProfileDto);
  }
}
