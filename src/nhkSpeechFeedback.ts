export type NhkSpeechFeedbackMode = 'shadow' | 'recap';

export type NhkSpeechSubstitution = {
  expected: string;
  heard: string;
};

export type NhkParticleIssue = {
  expected: string;
  heard: string;
  context: string;
};

type NhkSpeechFeedbackBase = {
  version: 1;
  expectedText: string;
  transcript: string;
  durationSeconds: number;
  usedFallback: boolean;
};

export type NhkShadowSpeechFeedback = NhkSpeechFeedbackBase & {
  mode: 'shadow';
  omissions: string[];
  substitutions: NhkSpeechSubstitution[];
  particleIssues: NhkParticleIssue[];
  retryTip: string;
  accuracyPercent: number;
};

export type NhkRecapSpeechFeedback = NhkSpeechFeedbackBase & {
  mode: 'recap';
  minimalRevision: string;
  naturalJapanese: string;
  missingFacts: string[];
  linkageFeedback: string;
  naturalnessFeedback: string;
};

export type NhkSpeechFeedbackResult = NhkShadowSpeechFeedback | NhkRecapSpeechFeedback;

export type DeterministicShadowDiff = Pick<
  NhkShadowSpeechFeedback,
  'omissions' | 'substitutions' | 'particleIssues' | 'retryTip' | 'accuracyPercent'
>;

export const MAX_RECORDING_SECONDS = 60;
export const MAX_AUDIO_BYTES = 1_500_000;
export const MAX_AUDIO_BASE64_LENGTH = 2_000_000;

export const SUPPORTED_SPEECH_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
] as const;

const PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'の']);
const DIFF_LIMIT = 320;

const clean = (value: unknown, max: number): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const finiteDuration = (value: unknown): number => {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_RECORDING_SECONDS) return 0;
  return Math.max(1, Math.round(duration));
};

const boundedTextList = (value: unknown, maxItems: number, maxLength: number): string[] => Array.isArray(value)
  ? value.map(item => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
  : [];

export const normalizeSpeechMimeType = (value: string): string => value.split(';', 1)[0].trim().toLowerCase();

export const isSupportedSpeechMimeType = (value: string): boolean =>
  SUPPORTED_SPEECH_MIME_TYPES.includes(normalizeSpeechMimeType(value) as typeof SUPPORTED_SPEECH_MIME_TYPES[number]);

export const estimateBase64Length = (byteLength: number): number => Math.ceil(Math.max(0, byteLength) / 3) * 4;

export const blobToBoundedBase64 = async (blob: Blob): Promise<string> => {
  if (!isSupportedSpeechMimeType(blob.type)) throw new Error('这个录音格式暂时不能分析，请换浏览器或重新录制。');
  if (blob.size <= 0) throw new Error('没有录到声音，请重新录制。');
  if (blob.size > MAX_AUDIO_BYTES || estimateBase64Length(blob.size) > MAX_AUDIO_BASE64_LENGTH) {
    throw new Error('录音超过约 2 MB 的分析请求上限，请缩短后重新录制。');
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const encoded = btoa(binary);
  if (encoded.length > MAX_AUDIO_BASE64_LENGTH) {
    throw new Error('录音超过约 2 MB 的分析请求上限，请缩短后重新录制。');
  }
  return encoded;
};

export const parseNhkSpeechFeedback = (
  value: unknown,
  expectedMode?: NhkSpeechFeedbackMode,
): NhkSpeechFeedbackResult | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const mode = raw.mode === 'shadow' || raw.mode === 'recap' ? raw.mode : null;
  if (!mode || (expectedMode && mode !== expectedMode)) return null;
  const transcript = clean(raw.transcript, 900);
  const expectedText = clean(raw.expectedText, 500);
  const durationSeconds = finiteDuration(raw.durationSeconds);
  if (!expectedText || !transcript || !durationSeconds) return null;
  const base = {
    version: 1 as const,
    expectedText,
    transcript,
    durationSeconds,
    usedFallback: raw.usedFallback === true,
  };

  if (mode === 'shadow') {
    const substitutions = Array.isArray(raw.substitutions)
      ? raw.substitutions.map(item => {
        const candidate = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {expected: clean(candidate.expected, 120), heard: clean(candidate.heard, 120)};
      }).filter(item => item.expected || item.heard).slice(0, 8)
      : [];
    const particleIssues = Array.isArray(raw.particleIssues)
      ? raw.particleIssues.map(item => {
        const candidate = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          expected: clean(candidate.expected, 24),
          heard: clean(candidate.heard, 24),
          context: clean(candidate.context, 120),
        };
      }).filter(item => item.expected || item.heard).slice(0, 8)
      : [];
    const retryTip = clean(raw.retryTip, 240);
    const accuracy = Number(raw.accuracyPercent);
    if (!retryTip || !Number.isFinite(accuracy)) return null;
    return {
      ...base,
      mode,
      omissions: boundedTextList(raw.omissions, 8, 120),
      substitutions,
      particleIssues,
      retryTip,
      accuracyPercent: Math.max(0, Math.min(100, Math.round(accuracy))),
    };
  }

  const minimalRevision = clean(raw.minimalRevision, 900);
  const naturalJapanese = clean(raw.naturalJapanese, 900);
  const linkageFeedback = clean(raw.linkageFeedback, 280);
  const naturalnessFeedback = clean(raw.naturalnessFeedback, 280);
  if (!minimalRevision || !naturalJapanese || !linkageFeedback || !naturalnessFeedback) return null;
  return {
    ...base,
    mode,
    minimalRevision,
    naturalJapanese,
    missingFacts: boundedTextList(raw.missingFacts, 8, 160),
    linkageFeedback,
    naturalnessFeedback,
  };
};

