import type { BeautificationUiStyleId } from "@/db/types";
import stylePromptMarkdown from "@/prompts/beautificationStylePromptCatalog.md?raw";

export interface BeautificationStylePreset {
  id: BeautificationUiStyleId;
  label: string;
  prompt: string;
}

function extractStylePrompt(styleHeading: string) {
  const start = stylePromptMarkdown.indexOf(`# ${styleHeading}`);
  if (start < 0) {
    return "";
  }

  const rest = stylePromptMarkdown.slice(start + 1);
  const nextHeadingIndex = rest.search(/^# 风格[一二三四五]：/m);
  const end = nextHeadingIndex >= 0 ? start + 1 + nextHeadingIndex : stylePromptMarkdown.length;
  return stylePromptMarkdown.slice(start, end).trim();
}

export const beautificationStylePresets: BeautificationStylePreset[] = [
  {
    id: "none",
    label: "不使用预设风格",
    prompt: "用户选择不使用预设风格。请根据用户美化需求、角色档案和世界观自行选择合适的视觉方案，但仍必须保证可读性、移动端适配和 SillyTavern 可执行性。",
  },
  {
    id: "aurora_glass",
    label: "极光玻璃",
    prompt: extractStylePrompt("风格一：极光玻璃"),
  },
  {
    id: "digital_garden",
    label: "数字花园",
    prompt: extractStylePrompt("风格二：数字花园"),
  },
  {
    id: "soft_future",
    label: "软性未来",
    prompt: extractStylePrompt("风格三：软性未来"),
  },
  {
    id: "cyber_elegant",
    label: "赛博优雅",
    prompt: extractStylePrompt("风格四：赛博朋克"),
  },
  {
    id: "nordic_minimal",
    label: "北欧简约",
    prompt: extractStylePrompt("风格五：北欧简约"),
  },
];

export function getBeautificationStylePreset(styleId: BeautificationUiStyleId) {
  return beautificationStylePresets.find((preset) => preset.id === styleId) ?? beautificationStylePresets[0];
}
