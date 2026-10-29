/** Compatibilidad: el cliente HTTP vive en `provider/openaiProvider.ts`. */
export { OpenAIProvider } from "./provider/openaiProvider.ts";
export { ProviderError as OpenAiError } from "./provider/errors.ts";
export type { AIMessage as ChatMessage, AIFunctionToolJson as ChatToolDefinition } from "./provider/types.ts";
