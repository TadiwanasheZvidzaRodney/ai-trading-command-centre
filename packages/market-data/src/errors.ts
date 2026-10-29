export type MarketDataErrorCode =
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_HTTP_ERROR'
  | 'PROVIDER_INVALID_RESPONSE'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNSUPPORTED_TIMEFRAME'
  | 'UNSUPPORTED_INSTRUMENT'
  | 'MARKET_DATA_UNAVAILABLE';

export interface MarketDataErrorDetails {
  providerId?: string;
  instrument?: string;
  status?: number;
  retryable?: boolean;
  [key: string]: unknown;
}

export class MarketDataError extends Error {
  readonly code: MarketDataErrorCode;
  readonly details: MarketDataErrorDetails;
  readonly retryable: boolean;

  constructor(
    code: MarketDataErrorCode,
    message: string,
    details: MarketDataErrorDetails = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'MarketDataError';
    this.code = code;
    this.details = details;
    this.retryable = details.retryable === true;
  }
}

export class ProviderNotConfiguredError extends MarketDataError {
  constructor(providerId: string, message = 'Provider is not configured') {
    super('PROVIDER_NOT_CONFIGURED', message, { providerId, retryable: false });
    this.name = 'ProviderNotConfiguredError';
  }
}

export class ProviderRequestError extends MarketDataError {
  constructor(
    providerId: string,
    code: 'PROVIDER_TIMEOUT' | 'PROVIDER_HTTP_ERROR' | 'PROVIDER_UNAVAILABLE',
    message: string,
    details: Omit<MarketDataErrorDetails, 'providerId'> = {},
    options?: ErrorOptions,
  ) {
    super(code, message, { providerId, ...details }, options);
    this.name = 'ProviderRequestError';
  }
}

export class ProviderResponseError extends MarketDataError {
  constructor(
    providerId: string,
    message: string,
    details: Omit<MarketDataErrorDetails, 'providerId'> = {},
    options?: ErrorOptions,
  ) {
    super(
      'PROVIDER_INVALID_RESPONSE',
      message,
      { providerId, retryable: false, ...details },
      options,
    );
    this.name = 'ProviderResponseError';
  }
}

export class MarketDataUnavailableError extends MarketDataError {
  constructor(message: string, details: MarketDataErrorDetails = {}) {
    super('MARKET_DATA_UNAVAILABLE', message, { ...details, retryable: false });
    this.name = 'MarketDataUnavailableError';
  }
}
