import type { Project, TrialModeResults, TrialRun } from "@/db/types";
import { parseDossierSections } from "@/features/dossier/dossierSections";

const trialReportLabels = {
  interview: "多面试官对话",
  stress: "风浪压测",
  diary: "日记回声",
} satisfies Record<keyof TrialModeResults, string>;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function renderMarkdown(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "<p>尚未听见</p>";
  }

  const blocks: string[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) {
      return;
    }
    blocks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    listItems = [];
  }

  normalized.split(/\n{2,}/).forEach((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      return;
    }

    lines.forEach((line) => {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      const list = /^[-*]\s+(.+)$/.exec(line);
      if (heading) {
        flushList();
        const level = Math.min(heading[1].length + 2, 4);
        blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
        return;
      }
      if (list) {
        listItems.push(renderInlineMarkdown(list[1]));
        return;
      }

      flushList();
      blocks.push(`<p>${renderInlineMarkdown(line)}</p>`);
    });
    flushList();
  });

  return blocks.join("");
}

function sectionHtml(title: string, body: string) {
  return `<section><h2>${escapeHtml(title)}</h2><div class="markdown-body">${renderMarkdown(body || "尚未听见")}</div></section>`;
}

function legacyTrialHtml(trialRun?: TrialRun) {
  return `<section><h2>相处测试结果</h2><div class="markdown-body">${renderMarkdown(trialRun?.resultMarkdown ?? "尚未留下相处测试记录。")}</div></section>`;
}

function structuredTrialHtml(trialRun?: TrialRun) {
  const modeResults = trialRun?.modeResults;
  if (!modeResults) {
    return legacyTrialHtml(trialRun);
  }

  const modeHtml = (Object.keys(trialReportLabels) as Array<keyof TrialModeResults>)
    .map((mode) => {
      const result = modeResults[mode];
      const questionsHtml = result.questions
        .map((question, index) => {
          const answer = result.answers.find((item) => item.questionId === question.id);
          const riskHtml = answer?.riskSentences.length
            ? `<div class="risk-lines"><strong>风险句</strong><ul>${answer.riskSentences
                .map((sentence) => `<li>${renderInlineMarkdown(sentence)}</li>`)
                .join("")}</ul></div>`
            : "";

          return `<article class="qa-card">
            <div class="question-block">
              <span class="qa-label">问题 ${index + 1}</span>
              <p>${renderInlineMarkdown(`${question.interviewer ? `${question.interviewer}：` : ""}${question.question}`)}</p>
              ${question.intent ? `<p class="intent">测试目的：${renderInlineMarkdown(question.intent)}</p>` : ""}
            </div>
            <div class="answer-grid">
              <div class="answer-block">
                <span class="qa-label answer-label">正式回复</span>
                <div class="markdown-body">${renderMarkdown(answer?.formalReply ?? "尚未回答。")}</div>
              </div>
              <div class="inner-block">
                <span class="qa-label inner-label">内心独白</span>
                <div class="markdown-body">${renderMarkdown(answer?.innerMonologue ?? "尚未回答。")}</div>
              </div>
            </div>
            ${riskHtml}
          </article>`;
        })
        .join("");
      const riskNotesHtml = result.riskNotes.length
        ? `<div class="mode-risks"><strong>OOC 风险</strong><ul>${result.riskNotes
            .map((note) => `<li>${renderInlineMarkdown(note)}</li>`)
            .join("")}</ul></div>`
        : "";

      return `<article class="trial-mode">
        <div class="mode-heading">
          <span>${escapeHtml(trialReportLabels[mode])}</span>
          <small>${result.questions.length} 个问题</small>
        </div>
        <div class="qa-list">${questionsHtml || "<p>尚未留下问答记录。</p>"}</div>
        ${riskNotesHtml}
      </article>`;
    })
    .join("");

  return `<section><h2>相处测试结果</h2><div class="trial-tabs">${modeHtml}</div></section>`;
}

