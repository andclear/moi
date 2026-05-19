import type { IntakeAnswer, IntakeQuestion, Project } from "@/db/types";

function answersToMarkdown(questions: IntakeQuestion[], answers: IntakeAnswer[]) {
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

  return questions
    .map((question) => {
      const answer = answerByQuestion.get(question.id);
      const option = question.options.find((item) => item.id === answer?.optionId);
      const value = answer?.customValue?.trim() || option?.label || "未选择";
      return `- ${question.title}\n  - ${value}`;
    })
    .join("\n");
}

export function buildProfileBrief(project: Project, answers: IntakeAnswer[]) {
  const intake = project.intake;
  const questionnaire = intake?.questionnaire;
  const lines = [
    "用户直接提供的基础事实，必须写入岛民档案，后续不能丢失：",
    `- 性别：${intake?.gender || "未填写"}`,
    `- 年龄：${intake?.age || "未填写"}`,
    "",
    "用户最初写下的角色线索：",
    intake?.brief ?? project.dossier.markdown,
    "",
    "用户补充回答：",
    questionnaire ? answersToMarkdown(questionnaire.questions, answers) : "暂无",
  ];

  return lines.join("\n");
}
