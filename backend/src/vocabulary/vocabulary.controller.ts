import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VocabularyService } from './vocabulary.service';
import {
  BatchAssignVocabularyDto,
  CreateVocabularyDto,
  UpdateVocabularyDto,
} from './dto/vocabulary.dto';
import { VocabularyQueryDto } from '../utils/dto/content-query.dto';
import { ContentEditor } from '../roles/content-editor.decorator';

@ApiTags('Vocabulary')
@Controller({ path: 'vocabulary', version: '1' })
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get()
  findMany(@Query() query: VocabularyQueryDto) {
    return this.vocabularyService.findMany(query);
  }

  @Get('topic-counts')
  getTopicCounts() {
    return this.vocabularyService.getTopicCounts();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vocabularyService.findOne(id);
  }

  @ContentEditor()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() data: CreateVocabularyDto) {
    return this.vocabularyService.create(data);
  }

  @ContentEditor()
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateVocabularyDto,
  ) {
    return this.vocabularyService.update(id, data);
  }

  @ContentEditor()
  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.vocabularyService.delete(id);
  }

  @ContentEditor()
  @Post('batch-assign')
  @HttpCode(HttpStatus.OK)
  batchAssign(@Body() data: BatchAssignVocabularyDto) {
    return this.vocabularyService.batchAssign(data.vocabIds, data.topic);
  }
}
