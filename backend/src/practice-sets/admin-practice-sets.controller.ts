import { Controller, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { PracticeSetsService } from './practice-sets.service';
import { PracticeSetEntity } from './infrastructure/persistence/relational/entities/practice-set.entity';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Admin Practice Sets')
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.teacher)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'admin/practice-sets',
  version: '1',
})
export class AdminPracticeSetsController {
  constructor(private readonly practiceSetsService: PracticeSetsService) {}

  @Post()
  create(@Body() createData: Partial<PracticeSetEntity>) {
    return this.practiceSetsService.create(createData);
  }

  @Put(':id/questions')
  setQuestions(
    @Param('id') id: string,
    @Body() data: { questions: { questionId: number; order: number }[] },
  ) {
    return this.practiceSetsService.setQuestions(+id, data.questions);
  }
}
