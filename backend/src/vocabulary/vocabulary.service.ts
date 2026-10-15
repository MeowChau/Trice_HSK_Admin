import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabularyEntity } from '../offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';

@Injectable()
export class VocabularyService {
  constructor(
    @InjectRepository(VocabularyEntity)
    private readonly vocabularyRepository: Repository<VocabularyEntity>,
  ) {}

  async findMany(query: {
    page?: number;
    limit?: number;
    hskLevel?: number;
    topic?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.vocabularyRepository.createQueryBuilder('v');

    if (query.hskLevel && !isNaN(Number(query.hskLevel))) {
      qb.andWhere('v.hskLevel = :hskLevel', {
        hskLevel: Number(query.hskLevel),
      });
    }

    if (
      query.topic !== undefined &&
      query.topic !== null &&
      query.topic !== ''
    ) {
      if (query.topic === 'UNASSIGNED') {
        qb.andWhere("(v.topic IS NULL OR v.topic = '')");
      } else {
        qb.andWhere('v.topic = :topic', { topic: query.topic });
      }
    }

    if (query.search && query.search.trim() !== '') {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(v.hanzi ILIKE :term OR v.pinyin ILIKE :term OR v.meaning ILIKE :term)',
        { term },
      );
    }

    qb.orderBy('v.id', 'ASC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const vocab = await this.vocabularyRepository.findOne({ where: { id } });
    if (!vocab) {
      throw new NotFoundException(`Vocabulary #${id} not found`);
    }
    return vocab;
  }

  async create(data: {
    hanzi: string;
    pinyin: string;
    meaning: string;
    hskLevel: number;
    topic?: string | null;
  }) {
    if (!data) {
      throw new NotFoundException('Dữ liệu từ vựng không hợp lệ');
    }
    const vocab = this.vocabularyRepository.create({
      hanzi: data.hanzi ? data.hanzi.trim() : '',
      pinyin: data.pinyin ? data.pinyin.trim() : '',
      meaning: data.meaning ? data.meaning.trim() : '',
      hskLevel: Number(data.hskLevel) || 1,
      topic: data.topic ? data.topic.trim() : null,
    });
    return this.vocabularyRepository.save(vocab);
  }

  async update(
    id: number,
    data?: {
      hanzi?: string;
      pinyin?: string;
      meaning?: string;
      hskLevel?: number;
      topic?: string | null;
    },
  ) {
    const vocab = await this.findOne(id);
    if (!data) return vocab;

    if (data.hanzi !== undefined)
      vocab.hanzi = data.hanzi ? data.hanzi.trim() : vocab.hanzi;
    if (data.pinyin !== undefined)
      vocab.pinyin = data.pinyin ? data.pinyin.trim() : vocab.pinyin;
    if (data.meaning !== undefined)
      vocab.meaning = data.meaning ? data.meaning.trim() : vocab.meaning;
    if (data.hskLevel !== undefined) vocab.hskLevel = Number(data.hskLevel);
    if (data.topic !== undefined)
      vocab.topic = data.topic ? data.topic.trim() : null;

    return this.vocabularyRepository.save(vocab);
  }

  async delete(id: number) {
    const vocab = await this.findOne(id);
    await this.vocabularyRepository.remove(vocab);
    return { success: true, message: `Deleted vocabulary #${id}` };
  }

  async batchAssign(vocabIds: number[], topic: string | null) {
    if (!vocabIds || vocabIds.length === 0) return { updated: 0 };
    const res = await this.vocabularyRepository
      .createQueryBuilder()
      .update(VocabularyEntity)
      .set({ topic: topic ? topic.trim() : null })
      .whereInIds(vocabIds)
      .execute();
    return { updated: res.affected || 0 };
  }

  async getTopicCounts() {
    const counts = await this.vocabularyRepository
      .createQueryBuilder('v')
      .select('v.topic', 'topic')
      .addSelect('v.hskLevel', 'hskLevel')
      .addSelect('COUNT(*)', 'count')
      .where("v.topic IS NOT NULL AND v.topic != ''")
      .groupBy('v.topic')
      .addGroupBy('v.hskLevel')
      .getRawMany();

    const topicCountMap: Record<string, number> = Object.create(null);
    counts.forEach((c) => {
      if (c.topic) {
        topicCountMap[c.topic] =
          (topicCountMap[c.topic] ?? 0) + Number(c.count);
      }
    });

    return topicCountMap;
  }
}
