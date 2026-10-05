import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VocabularyService } from './vocabulary.service';

@ApiTags('Vocabulary')
@Controller({
  path: 'vocabulary',
  version: '1',
})
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of vocabularies with pagination and filters' })
  async findMany(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('hskLevel') hskLevel?: number,
    @Query('topic') topic?: string,
    @Query('search') search?: string,
  ) {
    return this.vocabularyService.findMany({ page, limit, hskLevel, topic, search });
  }

  @Get('topic-counts')
  @ApiOperation({ summary: 'Get vocabulary counts per topic' })
  async getTopicCounts() {
    return this.vocabularyService.getTopicCounts();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single vocabulary by id' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vocabularyService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new vocabulary' })
  async create(
    @Body()
    body: {
      hanzi: string;
      pinyin: string;
      meaning: string;
      hskLevel: number;
      topic?: string | null;
    },
  ) {
    return this.vocabularyService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vocabulary' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      hanzi?: string;
      pinyin?: string;
      meaning?: string;
      hskLevel?: number;
      topic?: string | null;
    },
  ) {
    return this.vocabularyService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vocabulary' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.vocabularyService.delete(id);
  }

  @Post('batch-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch assign vocabularies to a topic' })
  async batchAssign(
    @Body()
    body: {
      vocabIds: number[];
      topic: string | null;
    },
  ) {
    return this.vocabularyService.batchAssign(body.vocabIds, body.topic);
  }
}
