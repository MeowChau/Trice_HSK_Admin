import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';
import { ExamSectionEntity } from './infrastructure/persistence/relational/entities/exam-section.entity';
import { ExamSectionQuestionEntity } from './infrastructure/persistence/relational/entities/exam-section-question.entity';
import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import { EditExamDto } from './dto/exam.dto';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(ExamEntity)
    private readonly examRepository: Repository<ExamEntity>,
    @InjectRepository(ExamSectionEntity)
    private readonly examSectionRepository: Repository<ExamSectionEntity>,
    @InjectRepository(ExamSectionQuestionEntity)
    private readonly examSectionQuestionRepository: Repository<ExamSectionQuestionEntity>,
  ) {}

  async create(createData: Partial<ExamEntity>): Promise<ExamEntity> {
    const exam = this.examRepository.create(createData);
    return this.examRepository.save(exam);
  }

  async findAll(params?: {
    hskLevel?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 10));
    const skip = (page - 1) * limit;

    const query = this.examRepository.createQueryBuilder('exam');

    if (params?.hskLevel && params.hskLevel >= 1 && params.hskLevel <= 9) {
      query.andWhere('exam.hskLevel = :hskLevel', {
        hskLevel: params.hskLevel,
      });
    }

    if (params?.search && params.search.trim()) {
      query.andWhere(
        '(LOWER(exam.title) LIKE :term OR LOWER(exam.description) LIKE :term)',
        {
          term: `%${params.search.trim().toLowerCase()}%`,
        },
      );
    }

    query.orderBy('exam.id', 'DESC').skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    const sections = data.length
      ? await this.examSectionRepository.find({
          where: { examId: In(data.map((exam) => exam.id)) },
          relations: ['sectionQuestions'],
        })
      : [];
    const sectionsByExam = new Map<number, ExamSectionEntity[]>();
    for (const section of sections) {
      const group = sectionsByExam.get(section.examId) || [];
      group.push(section);
      sectionsByExam.set(section.examId, group);
    }
    for (const exam of data) exam.sections = sectionsByExam.get(exam.id) || [];
    const formattedData = data.map((exam) => {
      let totalQuestions = 0;
      if (exam.sections) {
        exam.sections.forEach((sec) => {
          totalQuestions += sec.sectionQuestions?.length || 0;
        });
      }
      return {
        ...exam,
        totalSections: exam.sections?.length || 0,
        totalQuestions,
      };
    });

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async remove(id: number): Promise<void> {
    const result = await this.examRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }
  }

  async update(id: number, data: EditExamDto): Promise<ExamEntity> {
    await this.examRepository.manager.transaction(async (manager) => {
      const exams = manager.getRepository(ExamEntity);
      const exam = await exams.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!exam) throw new NotFoundException('Exam not found');
      if (
        exam.updatedAt.toISOString() !== new Date(data.updatedAt).toISOString()
      ) {
        throw new ConflictException(
          'Đề đã được sửa ở nơi khác. Tải lại trước khi lưu.',
        );
      }
      const sections = manager.getRepository(ExamSectionEntity);
      const old = await sections.find({ where: { examId: id } });
      const ids = data.sections.flatMap((section) =>
        section.id ? [section.id] : [],
      );
      const questions = data.sections.flatMap((section) => section.questions);
      const questionIds = questions.map((question) => question.questionId);
      if (
        new Set(ids).size !== ids.length ||
        ids.some(
          (sectionId) => !old.some((section) => section.id === sectionId),
        ) ||
        new Set(data.sections.map((section) => section.order)).size !==
          data.sections.length ||
        new Set(questionIds).size !== questionIds.length ||
        data.sections.some(
          (section) =>
            new Set(section.questions.map((q) => q.order)).size !==
            section.questions.length,
        )
      ) {
        throw new BadRequestException(
          'Phần thi, câu hỏi hoặc thứ tự bị trùng / không thuộc đề.',
        );
      }
      const found = questionIds.length
        ? await manager
            .getRepository(QuestionEntity)
            .findBy({ id: In(questionIds) })
        : [];
      if (
        found.length !== questionIds.length ||
        found.some((question) => question.hskLevel !== data.hskLevel)
      ) {
        throw new BadRequestException(
          'Câu hỏi không tồn tại hoặc khác cấp HSK của đề.',
        );
      }
      const removed = old
        .filter((section) => !ids.includes(section.id))
        .map((section) => section.id);
      if (removed.length) await sections.delete(removed);
      const links = manager.getRepository(ExamSectionQuestionEntity);
      for (const section of data.sections) {
        const saved = await sections.save(
          sections.create({
            id: section.id,
            examId: id,
            title: section.title,
            order: section.order,
            audioUrl: section.audioUrl ?? null,
          }),
        );
        await links.delete({ sectionId: saved.id });
        if (section.questions.length)
          await links.insert(
            section.questions.map((q) => ({ ...q, sectionId: saved.id })),
          );
      }
      await exams.update(id, {
        title: data.title,
        description: data.description ?? null,
        hskLevel: data.hskLevel,
      });
    });
    return this.getDetails(id);
  }

  async addSection(
    examId: number,
    data: { title: string; order: number; audioUrl?: string | null },
  ): Promise<ExamSectionEntity> {
    const exam = await this.examRepository.findOne({ where: { id: examId } });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    const section = this.examSectionRepository.create({
      examId,
      title: data.title,
      order: data.order,
      audioUrl: data.audioUrl ?? null,
    });
    return this.examSectionRepository.save(section);
  }

  async addQuestionsToSection(
    sectionId: number,
    questions: { questionId: number; order: number }[],
  ): Promise<void> {
    const section = await this.examSectionRepository.findOne({
      where: { id: sectionId },
    });
    if (!section) {
      throw new NotFoundException(`Section with ID ${sectionId} not found`);
    }

    const sectionQuestions = questions.map((q) =>
      this.examSectionQuestionRepository.create({
        sectionId,
        questionId: q.questionId,
        order: q.order,
      }),
    );
    await this.examSectionQuestionRepository.save(sectionQuestions);
  }

  async getDetails(id: number): Promise<ExamEntity> {
    const exam = await this.examRepository.findOne({
      where: { id },
      relations: [
        'sections',
        'sections.sectionQuestions',
        'sections.sectionQuestions.question',
      ],
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    // Sort sections by order
    exam.sections.sort((a, b) => a.order - b.order);

    // Sort questions within sections by order
    for (const section of exam.sections) {
      if (section.sectionQuestions) {
        section.sectionQuestions.sort((a, b) => a.order - b.order);
      }
    }

    return exam;
  }
}
