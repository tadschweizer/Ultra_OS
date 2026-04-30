import axios from 'axios';

export class ConnectorClient {
  constructor(config) {
    this.config = config;
  }

  isConfigured() {
    const { clientId, clientSecret, redirectUri } = this.config;
    return Boolean(clientId && clientSecret && redirectUri);
  }

  buildLoginUrl(state) {
    const { authUrl, clientId, redirectUri, scope } = this.config;
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope,
      state,
    });
    return `${authUrl}?${params.toString()}`;
  }

  async exchangeToken(code) {
    const params = new URLSearchParams();
    params.append('client_id', this.config.clientId);
    params.append('client_secret', this.config.clientSecret);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', this.config.redirectUri);
    const response = await axios.post(this.config.tokenUrl, params);
    return response.data;
  }

  async refreshToken(refreshToken) {
    const params = new URLSearchParams();
    params.append('client_id', this.config.clientId);
    params.append('client_secret', this.config.clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    const response = await axios.post(this.config.tokenUrl, params);
    return response.data;
  }

  static makeCursor({ backfillStart = null, incrementalAfter = null } = {}) {
    return {
      backfill_start: backfillStart,
      incremental_after: incrementalAfter,
      last_full_sync_at: null,
      last_incremental_sync_at: null,
    };
  }

  static normalizeMetrics(provider, payload = {}) {
    return {
      provider,
      activity_external_id: payload.id || null,
      training_load: payload.training_load ?? null,
      duration_seconds: payload.duration_seconds ?? payload.duration ?? null,
      intensity: payload.intensity ?? null,
      hr_avg: payload.hr_avg ?? null,
      hr_max: payload.hr_max ?? null,
      hrv_ms: payload.hrv_ms ?? null,
      sleep_duration_seconds: payload.sleep_duration_seconds ?? null,
      sleep_stages: payload.sleep_stages ?? null,
      readiness_score: payload.readiness_score ?? null,
      recovery_score: payload.recovery_score ?? null,
      temperature_delta_c: payload.temperature_delta_c ?? null,
      resting_hr: payload.resting_hr ?? null,
      spo2_percent: payload.spo2_percent ?? null,
      tags: payload.tags ?? [],
    };
  }
}
