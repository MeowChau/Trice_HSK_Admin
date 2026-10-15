import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExamsService } from './exams.service';
import {
  CreateExamDto,
  CreateExamSectionDto,
  EditExamDto,
} from './dto/exam.dto';
import { HskQueryDto } from '../utils/dto/content-query.dto';
import { QuestionLinksDto } from '../utils/dto/question-links.dto';
import { ContentEditor } from '../roles/content-editor.decorator';
import { publicExam } from './exam-view';

@ApiTags('Exams')
@Controller({ path: 'exams', version: '1' })
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @ContentEditor()
  @Post()
  create(@Body() data: CreateExamDto) {
    return this.examsService.create(data);
  }

  @Get()
  findAll(@Query() query: HskQueryDto) {
    return this.examsService.findAll(query);
  }

  @ContentEditor()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.remove(id);
  }

  @ContentEditor()
  @Post(':id/sections')
  addSection(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: CreateExamSectionDto,
  ) {
    return this.examsService.addSection(id, data);
  }

  @ContentEditor()
  @Post('sections/:sectionId/questions')
  addQuestionsToSection(
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() data: QuestionLinksDto,
  ) {
    return this.examsService.addQuestionsToSection(sectionId, data.questions);
  }

  @Get(':id')
  async getDetails(@Param('id', ParseIntPipe) id: number) {
    return publicExam(await this.examsService.getDetails(id));
  }

  @ContentEditor()
  @Get(':id/editor')
  getEditor(@Param('id', ParseIntPipe) id: number) {
    return this.examsService.getDetails(id);
  }

  @ContentEditor()
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: EditExamDto) {
    return this.examsService.update(id, data);
  }
}
