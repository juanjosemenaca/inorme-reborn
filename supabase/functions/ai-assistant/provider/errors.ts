/** Error de proveedor. `code` es estable para auditoría y mensajes de usuario. */
export class ProviderError extends Error {
  code: string;
  status: number;
  provider: string;
  constructor(code: string, status = 502, provider = "unknown") {
    super(code);
    this.code = code;
    this.status = status;
    this.provider = provider;
  }
}

/** Códigos que el HTTP layer mapea a mensajes amables. */
export const PROVIDER_USER_CODES = [
  "provider_timeout",
  "provider_quota",
  "provider_rate_limited",
  "provider_error",
  "provider_tools_unsupported",
  "provider_not_configured",
  "openai_timeout",
  "openai_quota",
  "openai_rate_limited",
  "openai_error",
] as const;
