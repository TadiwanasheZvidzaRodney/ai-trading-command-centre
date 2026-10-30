import crypto from 'node:crypto';
import pino from 'pino';
import type {
  AIProvider,
  AnalysisReport,
  AnalysisRequest,
  Evidence,
  ProviderConfig,
} from './types.js';
import { GeminiProvider, OllamaProvider, LocalFallbackProvider } from './providers/index.js';
import { PromptBuilder } from './prompt/builder.js';
import { InputSanitizer } from './prompt/sanitizer.js';
import { ReportFormatter } from './report/formatter.js';

const logger = pino();

export class AIAnalysisService {
  private providers: Map<string, AIProvider> = new Map();
  private fallbackProvider: LocalFallbackProvider;
  private promptBuilder = new PromptBuilder();
  private sanitizer = new InputSanitizer();
  private formatter = new ReportFormatter();

  constructor(config: ProviderConfig = {}) {
    this.fallbackProvider = new LocalFallbackProvider();

    // Initialize providers from config
    if (config.geminiApiKey) {
      try {
        this.providers.set('gemini', new GeminiProvider(config.geminiApiKey));
        logger.info('Gemini provider initialized');
      } catch (error) {
        logger.warn({ error }, 'Failed to initialize Gemini provider');
      }
    }

    try {
      const ollamaProvider = new OllamaProvider(
        config.ollamaBaseUrl || 'http://localhost:11434',
        config.ollamaModel || 'mistral'
      );
      this.providers.set('ollama', ollamaProvider);
      logger.info('Ollama provider initialized');
    } catch (error) {
      logger.warn({ error }, 'Failed to initialize Ollama provider');
    }
  }

  async analyze(request: AnalysisRequest, evidence: Evidence): Promise<AnalysisReport> {
    const startTime = Date.now();

    try {
      // Validate and sanitize inputs
      const sanitizedEvidence = this.sanitizer.sanitizeEvidence(evidence);

      // Build prompt
      const prompt = this.promptBuilder.buildAnalysisPrompt(sanitizedEvidence);

      // Select and use provider
      let selectedProvider: AIProvider | null = null;
      let modelName: string | null = null;
      let reportText = '';
      let fallback = false;
      let fallbackReason: string | undefined;
      let inferenceTimeMs = 0;

      try {
        selectedProvider = await this.selectProvider(request.model);

        if (!selectedProvider) {
          throw new Error('No AI provider available');
        }

        modelName = selectedProvider.name;
        const inferenceStart = Date.now();
        reportText = await selectedProvider.analyze(prompt, request.temperature ?? 0.7);
        inferenceTimeMs = Date.now() - inferenceStart;

        logger.info(
          { model: modelName, inferenceMs: inferenceTimeMs },
          'Analysis completed with AI provider'
        );
      } catch (error) {
        fallback = true;
        fallbackReason = error instanceof Error ? error.message : 'Unknown error';

        logger.warn(
          { error: fallbackReason, model: request.model },
          'AI provider failed, falling back to local analysis'
        );

        const fallbackStart = Date.now();
        reportText = await this.fallbackProvider.analyze(prompt);
        inferenceTimeMs = Date.now() - fallbackStart;

        logger.info({ fallbackMs: inferenceTimeMs }, 'Fallback analysis completed');
      }

      // Format report
      const formattedReport = this.formatter.formatAnalysisReport(reportText, sanitizedEvidence);

      // Create result
      const inputHash = this.hashInput(request, sanitizedEvidence);
      const totalTimeMs = Date.now() - startTime;

      const result: AnalysisReport = {
        report: formattedReport,
        model: modelName,
        temperature: request.temperature ?? 0.7,
        generated_at: new Date().toISOString(),
        inference_time_ms: inferenceTimeMs,
        input_hash: inputHash,
        fallback,
        fallback_reason: fallbackReason,
        evidence: sanitizedEvidence,
      };

      logger.info(
        {
          totalMs: totalTimeMs,
          model: modelName,
          fallback,
          hash: inputHash.substring(0, 8),
        },
        'Analysis report generated'
      );

      return result;
    } catch (error) {
      logger.error({ error }, 'Unrecoverable error during analysis');
      throw error;
    }
  }

  private async selectProvider(preference?: string): Promise<AIProvider | null> {
    // Check preferred provider first
    if (preference && preference !== 'auto') {
      const preferred = this.providers.get(preference);
      if (preferred) {
        const available = await preferred.available();
        if (available) {
          logger.debug({ provider: preference }, 'Using preferred provider');
          return preferred;
        }
        logger.warn({ provider: preference }, 'Preferred provider not available');
      }
    }

    // Auto-select: try gemini first, then ollama
    for (const name of ['gemini', 'ollama']) {
      const provider = this.providers.get(name);
      if (provider) {
        const available = await provider.available();
        if (available) {
          logger.debug({ provider: name }, 'Auto-selected provider');
          return provider;
        }
      }
    }

    logger.warn('No providers available, will use fallback');
    return null;
  }

  private hashInput(request: AnalysisRequest, evidence: Evidence): string {
    const key = [
      request.instrument,
      request.timeframe,
      request.lookback,
      evidence.latest_candle_time,
      JSON.stringify(evidence.structure),
      evidence.candle_count,
    ].join('|');

    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async healthCheck(): Promise<
    Record<string, { status: string; latency: number; message?: string }>
  > {
    const results: Record<
      string,
      { status: string; latency: number; message?: string }
    > = {};

    for (const [name, provider] of this.providers) {
      try {
        const check = await provider.healthCheck();
        results[name] = {
          status: check.status,
          latency: check.latencyMs,
          message: check.message,
        };
      } catch (error) {
        results[name] = {
          status: 'error',
          latency: -1,
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    results['fallback'] = {
      status: 'ok',
      latency: 0,
      message: 'Always available',
    };

    return results;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
