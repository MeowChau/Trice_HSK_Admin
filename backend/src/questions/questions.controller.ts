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
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/question.dto';
import { QuestionQueryDto } from '../utils/dto/content-query.dto';
import { ContentEditor } from '../roles/content-editor.decorator';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

@ApiTags('Questions')
@Controller({ path: 'questions', version: '1' })
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @ContentEditor()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() data: CreateQuestionDto,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.questionsService.create(data, req.user);
  }

  @ContentEditor()
  @Get()
  findAll(@Query() query: QuestionQueryDto) {
    return this.questionsService.findWithPagination(query);
  }

  @ContentEditor()
  @Get('summary')
  getSummary() {
    return this.questionsService.getSummary();
  }

  @ContentEditor()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.questionsService.findOne(id);
  }

  @ContentEditor()
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateQuestionDto,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.questionsService.update(id, data, req.user);
  }

  @ContentEditor()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.questionsService.remove(id, req.user);
  }
}
