import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';
import { ExamSectionEntity } from './infrastructure/persistence/relational/entities/exam-section.entity';
import { ExamSectionQuestionEntity } from './infrastructure/persistence/relational/entities/exam-section-question.entity';

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

    const query = this.examRepository
      .createQueryBuilder('exam')
      .leftJoinAndSelect('exam.sections', 'section')
      .leftJoinAndSelect('section.sectionQuestions', 'sectionQuestion');

    if (params?.hskLevel && params.hskLevel >= 1 && params.hskLevel <= 9) {
      query.andWhere('exam.hskLevel = :hskLevel', { hskLevel: params.hskLevel });
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
    await this.examRepository.delete(id);
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

  async getDetails(id: number): Promise<any> {
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
