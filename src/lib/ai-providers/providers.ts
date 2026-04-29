export type Provider = {
  id: "openrouter" | "groq" | "cerebras";
  name: string;
  baseUrl: string;
  envKey: string;
  rateLimit: { rpm: number; rpd: number };
};

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    rateLimit: { rpm: 20, rpd: 200 },
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    rateLimit: { rpm: 30, rpd: 1000 },
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    rateLimit: { rpm: 30, rpd: 1000000 },
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
