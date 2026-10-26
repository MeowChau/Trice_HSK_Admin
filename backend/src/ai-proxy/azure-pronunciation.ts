import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface PronunciationAssessment {
  provider: 'azure-speech';
  locale: 'zh-CN';
  score: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  recognizedText: string;
  feedback: string;
  words: { word: string; accuracyScore: number | null; errorType: string }[];
}

function invalidProviderResult(): never {
  throw new BadGatewayException(
    'Azure Speech trả về kết quả chấm không hợp lệ.',
  );
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidProviderResult();
  }
  return value as Record<string, unknown>;
}

function readScore(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    return invalidProviderResult();
  }
  return value;
}

// The app exports mono PCM16 WAV at 16 kHz, capped at 30 seconds.
// Validate the actual chunks rather than trusting the upload's MIME type.
function validateRecording(audio: Buffer): void {
  const invalid = () => {
    throw new BadRequestException(
      'Bản ghi cần là WAV PCM 16-bit, mono, 16 kHz, dài tối đa 30 giây. Vui lòng ghi âm lại.',
    );
  };
  if (
    !Buffer.isBuffer(audio) ||
    audio.length < 44 ||
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE' ||
    audio.readUInt32LE(4) + 8 !== audio.length
  ) {
    return invalid();
  }
  let hasFormat = false;
  let dataSize = 0;
  let offset = 12;
  while (offset + 8 <= audio.length) {
    const name = audio.toString('ascii', offset, offset + 4);
    const size = audio.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > audio.length) return invalid();
    if (name === 'fmt ') {
      if (
        hasFormat ||
        size < 16 ||
        audio.readUInt16LE(start) !== 1 ||
        audio.readUInt16LE(start + 2) !== 1 ||
        audio.readUInt32LE(start + 4) !== 16000 ||
        audio.readUInt32LE(start + 8) !== 32000 ||
        audio.readUInt16LE(start + 12) !== 2 ||
        audio.readUInt16LE(start + 14) !== 16
      ) {
        return invalid();
      }
      hasFormat = true;
    } else if (name === 'data') {
      if (!hasFormat || dataSize || !size || size % 2) return invalid();
      dataSize = size;
    }
    offset = start + size + (size % 2);
  }
  if (
    !hasFormat ||
    !dataSize ||
    dataSize > 30 * 32000 ||
    offset !== audio.length
  ) {
    return invalid();
  }
}

function parseAssessment(value: unknown): PronunciationAssessment {
  const result = asObject(value);
  if (
    ['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout'].includes(
      String(result.RecognitionStatus),
    )
  ) {
    throw new BadRequestException(
      'Chưa nhận diện được giọng nói tiếng Trung. Hãy đọc rõ câu mẫu và ghi âm lại.',
    );
  }
  if (result.RecognitionStatus !== 'Success' || !Array.isArray(result.NBest)) {
    return invalidProviderResult();
  }
  const best = asObject(result.NBest[0]);
  // REST responses use flat scores; SDK-compatible responses can nest them.
  const scores = best.PronunciationAssessment
    ? asObject(best.PronunciationAssessment)
    : best;
  const score = readScore(scores.PronScore);
  const accuracyScore = readScore(scores.AccuracyScore);
  const fluencyScore = readScore(scores.FluencyScore);
  const completenessScore = readScore(scores.CompletenessScore);
  const recognizedText = result.DisplayText ?? best.Display;
  if (
    typeof recognizedText !== 'string' ||
    !recognizedText.trim() ||
    !Array.isArray(best.Words) ||
    !best.Words.length ||
    best.Words.length > 5000
  ) {
    return invalidProviderResult();
  }
  const words = best.Words.map((value: unknown) => {
    const item = asObject(value);
    const assessment = item.PronunciationAssessment
      ? asObject(item.PronunciationAssessment)
      : item;
    if (
      typeof item.Word !== 'string' ||
      !item.Word.trim() ||
      typeof assessment.ErrorType !== 'string' ||
      !assessment.ErrorType
    ) {
      return invalidProviderResult();
    }
    return {
      word: item.Word,
      accuracyScore:
        assessment.AccuracyScore == null
          ? null
          : readScore(assessment.AccuracyScore),
      errorType: assessment.ErrorType,
    };
  });
  const feedback = [
    `Độ chính xác: ${accuracyScore}/100. Độ trôi chảy: ${fluencyScore}/100. Độ đầy đủ: ${completenessScore}/100.`,
  ];
  const omitted = words.filter((word) => word.errorType === 'Omission');
  const mispronounced = words.filter(
    (word) => word.errorType === 'Mispronunciation',
  );
  if (omitted.length) {
    feedback.push(
      `Chưa đọc: ${omitted
        .slice(0, 5)
        .map((item) => item.word)
        .join(', ')}.`,
    );
  }
  if (mispronounced.length) {
    feedback.push(
      `Cần luyện thêm: ${mispronounced
        .slice(0, 5)
        .map((item) => item.word)
        .join(', ')}.`,
    );
  }
  return {
    provider: 'azure-speech',
    locale: 'zh-CN',
    score,
    accuracyScore,
    fluencyScore,
    completenessScore,
    recognizedText,
    feedback: feedback.join(' '),
    words,
  };
}

export async function assessAzurePronunciation(
  audio: Buffer,
  referenceText: string,
  key: string,
  region: string,
): Promise<PronunciationAssessment> {
  validateRecording(audio);
  const parameters = Buffer.from(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Word',
      Dimension: 'Comprehensive',
      EnableMiscue: true,
      // Prosody is an add-on and isn't supported for zh-CN.
      EnableProsodyAssessment: false,
    }),
    'utf8',
  ).toString('base64');
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=zh-CN&format=detailed`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        Accept: 'application/json',
        'Pronunciation-Assessment': parameters,
      },
      body: new Uint8Array(audio),
      signal: AbortSignal.timeout(35000),
      redirect: 'error',
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ['TimeoutError', 'AbortError'].includes(error.name)
    ) {
      throw new GatewayTimeoutException(
        'Azure Speech phản hồi chậm. Bản ghi vẫn còn; vui lòng thử chấm lại.',
      );
    }
    throw new BadGatewayException('Không kết nối được Azure Speech.');
  }
  if (response.status === 401 || response.status === 403) {
    // Provider credentials must never invalidate the app user's JWT session.
    throw new ServiceUnavailableException(
      'Azure Speech chưa xác thực được. Cần kiểm tra key, region và quyền truy cập của resource ở backend.',
    );
  }
  if (response.status === 429) {
    throw new ServiceUnavailableException(
      'Azure Speech đang bận hoặc đã chạm hạn mức. Vui lòng thử lại sau.',
    );
  }
  if (!response.ok) {
    throw new BadGatewayException('Azure Speech chưa xử lý được bản ghi.');
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return invalidProviderResult();
  }
  return parseAssessment(data);
}
