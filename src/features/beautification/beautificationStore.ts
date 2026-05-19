import type { BeautificationAsset, Project } from "@/db/types";
import { generateBeautificationAsset } from "@/features/llm/llmClient";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export interface BeautificationDraftInput {
  originalText: string;
  userRequest: string;
}

export function inferBeautificationStrategy(originalText: string): BeautificationAsset["strategy"] {
  const hasDynamicSignal = /[:：]\s*\S+|\d|{{user}}|{{char}}|[\n\r]/.test(originalText);
  return hasDynamicSignal ? "complex" : "simple";
}

export function testBeautificationRegex(regex: string, sample: string) {
  try {
    const expression = new RegExp(regex, "s");
    const match = sample.match(expression);

    return {
      ok: Boolean(match),
      groups: match?.slice(1) ?? [],
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      groups: [],
      error: error instanceof Error ? error.message : "正则表达式无法执行。",
    };
  }
}

export function buildFallbackBeautification(input: BeautificationDraftInput) {
  const strategy = inferBeautificationStrategy(input.originalText);
  const wrappedText =
    strategy === "complex"
      ? `<details>\n<summary>状态栏</summary>\n<statusblock>\n${input.originalText.trim()}\n</statusblock>\n</details>`
      : input.originalText.trim();
  const regex =
    strategy === "complex"
      ? "<statusblock>\\s*([\\s\\S]*?)\\s*</statusblock>"
      : input.originalText.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return {
    worldinfo:
      strategy === "complex"
        ? {
            key: "状态栏格式说明",
            content:
              "当角色状态发生变化时，请使用 <details><summary>状态栏</summary><statusblock>...</statusblock></details> 输出状态栏，并保持字段名与换行稳定，方便正则脚本替换为可视化面板。",
          }
        : null,
    regex,
    html:
      '<div class="echo-status-card-a7f3">\n  <style>\n    .echo-status-card-a7f3 { --echo-hud: #725d42; max-width: 36rem; margin: 0 auto; pointer-events: none; font-family: Nunito, "Noto Sans SC", sans-serif; }\n    .echo-status-card-a7f3 .hud { pointer-events: auto; border: 2px solid #c4b89e; border-radius: 20px; padding: 1rem; color: #725d42; background: rgb(247,243,223); box-shadow: 0 4px 10px rgba(107,92,67,.3); animation: echoHudIn .5s ease both; }\n    @keyframes echoHudIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }\n  </style>\n  <div class="hud">$1</div>\n</div>',
    original_text: input.originalText,
    formatted_original_text: wrappedText,
  };
}

export async function createBeautificationAsset(project: Project, input: BeautificationDraftInput) {
  const data = await generateBeautificationAsset({
    projectId: project.id,
    dossierMarkdown: project.dossier.markdown,
    originalText: input.originalText,
    userRequest: input.userRequest,
  });
  const now = nowIso();
  const asset: BeautificationAsset = {
    id: createId("beauty"),
    projectId: project.id,
    title: data.data.worldinfo?.key ?? (input.userRequest.trim() || "美化方案"),
    originalText: data.data.original_text || input.originalText,
    userRequest: input.userRequest,
    strategy: inferBeautificationStrategy(input.originalText),
    worldInfo: data.data.worldinfo,
    regex: data.data.regex,
    html: data.data.html,
    formattedOriginalText: data.data.formatted_original_text,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  return { asset, taskId: data.taskId };
}

export function createFallbackBeautificationAsset(project: Project, input: BeautificationDraftInput) {
  const now = nowIso();
  const data = buildFallbackBeautification(input);

  return {
    id: createId("beauty"),
    projectId: project.id,
    title: data.worldinfo?.key ?? (input.userRequest.trim() || "美化方案"),
    originalText: data.original_text,
    userRequest: input.userRequest,
    strategy: inferBeautificationStrategy(input.originalText),
    worldInfo: data.worldinfo,
    regex: data.regex,
    html: data.html,
    formattedOriginalText: data.formatted_original_text,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  } satisfies BeautificationAsset;
}
