import type {
  BeautificationAsset,
  BeautificationGreetingInsertMode,
  GreetingVariant,
  Project,
} from "@/db/types";
import {
  generateBeautificationAsset,
  generateBeautificationKeywords,
} from "@/features/llm/llmClient";
import { getAdoptedGreetingVariants } from "@/features/greeting/greetingStore";
import { nowIso } from "@/shared/lib/date";
import { createId } from "@/shared/lib/ids";

export interface BeautificationDraftInput {
  userRequest: string;
  insertIntoGreeting: BeautificationGreetingInsertMode;
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
  const sampleText = `<details>\n<summary>{{user}}状态栏</summary>\n<statusblock>\n姓名：{{user}}\n状态：等待回应\n位置：场景边缘\n</statusblock>\n</details>`;
  const strategy = inferBeautificationStrategy(sampleText);
  const wrappedText =
    strategy === "complex"
      ? sampleText
      : input.userRequest.trim();
  const regex =
    strategy === "complex"
      ? "<statusblock>\\s*([\\s\\S]*?)\\s*</statusblock>"
      : input.userRequest.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return {
    worldinfo:
      strategy === "complex"
        ? {
            comment: "状态栏格式说明",
            content:
              "当角色状态发生变化时，请使用 <details><summary>状态栏</summary><statusblock>...</statusblock></details> 输出状态栏，并保持字段名与换行稳定，方便正则脚本替换为可视化面板。",
            constant: input.insertIntoGreeting !== "none",
            keys: input.insertIntoGreeting === "none" ? ["状态栏", "状态更新"] : [],
            position: 4,
            depth: 4,
            insertion_order: input.insertIntoGreeting === "none" ? 180 : 999,
          }
        : null,
    regex,
    html:
      '<div class="echo-status-card-a7f3">\n  <style>\n    .echo-status-card-a7f3 { --echo-hud: #725d42; max-width: 36rem; margin: 0 auto; pointer-events: none; font-family: Nunito, "Noto Sans SC", sans-serif; }\n    .echo-status-card-a7f3 .hud { pointer-events: auto; border: 2px solid #c4b89e; border-radius: 20px; padding: 1rem; color: #725d42; background: rgb(247,243,223); box-shadow: 0 4px 10px rgba(107,92,67,.3); animation: echoHudIn .5s ease both; }\n    @keyframes echoHudIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }\n  </style>\n  <div class="hud">$1</div>\n</div>',
    original_text: sampleText,
    formatted_original_text: wrappedText,
  };
}

export async function createBeautificationAsset(project: Project, input: BeautificationDraftInput) {
  const data = await generateBeautificationAsset({
    projectId: project.id,
    dossierMarkdown: project.dossier.markdown,
    characterInfoYaml: project.characterProfile?.yaml,
    confirmedWorldEntries: project.worldEntries.filter((entry) => entry.enabled),
    adoptedGreetings: getAdoptedGreetingVariants(project),
    userRequest: input.userRequest,
    insertIntoGreeting: input.insertIntoGreeting,
  });
  const worldInfo = normalizeBeautificationWorldInfo(data.data.worldinfo, input);
  let keywordTaskId: string | undefined;
  if (worldInfo && !worldInfo.constant && worldInfo.keys.length === 0) {
    try {
      const keywordResult = await generateBeautificationKeywords({
        projectId: project.id,
        userRequest: input.userRequest,
        worldInfoContent: worldInfo.content,
      });
      worldInfo.keys = keywordResult.data.keys;
      keywordTaskId = keywordResult.taskId;
    } catch {
      worldInfo.keys = fallbackKeywords(input.userRequest, worldInfo.comment);
    }
  }

  const now = nowIso();
  const asset: BeautificationAsset = {
    id: createId("beauty"),
    projectId: project.id,
    title: worldInfo?.comment ?? (input.userRequest.trim() || "美化方案"),
    originalText: data.data.original_text || data.data.formatted_original_text,
    userRequest: input.userRequest,
    strategy: inferBeautificationStrategy(data.data.formatted_original_text),
    worldInfo,
    regex: data.data.regex,
    html: data.data.html,
    formattedOriginalText: data.data.formatted_original_text,
    insertIntoGreeting: input.insertIntoGreeting,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  return { asset, taskId: data.taskId, keywordTaskId };
}

export function createFallbackBeautificationAsset(project: Project, input: BeautificationDraftInput) {
  const now = nowIso();
  const data = buildFallbackBeautification(input);

  return {
    id: createId("beauty"),
    projectId: project.id,
    title: data.worldinfo?.comment ?? (input.userRequest.trim() || "美化方案"),
    originalText: data.original_text,
    userRequest: input.userRequest,
    strategy: inferBeautificationStrategy(data.formatted_original_text),
    worldInfo: data.worldinfo,
    regex: data.regex,
    html: data.html,
    formattedOriginalText: data.formatted_original_text,
    insertIntoGreeting: input.insertIntoGreeting,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  } satisfies BeautificationAsset;
}

function fallbackKeywords(userRequest: string, title: string) {
  return Array.from(
    new Set(
      [title, ...userRequest.split(/[，。；、\s,.;:：]+/)]
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
        .slice(0, 5),
    ),
  ).slice(0, 5);
}

function normalizeBeautificationWorldInfo(
  worldInfo: Awaited<ReturnType<typeof generateBeautificationAsset>>["data"]["worldinfo"],
  input: BeautificationDraftInput,
): BeautificationAsset["worldInfo"] {
  const shouldInsert = input.insertIntoGreeting !== "none";
  if (!worldInfo) {
    return {
      comment: input.userRequest.trim() || "美化格式说明",
      content:
        "请按照固定结构输出需要美化的文本，保持字段名、顺序和换行稳定，方便正则脚本捕获并渲染为可视化内容。",
      constant: shouldInsert,
      keys: shouldInsert ? [] : fallbackKeywords(input.userRequest, "美化格式说明"),
      position: 4,
      depth: 4,
      insertion_order: shouldInsert ? 999 : 180,
    };
  }

  return {
    comment: worldInfo.comment,
    content: worldInfo.content,
    constant: shouldInsert ? true : false,
    keys: shouldInsert ? [] : worldInfo.keys ?? [],
    position: worldInfo.position ?? 4,
    depth: worldInfo.depth ?? 4,
    insertion_order: shouldInsert ? 999 : worldInfo.insertion_order ?? 180,
  };
}

export function applyBeautificationToGreetings(project: Project, asset: BeautificationAsset) {
  if (!asset.formattedOriginalText.trim() || asset.insertIntoGreeting === "none") {
    return project;
  }

  const adopted = getAdoptedGreetingVariants(project);
  const targetIds =
    asset.insertIntoGreeting === "primary"
      ? adopted.slice(0, 1).map((variant) => variant.id)
      : adopted.map((variant) => variant.id);
  const now = nowIso();
  const nextVariants = project.greetingVariants.map((variant) => {
    if (!targetIds.includes(variant.id) || variant.content.includes(asset.formattedOriginalText)) {
      return variant;
    }

    return {
      ...variant,
      content: `${variant.content.trim()}\n\n${asset.formattedOriginalText.trim()}`,
      updatedAt: now,
    } satisfies GreetingVariant;
  });

  return {
    ...project,
    greetingVariants: nextVariants,
    updatedAt: now,
  } satisfies Project;
}
