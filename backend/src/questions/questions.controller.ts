import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionEntity } from './infrastructure/persistence/relational/entities/question.entity';
import { QuestionSkillEnum, QuestionTypeEnum } from './infrastructure/persistence/relational/entities/question.enum';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';

@ApiTags('Questions')
@Controller({
  path: 'questions',
  version: '1',
})
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createData: Partial<QuestionEntity>, @Request() req: any) {
    return this.questionsService.create(createData, req.user);
  }

  @ApiOperation({ summary: 'Get list of questions with pagination and filters' })
  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('hskLevel') hskLevel?: number,
    @Query('skill') skill?: QuestionSkillEnum,
    @Query('type') type?: QuestionTypeEnum,
    @Query('difficulty') difficulty?: number,
    @Query('isGameQuestion') isGameQuestion?: string,
    @Query('search') search?: string,
  ) {
    return this.questionsService.findWithPagination({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      hskLevel: hskLevel ? Number(hskLevel) : undefined,
      skill,
      type,
      difficulty: difficulty ? Number(difficulty) : undefined,
      isGameQuestion:
        isGameQuestion === 'true'
          ? true
          : isGameQuestion === 'false'
            ? false
            : undefined,
      search,
    });
  }

  @ApiOperation({ summary: 'Get statistics summary of questions' })
  @Get('summary')
  getSummary() {
    return this.questionsService.getSummary();
  }

  @ApiOperation({ summary: 'Get question details by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(Number(id));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateData: Partial<QuestionEntity>,
    @Request() req: any,
  ) {
    return this.questionsService.update(Number(id), updateData, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.questionsService.remove(Number(id), req.user);
  }
}
