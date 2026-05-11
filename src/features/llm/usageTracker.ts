import type { GenerationTask, GenerationType, GenerationUsage } from "@/db/types";
import { generationRepository } from "@/db/repositories/generationRepository";

export async function createGenerationRecord(input: {
  projectId: string;
  type: GenerationType;
  inputSummary: string;
}) {
  return generationRepository.create({
    ...input,
    status: "running",
  });
}

export async function markGenerationSucceeded(
  task: GenerationTask,
  output: unknown,
  usage?: GenerationUsage,
) {
  return generationRepository.markSucceeded(task.id, output, usage);
}

export async function markGenerationFailed(task: GenerationTask, error: unknown) {
  const message = error instanceof Error ? error.message : "模型调用失败。";
  return generationRepository.markFailed(task.id, message);
}
