import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ExamsService } from './exams.service';
import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Exams')
@Controller({
  path: 'exams',
  version: '1',
})
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post()
  create(@Body() createData: Partial<ExamEntity>) {
    return this.examsService.create(createData);
  }

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('hskLevel') hskLevel?: number,
    @Query('search') search?: string,
  ) {
    return this.examsService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      hskLevel: hskLevel ? Number(hskLevel) : undefined,
      search,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examsService.remove(+id);
  }

  @Post(':id/sections')
  addSection(
    @Param('id') id: string,
    @Body() data: { title: string; order: number; audioUrl?: string },
  ) {
    return this.examsService.addSection(+id, data);
  }

  @Post('sections/:sectionId/questions')
  addQuestionsToSection(
    @Param('sectionId') sectionId: string,
    @Body() data: { questions: { questionId: number; order: number }[] },
  ) {
    return this.examsService.addQuestionsToSection(+sectionId, data.questions);
  }

  @UseInterceptors(CacheInterceptor)
  @CacheKey('exam-details')
  @CacheTTL(60000) // 60 seconds
  @Get(':id')
  getDetails(@Param('id') id: string) {
    return this.examsService.getDetails(+id);
  }
}
