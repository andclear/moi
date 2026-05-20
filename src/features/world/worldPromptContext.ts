import type { Project, WorldEntry } from "@/db/types";

export function collectPromptWorldEntries(project: Project): WorldEntry[] {
  const confirmedEntries = project.worldEntries.filter((entry) => entry.enabled);
  const beautificationEntries = (project.beautifications ?? [])
    .filter((asset) => asset.enabled && asset.worldInfo)
    .map((asset, index) => {
      const worldInfo = asset.worldInfo;

      return {
        id: `beautification_world_${asset.id}`,
        projectId: project.id,
        title: `美化规则：${worldInfo?.comment || asset.title}`,
        content: worldInfo?.content ?? "",
        keys: worldInfo?.constant ? [] : worldInfo?.keys ?? [],
        constant: worldInfo?.constant,
        position: worldInfo?.position,
        depth: typeof worldInfo?.depth === "number" ? worldInfo.depth : undefined,
        insertionOrder: worldInfo?.insertion_order ?? 900 + index,
        enabled: true,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      } satisfies WorldEntry;
    });

  return [...confirmedEntries, ...beautificationEntries];
}
