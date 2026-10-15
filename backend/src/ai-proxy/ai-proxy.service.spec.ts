import {
  BadGatewayException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProxyService } from './ai-proxy.service';

const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
  })),
}));

describe('AiProxyService assessment results', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return an unavailable error instead of a fake writing score when no provider is configured', async () => {
    const service = new AiProxyService(new ConfigService({}));
    await expect(
      service.evaluateWriting('1', '你好', 1),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('should reject missing pronunciation audio', () => {
    const service = new AiProxyService(new ConfigService({}));
    expect(() => service.evaluatePronunciation(undefined, '你好')).toThrow(
      BadRequestException,
    );
  });

  it('should return an unavailable error instead of a fabricated pronunciation score', () => {
    const service = new AiProxyService(new ConfigService({}));
    const file = { buffer: Buffer.from([1]) } as Express.Multer.File;
    expect(() => service.evaluatePronunciation(file, '你好')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('should validate and return a structured writing assessment', async () => {
    const result = {
      score: 90,
      grammarErrors: [{ error: '错字', correction: '汉字' }],
      feedback: 'Good',
    };
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(result) },
    });
    const service = new AiProxyService(
      new ConfigService({ GEMINI_API_KEY: 'unit-test-key' }),
    );
    await expect(service.evaluateWriting('1', '你好', 1)).resolves.toEqual(
      result,
    );
  });

  it.each([
    { score: 200, grammarErrors: [], feedback: 'Invalid score' },
    {
      score: 90,
      grammarErrors: [{ error: 99, correction: '字' }],
      feedback: 'Invalid error',
    },
    {
      score: 90,
      grammarErrors: [],
      feedback: 'Extra fields',
      unexpected: true,
    },
    [],
    null,
  ])('should reject malformed provider output %j', async (result) => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(result) },
    });
    const service = new AiProxyService(
      new ConfigService({ GEMINI_API_KEY: 'unit-test-key' }),
    );
    await expect(
      service.evaluateWriting('1', '你好', 1),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
