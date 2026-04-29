import { AI_MODELS, type AIModel } from "./models";

export function getFallbackModels(
  failedModelId: string,
  exhaustedProviderIds: string[]
): AIModel[] {
  const model = AI_MODELS.find((m) => m.id === failedModelId);
  if (!model?.equivalentIds) return [];

  return model.equivalentIds
    .map((eqId) => AI_MODELS.find((m) => m.id === eqId))
    .filter((m): m is AIModel => !!m && !exhaustedProviderIds.includes(m.providerId));
}
