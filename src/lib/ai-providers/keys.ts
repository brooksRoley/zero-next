import { getProvider } from "./providers";

export function resolveKey(
  providerId: string,
  byokHeader?: string
): string | null {
  if (byokHeader?.trim()) return byokHeader.trim();

  const provider = getProvider(providerId);
  if (!provider) return null;

  const envVal = process.env[provider.envKey];
  return envVal?.trim() || null;
}
