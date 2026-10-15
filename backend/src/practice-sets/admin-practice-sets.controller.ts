import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PracticeSetsService } from './practice-sets.service';
import { CreatePracticeSetDto } from './dto/practice-set.dto';
import { QuestionLinksDto } from '../utils/dto/question-links.dto';
import { ContentEditor } from '../roles/content-editor.decorator';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

@ApiTags('Admin Practice Sets')
@ContentEditor()
@Controller({ path: 'admin/practice-sets', version: '1' })
export class AdminPracticeSetsController {
  constructor(private readonly practiceSetsService: PracticeSetsService) {}

  @Post()
  create(
    @Body() data: CreatePracticeSetDto,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.practiceSetsService.create(data, req.user);
  }

  @Put(':id/questions')
  setQuestions(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: QuestionLinksDto,
  ) {
    return this.practiceSetsService.setQuestions(id, data.questions);
  }
}