export function buildProfileReportHtml(project: Project, versionLabel = "1.0") {
  const sections = parseDossierSections(project.dossier.markdown);
  const latestTrial = project.trialRuns[0];
  const companions = (project.companions ?? []).filter((node) => node.status === "confirmed");

  const reportSections = sections.filter((section) => section.section !== "开场白");
  const dossierHtml = reportSections
    .map((section) => sectionHtml(section.section, section.content.trim()))
    .join("\n");
  const companionHtml = companions
    .map((node) => `<li><strong>${escapeHtml(node.name)}</strong><p>${renderInlineMarkdown(node.relationToMain)}</p></li>`)
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(project.title)} - 寻回报告</title>
  <style>
    :root { color-scheme: light; --paper: rgb(247,243,223); --ink: #794f27; --line: #c4b89e; --text: #725d42; --muted: #8a7b66; --primary: #19c8b9; }
    body { margin: 0; background: radial-gradient(circle at 20% 10%, rgba(130,213,187,.28), transparent 30%), linear-gradient(180deg, #f8f8f0, #f0e8d8); color: var(--text); font-family: Nunito, "Noto Sans SC", "Zen Maru Gothic", -apple-system, "PingFang SC", sans-serif; font-weight: 500; }
    main { width: min(980px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0; }
    header { border: 2px solid var(--line); border-radius: 24px; padding: 32px; background: var(--paper); box-shadow: 0 4px 10px rgba(107,92,67,.3); }
    h1 { margin: 0; color: var(--ink); font-size: clamp(2.4rem, 8vw, 5rem); letter-spacing: 0; }
    .meta { margin-top: 16px; color: var(--muted); font-weight: 700; }
    section { margin-top: 24px; border: 2px solid var(--line); border-radius: 20px; padding: 24px; background: var(--paper); box-shadow: 0 3px 10px rgba(61,52,40,.1); }
    h2 { margin: 0 0 14px; color: var(--ink); font-size: 1.4rem; }
    h3, h4 { color: var(--ink); }
    div, p, li { line-height: 1.9; }
    p { margin: 0.45rem 0; }
    ul { padding-left: 1.2rem; }
    strong { color: var(--ink); }
    em { color: var(--muted); }
    code { border: 1px solid var(--line); border-radius: 8px; padding: 0 6px; background: rgba(255,255,255,.38); color: var(--ink); }
    .markdown-body h3, .markdown-body h4 { margin: 1rem 0 .45rem; }
    .trial-tabs { display: grid; gap: 18px; }
    .trial-mode { border: 1px solid var(--line); border-radius: 16px; padding: 18px; background: rgba(255,255,255,.38); }
    .mode-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding-bottom: 12px; color: var(--ink); font-weight: 900; }
    .mode-heading span { display: inline-flex; border: 2px solid var(--primary); border-radius: 999px; padding: 6px 12px; background: rgba(25,200,185,.14); }
    .mode-heading small { color: var(--muted); font-weight: 800; }
    .qa-list { display: grid; gap: 14px; margin-top: 16px; }
    .qa-card { border: 1px solid rgba(196,184,158,.9); border-radius: 14px; padding: 14px; background: rgba(247,243,223,.82); }
    .question-block { border-left: 4px solid var(--ink); padding-left: 12px; color: var(--ink); font-weight: 800; }
    .intent { color: var(--muted); font-size: .92rem; font-weight: 600; }
    .answer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 12px; }
    .answer-block, .inner-block { border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: rgba(255,255,255,.44); }
    .inner-block { background: rgba(138,123,102,.08); }
    .qa-label { display: inline-flex; margin-bottom: 6px; border-radius: 999px; padding: 3px 9px; background: rgba(121,79,39,.12); color: var(--ink); font-size: .78rem; font-weight: 900; }
    .answer-label { background: rgba(25,200,185,.16); }
    .inner-label { background: rgba(138,123,102,.16); }
    .risk-lines, .mode-risks { margin-top: 12px; border: 1px solid rgba(122,43,38,.28); border-radius: 12px; padding: 10px 12px; background: rgba(122,43,38,.08); color: #7a2b26; }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="meta">Echo Island Report · ${escapeHtml(versionLabel)} · ${escapeHtml(new Date().toLocaleString("zh-CN"))}</p>
      <h1>${escapeHtml(project.title)}</h1>
      <p class="meta">这份报告记录 TA 被慢慢找到的路径，不参与角色卡运行。</p>
    </header>
    ${sectionHtml("岛民便笺", reportSections[0]?.content.trim() ?? project.title)}
    ${dossierHtml}
    ${structuredTrialHtml(latestTrial)}
    <section><h2>关系网</h2><ul>${companionHtml || "<li>尚未确认配角关系。</li>"}</ul></section>
  </main>
</body>
</html>`;
}

export function createReportFileName(project: Project, versionLabel: string) {
  const safeTitle = project.title.replace(/[\\/:*?"<>|]/g, "_").trim() || "echo-report";
  const safeVersion = versionLabel.replace(/[\\/:*?"<>|]/g, "_").trim() || "1.0";
  return `${safeTitle}-岛民报告-${safeVersion}.html`;
}
