import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PracticeSetsService } from './practice-sets.service';
import { PracticeSetEntity } from './infrastructure/persistence/relational/entities/practice-set.entity';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { QuestionSkillEnum } from '../questions/infrastructure/persistence/relational/entities/question.enum';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';

@ApiTags('Practice Sets')
@Controller({
  path: 'practice-sets',
  version: '1',
})
export class PracticeSetsController {
  constructor(private readonly practiceSetsService: PracticeSetsService) {}

  @ApiOperation({ summary: 'Get practice sets with pagination and filters' })
  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'skill', required: false, enum: QuestionSkillEnum })
  @ApiQuery({ name: 'hskLevel', required: false, type: Number })
  @ApiQuery({ name: 'topic', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('skill') skill?: QuestionSkillEnum,
    @Query('hskLevel') hskLevel?: number,
    @Query('topic') topic?: string,
    @Query('search') search?: string,
  ) {
    return this.practiceSetsService.findWithPagination({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      skill,
      hskLevel: hskLevel ? Number(hskLevel) : undefined,
      topic,
      search,
    });
  }

  @ApiOperation({ summary: 'Get summary statistics of practice sets' })
  @Get('summary')
  @ApiQuery({ name: 'skill', required: false, enum: QuestionSkillEnum })
  getSummary(@Query('skill') skill?: QuestionSkillEnum) {
    return this.practiceSetsService.getSummary(skill);
  }

  @ApiOperation({ summary: 'Get list of topics with statistics' })
  @ApiQuery({ name: 'hskLevel', required: false, type: Number })
  @Get('topics')
  getTopics(@Query('hskLevel') hskLevel?: string) {
    return this.practiceSetsService.getTopicsList(hskLevel ? +hskLevel : undefined);
  }

  @ApiOperation({ summary: 'Get practice set details by ID' })
  @Get(':id')
  getDetails(@Param('id') id: string) {
    return this.practiceSetsService.getDetails(+id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createData: Partial<PracticeSetEntity>,
    @Request() req: any,
  ) {
    return this.practiceSetsService.create(createData, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateData: Partial<PracticeSetEntity>,
    @Request() req: any,
  ) {
    return this.practiceSetsService.update(+id, updateData, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.practiceSetsService.remove(+id, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Put(':id/questions')
  setQuestions(
    @Param('id') id: string,
    @Body() data: { questions: { questionId: number; order: number }[] },
  ) {
    return this.practiceSetsService.setQuestions(+id, data.questions);
  }
}