export const isNhkSpeechFeedbackResult = (value: unknown): value is NhkSpeechFeedbackResult =>
  parseNhkSpeechFeedback(value) !== null;

const normalizeForDiff = (value: string): string => value
  .normalize('NFKC')
  .replace(/[\s、。！？!?「」『』（）()［］\[\]・…—―.,:;：；]/g, '')
  .slice(0, DIFF_LIMIT);

type DiffOperation = {kind: 'equal' | 'delete' | 'insert'; value: string};

const diffCharacters = (expectedValue: string, heardValue: string): DiffOperation[] => {
  const expected = Array.from(normalizeForDiff(expectedValue));
  const heard = Array.from(normalizeForDiff(heardValue));
  const matrix = Array.from({length: expected.length + 1}, () => new Uint16Array(heard.length + 1));
  for (let left = expected.length - 1; left >= 0; left -= 1) {
    for (let right = heard.length - 1; right >= 0; right -= 1) {
      matrix[left][right] = expected[left] === heard[right]
        ? matrix[left + 1][right + 1] + 1
        : Math.max(matrix[left + 1][right], matrix[left][right + 1]);
    }
  }

  const operations: DiffOperation[] = [];
  let left = 0;
  let right = 0;
  while (left < expected.length && right < heard.length) {
    if (expected[left] === heard[right]) {
      operations.push({kind: 'equal', value: expected[left]});
      left += 1;
      right += 1;
    } else if (matrix[left + 1][right] >= matrix[left][right + 1]) {
      operations.push({kind: 'delete', value: expected[left]});
      left += 1;
    } else {
      operations.push({kind: 'insert', value: heard[right]});
      right += 1;
    }
  }
  while (left < expected.length) operations.push({kind: 'delete', value: expected[left++]});
  while (right < heard.length) operations.push({kind: 'insert', value: heard[right++]});
  return operations;
};

const contextFor = (expected: string, value: string): string => {
  const source = normalizeForDiff(expected);
  const index = source.indexOf(value);
  if (index < 0) return value;
  return source.slice(Math.max(0, index - 8), Math.min(source.length, index + value.length + 8));
};

export const buildDeterministicShadowDiff = (expected: string, transcript: string): DeterministicShadowDiff => {
  const operations = diffCharacters(expected, transcript);
  const omissions: string[] = [];
  const substitutions: NhkSpeechSubstitution[] = [];
  const particleIssues: NhkParticleIssue[] = [];
  let matches = 0;
  let expectedRun = '';
  let heardRun = '';

  const flush = () => {
    if (expectedRun && heardRun) substitutions.push({expected: expectedRun, heard: heardRun});
    else if (expectedRun) omissions.push(expectedRun);

    const expectedParticles = Array.from(expectedRun).filter(value => PARTICLES.has(value));
    const heardParticles = Array.from(heardRun).filter(value => PARTICLES.has(value));
    const issueCount = Math.max(expectedParticles.length, heardParticles.length);
    for (let index = 0; index < issueCount; index += 1) {
      const expectedParticle = expectedParticles[index] || '（なし）';
      const heardParticle = heardParticles[index] || '（省略）';
      if (expectedParticle === heardParticle) continue;
      particleIssues.push({
        expected: expectedParticle,
        heard: heardParticle,
        context: contextFor(expected, expectedRun || expectedParticle),
      });
    }
    expectedRun = '';
    heardRun = '';
  };

  for (const operation of operations) {
    if (operation.kind === 'equal') {
      flush();
      matches += 1;
    } else if (operation.kind === 'delete') expectedRun += operation.value;
    else heardRun += operation.value;
  }
  flush();

  const expectedLength = Array.from(normalizeForDiff(expected)).length;
  const accuracyPercent = expectedLength ? Math.round(matches / expectedLength * 100) : 0;
  const boundedOmissions = omissions.filter(Boolean).slice(0, 8);
  const boundedSubstitutions = substitutions.filter(item => item.expected || item.heard).slice(0, 8);
  const boundedParticles = particleIssues.slice(0, 8);
  const retryTip = boundedParticles.length
    ? `先把助词「${boundedParticles[0].expected}」连同前后词一起慢读，再恢复原速。`
    : boundedOmissions.length
      ? `先单独补回「${boundedOmissions[0]}」，再从前一个停顿处整句重说。`
      : boundedSubstitutions.length
        ? `对照「${boundedSubstitutions[0].expected} → ${boundedSubstitutions[0].heard}」，先慢速确认再重试。`
        : '内容已基本对齐；下一次把切分处连起来，保持自然语流。';

  return {
    omissions: boundedOmissions,
    substitutions: boundedSubstitutions,
    particleIssues: boundedParticles,
    retryTip,
    accuracyPercent,
  };
};
