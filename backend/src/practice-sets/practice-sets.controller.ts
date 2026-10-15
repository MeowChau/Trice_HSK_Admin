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
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PracticeSetsService } from './practice-sets.service';
import {
  CreatePracticeSetDto,
  UpdatePracticeSetDto,
} from './dto/practice-set.dto';
import {
  PracticeSetQueryDto,
  HskQueryDto,
} from '../utils/dto/content-query.dto';
import { QuestionLinksDto } from '../utils/dto/question-links.dto';
import { ContentEditor } from '../roles/content-editor.decorator';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

@ApiTags('Practice Sets')
@Controller({ path: 'practice-sets', version: '1' })
export class PracticeSetsController {
  constructor(private readonly practiceSetsService: PracticeSetsService) {}

  @Get()
  findAll(@Query() query: PracticeSetQueryDto) {
    return this.practiceSetsService.findWithPagination(query);
  }

  @Get('summary')
  getSummary(@Query() query: PracticeSetQueryDto) {
    return this.practiceSetsService.getSummary(query.skill);
  }

  @Get('topics')
  getTopics(@Query() query: HskQueryDto) {
    return this.practiceSetsService.getTopicsList(query.hskLevel);
  }

  @Get(':id')
  getDetails(@Param('id', ParseIntPipe) id: number) {
    return this.practiceSetsService.getDetails(id);
  }

  @ContentEditor()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() data: CreatePracticeSetDto,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.practiceSetsService.create(data, req.user);
  }

  @ContentEditor()
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdatePracticeSetDto,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.practiceSetsService.update(id, data, req.user);
  }

  @ContentEditor()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.practiceSetsService.remove(id, req.user);
  }

  @ContentEditor()
  @Put(':id/questions')
  setQuestions(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: QuestionLinksDto,
  ) {
    return this.practiceSetsService.setQuestions(id, data.questions);
  }
}
