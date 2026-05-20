import type { BeautificationAsset, Project, WorldEntry } from "@/db/types";

export function getBeautificationWorldEntryId(assetId: string) {
  return `beautification_world_${assetId}`;
}

export function buildBeautificationWorldEntry(
  project: Project,
  asset: BeautificationAsset,
  index = 0,
): WorldEntry | null {
  const worldInfo = asset.worldInfo;
  if (!asset.enabled || !worldInfo) {
    return null;
  }

  return {
    id: getBeautificationWorldEntryId(asset.id),
    projectId: project.id,
    title: `美化规则：${worldInfo.comment || asset.title}`,
    content: [
      "这是一条由美化方案生成的世界书规则。角色扮演时必须遵守它，用来输出可被正则脚本匹配和渲染的结构化文本。",
      "",
      `规则正文：\n${worldInfo.content}`,
      "",
      `常驻：${worldInfo.constant ? "是" : "否"}`,
      `关键词：${worldInfo.constant ? "无，常驻生效" : worldInfo.keys.join("、") || "未设置"}`,
      `插入位置：${worldInfo.position}`,
      `深度：${worldInfo.depth || "未设置"}`,
      `插入顺序：${worldInfo.insertion_order}`,
    ].join("\n"),
    keys: worldInfo.constant ? [] : worldInfo.keys,
    constant: worldInfo.constant,
    position: worldInfo.position,
    depth: typeof worldInfo.depth === "number" ? worldInfo.depth : undefined,
    insertionOrder: worldInfo.insertion_order ?? 900 + index,
    enabled: true,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

export function collectPromptWorldEntries(project: Project): WorldEntry[] {
  const confirmedEntries = project.worldEntries.filter((entry) => entry.enabled);
  const beautificationEntries = (project.beautifications ?? [])
    .map((asset, index) => buildBeautificationWorldEntry(project, asset, index))
    .filter((entry): entry is WorldEntry => Boolean(entry));
  const existingIds = new Set(confirmedEntries.map((entry) => entry.id));

  return [
    ...confirmedEntries,
    ...beautificationEntries.filter((entry) => !existingIds.has(entry.id)),
  ];
}
