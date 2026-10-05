import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
  async evaluatePronunciation(_file: any, _referenceText: string) {
    try {
      // Placeholder Azure Cognitive Services Response
      return {
        RecognitionStatus: 'Success',
        PronunciationAssessment: {
          AccuracyScore: 85,
          FluencyScore: 90,
          CompletenessScore: 100,
          PronunciationScore: 88,
        },
        Words: [
          { Word: 'ni', AccuracyScore: 80, ErrorType: 'None' },
          { Word: 'hao', AccuracyScore: 90, ErrorType: 'None' },
        ],
      };
    } catch (error: any) {
      this.logger.error('Azure AI request failed', error);
      throw new InternalServerErrorException(
        'Failed to process Azure AI request',
      );
    }
  }

  async evaluateWriting(
    questionId: string,
    userText: string,
    hskLevel: number,
  ) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        // Fallback for development without key
        return {
          score: 85,
          grammarErrors: [
            { error: 'grammar mistake', correction: 'correction' },
          ],
          feedback:
            'This is a simulated response since GEMINI_API_KEY is not set.',
        };
      }

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const prompt = `Bạn là giám khảo HSK. Hãy chấm bài viết sau của học viên ở cấp độ HSK ${hskLevel}. Bài viết: "${userText}". Hãy trả về ĐÚNG định dạng JSON gồm các trường: 'score' (thang điểm 100), 'grammarErrors' (mảng các lỗi sai và cách sửa: {error, correction}), 'feedback' (nhận xét chung). Không trả về Markdown text nào ngoài JSON.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response
        .text()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(responseText);
    } catch (error) {
      this.logger.error('Failed to process Gemini API request', error);
      throw new InternalServerErrorException(
        'Failed to process Gemini API request',
      );
    }
  }
}
