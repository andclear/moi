import type { Project } from "@/db/types";
import { parseDossierSections } from "@/features/dossier/dossierSections";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sectionHtml(title: string, body: string) {
  return `<section><h2>${escapeHtml(title)}</h2><div>${escapeHtml(body || "尚未听见").replace(/\n/g, "<br>")}</div></section>`;
}

export function buildProfileReportHtml(project: Project, versionLabel = "1.0") {
  const sections = parseDossierSections(project.dossier.markdown);
  const worldEntries = (project.worldEntries ?? []).filter((entry) => entry.enabled);
  const selectedGreeting = project.greetingVariants.find((variant) => variant.selected);
  const latestTrial = project.trialRuns[0];
  const companions = (project.companions ?? []).filter((node) => node.status === "confirmed");

  const dossierHtml = sections
    .map((section) => sectionHtml(section.section, section.content.trim()))
    .join("\n");
  const worldHtml = worldEntries
    .map((entry) => `<li><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.content)}</p></li>`)
    .join("\n");
  const companionHtml = companions
    .map((node) => `<li><strong>${escapeHtml(node.name)}</strong><p>${escapeHtml(node.relationToMain)}</p></li>`)
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(project.title)} - 寻回报告</title>
  <style>
    :root { color-scheme: dark; --paper: #d3c5aa; --ink: #07141a; --line: rgba(211,197,170,.28); --text: #e8dfcb; --muted: #9faeb5; }
    body { margin: 0; background: radial-gradient(circle at 20% 10%, rgba(211,197,170,.12), transparent 30%), #061016; color: var(--text); font-family: "Songti SC", "Noto Serif SC", serif; }
    main { width: min(980px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0; }
    header { border: 1px solid var(--line); padding: 32px; background: rgba(2,16,24,.72); box-shadow: 10px 10px 0 rgba(0,0,0,.28); }
    h1 { margin: 0; color: var(--paper); font-size: clamp(2.4rem, 8vw, 5rem); letter-spacing: 0; }
    .meta { margin-top: 16px; color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    section { margin-top: 24px; border: 1px solid var(--line); padding: 24px; background: rgba(2,16,24,.54); }
    h2 { margin: 0 0 14px; color: var(--paper); font-size: 1.4rem; }
    div, p, li { line-height: 1.9; }
    ul { padding-left: 1.2rem; }
    strong { color: var(--paper); }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="meta">Echo Profile Report · ${escapeHtml(versionLabel)} · ${escapeHtml(new Date().toLocaleString("zh-CN"))}</p>
      <h1>${escapeHtml(project.title)}</h1>
      <p class="meta">这份报告记录 TA 被慢慢寻回的路径，不参与角色卡运行。</p>
    </header>
    ${sectionHtml("寻人启事", sections[0]?.content.trim() ?? project.title)}
    ${dossierHtml}
    <section><h2>WorldInfo 摘要</h2><ul>${worldHtml || "<li>尚未确认 WorldInfo。</li>"}</ul></section>
    <section><h2>开场白选择</h2><div>${escapeHtml(selectedGreeting?.content ?? "尚未锁定开场白。").replace(/\n/g, "<br>")}</div></section>
    <section><h2>终审结果</h2><div>${escapeHtml(latestTrial?.resultMarkdown ?? "尚未留下终审记录。").replace(/\n/g, "<br>")}</div></section>
    <section><h2>关系网</h2><ul>${companionHtml || "<li>尚未确认配角关系。</li>"}</ul></section>
  </main>
</body>
</html>`;
}

export function createReportFileName(project: Project, versionLabel: string) {
  const safeTitle = project.title.replace(/[\\/:*?"<>|]/g, "_").trim() || "echo-report";
  const safeVersion = versionLabel.replace(/[\\/:*?"<>|]/g, "_").trim() || "1.0";
  return `${safeTitle}-寻回报告-${safeVersion}.html`;
}
