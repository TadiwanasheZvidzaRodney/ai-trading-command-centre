import type { DataQuality, ProviderHealth } from '@atc/shared';

export interface ProviderRegistration {
  providerId: string;
  displayName: string;
  category: ProviderHealth['category'];
  configured: boolean;
  quality: DataQuality;
  note?: string;
}

function sanitize(message: string): string {
  return message
    .replace(/(apikey|api_key|token|authorization)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .slice(0, 1000);
}

function initialHealth(registration: ProviderRegistration): ProviderHealth {
  return {
    providerId: registration.providerId,
    displayName: registration.displayName,
    category: registration.category,
    status: registration.configured ? 'degraded' : 'not_configured',
    configured: registration.configured,
    quality: registration.quality,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    latencyMs: null,
    message: registration.configured
      ? 'Configured; awaiting the first live sample.'
      : 'Provider credentials are not configured.',
  };
}

/** In-memory provider health. It is intentionally process-local and resets on restart. */
export class ProviderHealthTracker {
  private readonly states = new Map<string, ProviderHealth>();
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date());
  }

  register(registration: ProviderRegistration): void {
    const existing = this.states.get(registration.providerId);
    if (!existing) {
      this.states.set(registration.providerId, initialHealth(registration));
      return;
    }
    existing.displayName = registration.displayName;
    existing.category = registration.category;
    existing.configured = registration.configured;
    existing.quality = registration.quality;
    if (!registration.configured) {
      existing.status = 'not_configured';
      existing.message = 'Provider credentials are not configured.';
    }
  }

  recordSuccess(providerId: string, latencyMs: number, message = 'Last live sample succeeded.'): void {
    const state = this.states.get(providerId);
    if (!state) return;
    state.status = 'ok';
    state.configured = true;
    state.lastSuccessAt = this.now().toISOString();
    state.latencyMs = Math.max(0, Math.round(latencyMs));
    state.message = message;
  }

  recordFailure(providerId: string, error: unknown, latencyMs?: number): void {
    const state = this.states.get(providerId);
    if (!state) return;
    const message = error instanceof Error ? error.message : 'Provider request failed';
    state.status = 'error';
    state.lastErrorAt = this.now().toISOString();
    state.lastError = sanitize(message);
    state.latencyMs =
      latencyMs === undefined ? state.latencyMs : Math.max(0, Math.round(latencyMs));
    state.message = sanitize(`Provider request failed: ${message}`);
  }

  recordDegraded(providerId: string, error: unknown, latencyMs?: number): void {
    const state = this.states.get(providerId);
    if (!state) return;
    const message = error instanceof Error ? error.message : 'Provider request failed';
    state.status = 'degraded';
    state.lastErrorAt = this.now().toISOString();
    state.lastError = sanitize(message);
    state.latencyMs =
      latencyMs === undefined ? state.latencyMs : Math.max(0, Math.round(latencyMs));
    state.message = sanitize(`Some provider requests failed: ${message}`);
  }

  markNotConfigured(
    providerId: string,
    message = 'Provider credentials are not configured.',
  ): void {
    const state = this.states.get(providerId);
    if (!state) return;
    state.status = 'not_configured';
    state.configured = false;
    state.message = message;
  }

  get(providerId: string): ProviderHealth | null {
    return this.states.get(providerId) ?? null;
  }

  list(): ProviderHealth[] {
    const categoryOrder: Record<ProviderHealth['category'], number> = {
      'market-data': 0,
      news: 1,
      calendar: 2,
      ai: 3,
    };
    return [...this.states.values()]
      .map((state) => ({ ...state }))
      .sort((left, right) => {
        const category = categoryOrder[left.category] - categoryOrder[right.category];
        return category !== 0
          ? category
          : left.providerId.localeCompare(right.providerId);
      });
  }
}
