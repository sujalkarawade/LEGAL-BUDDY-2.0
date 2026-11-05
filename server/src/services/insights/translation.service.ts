import { createHash } from 'node:crypto';
import { AiService } from '../ai/ai-service.js';

export type TargetLanguage = 'hi' | 'mr';
const NAMES: Record<TargetLanguage, 'Hindi' | 'Marathi'> = { hi: 'Hindi', mr: 'Marathi' };

const CACHE_MAX = 300;
const cache = new Map<string, { text: string; provider: string }>();

export class TranslationUnavailableError extends Error {}

/**
 * Translates Legal Buddy's OWN explanations (never raw contract text supplied by the browser)
 * through the AI provider the project already uses. Results are cached in memory so the same
 * explanation is not sent twice. Without a configured provider it reports that clearly instead of
 * returning a machine-guessed translation.
 */
export const TranslationService = {
  isAvailable(): boolean {
    return AiService.getProviderStatus().isLiveLlm;
  },

  async translate(text: string, target: TargetLanguage): Promise<{ text: string; provider: string; cached: boolean }> {
    const source = text.trim();
    if (!source) return { text: '', provider: 'none', cached: true };
    const key = `${target}:${createHash('sha256').update(source).digest('hex')}`;
    const hit = cache.get(key);
    if (hit) return { ...hit, cached: true };
    if (!TranslationService.isAvailable()) {
      throw new TranslationUnavailableError('Hindi and Marathi explanations need an AI provider (Groq or OpenRouter) configured on the server. English read-aloud still works.');
    }
    let result;
    try {
      result = await AiService.translateExplanation(source, NAMES[target]);
    } catch {
      throw new TranslationUnavailableError('The AI provider did not return a translation. Please try again later.');
    }
    if (!result.text) throw new TranslationUnavailableError('The AI provider returned an empty translation.');
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    const value = { text: result.text, provider: result.provider };
    cache.set(key, value);
    return { ...value, cached: false };
  },
};
