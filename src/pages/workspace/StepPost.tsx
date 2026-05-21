import { MapPinned, KeyRound, MessageCircleQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { projectRepository } from "@/db/repositories/projectRepository";
import { projectService } from "@/db/services/projectService";
import { useFlowStore } from "@/features/flow/flowStore";
import { useSettingsStore } from "@/features/settings/settingsStore";
import { Button } from "@/shared/components/ui/button";

type GenderOption = "男" | "女" | "其他";

function buildBriefForAi(brief: string, gender: GenderOption, customGender: string, age: string) {
  const lines = [
    brief.trim(),
    "补充信息：",
    `TA 的性别：${gender === "其他" ? customGender.trim() : gender}`,
    age.trim() ? `TA 的年龄：${age.trim()}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export function StepPost() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState("");
  const [gender, setGender] = useState<GenderOption | "">("");
  const [customGender, setCustomGender] = useState("");
  const [age, setAge] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const markStepCompleted = useFlowStore((state) => state.markStepCompleted);
  const { load: loadSettings, getAvailability } = useSettingsStore();

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleStartQuestionnaire() {
    const trimmedBrief = brief.trim();
    const trimmedCustomGender = customGender.trim();
    setErrorMessage(null);

    if (trimmedBrief.length < 12) {
      setHint("再多写一点点吧。比如 TA 常在哪里出现，或 TA 给你的第一感觉是什么。");
      return;
    }

    if (!gender || (gender === "其他" && !trimmedCustomGender)) {
      setHint("请先选择 TA 的性别；如果选择“其他”，需要写下具体内容。");
      return;
    }

    const availability = getAvailability();
    if (!availability.available) {
      setErrorMessage("尚未连接模型。请先在设置中配置自有 API，或激活预置调用模式。");
      return;
    }

    setIsSubmitting(true);
    try {
      const aiBrief = buildBriefForAi(trimmedBrief, gender, trimmedCustomGender, age);
      const draftProject = await projectRepository.create({
        title: trimmedBrief.length > 18 ? `${trimmedBrief.slice(0, 18)}…` : trimmedBrief,
      });
      const updatedProject = await projectService.updateProject(draftProject.id, {
        currentStep: "questionnaire",
        intake: {
          brief: aiBrief,
          gender: gender === "其他" ? trimmedCustomGender : gender,
          age: age.trim() || undefined,
        },
      });

      if (!updatedProject) {
        throw new Error("登岛问卷准备失败。");
      }

      markStepCompleted("post");
      navigate(`/questionnaire-loading/${updatedProject.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "登岛问卷准备失败。";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center px-2 py-8 sm:px-4 sm:py-20">
      <article className="w-full max-w-3xl border-2 border-[var(--echo-line)] bg-[var(--animal-bg-content)] p-5 text-[var(--echo-ink)] shadow-[0_4px_10px_rgba(107,92,67,0.28)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--echo-stamp)]">
          写下岛民便笺
        </p>
        <h1 className="mt-5 font-display text-4xl font-black tracking-normal sm:text-5xl">
          你记得 TA 的哪一部分？
        </h1>
        <p className="mt-5 max-w-2xl font-mono text-base leading-7">
          不必急着说清 TA 是谁。写下一点气息、一句话、一个场景、一段你记得很久的小事，或那个始终没有散去的瞬间。
        </p>
        <div className="mt-8 grid gap-5">
          <label htmlFor="case-brief" className="sr-only">
            最初的印象
          </label>
          <textarea
            id="case-brief"
            value={brief}
            onChange={(event) => {
              setBrief(event.target.value);
              setHint(null);
            }}
            className="min-h-52 w-full resize-y rounded-[30px] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-input)] px-4 py-4 font-mono text-base leading-8 text-[var(--animal-text-body)] shadow-[0_4px_0_0_var(--animal-shadow-input)] outline-none placeholder:text-[var(--animal-text-disabled)] hover:border-[var(--animal-border-hover)] focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_4px_0_0_var(--animal-focus-yellow-dark)] sm:min-h-64 sm:px-6 sm:py-5 sm:text-lg sm:leading-9"
            placeholder="比如：TA 总在雨夜出现，话很少，像在等一封永远不会抵达的信。"
          />

          <div className="grid gap-5 rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.38)] p-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(14rem,0.85fr)] sm:p-4">
          <fieldset>
            <legend className="mb-3 text-sm font-black text-[var(--animal-text)]">
              TA 的性别 <span className="text-[var(--animal-error)]">*</span>
            </legend>
            <div className="flex flex-wrap gap-3">
              {(["男", "女", "其他"] as const).map((option) => (
                <label
                  key={option}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.42)] px-4 py-2 text-sm font-bold text-[var(--animal-text-body)] shadow-[0_3px_0_0_var(--animal-shadow-input)] transition-all hover:-translate-y-0.5 hover:border-[var(--animal-primary)] has-[:checked]:border-[var(--animal-primary)] has-[:checked]:bg-[var(--animal-primary-bg)] has-[:checked]:text-[var(--animal-text)]"
                >
                  <input
                    type="radio"
                    name="gender"
                    value={option}
                    checked={gender === option}
                    onChange={() => {
                      setGender(option);
                      setHint(null);
                    }}
                    className="h-4 w-4 accent-[var(--animal-primary)]"
                    required
                  />
                  {option}
                </label>
              ))}
            </div>
            {gender === "其他" && (
              <input
                type="text"
                value={customGender}
                onChange={(event) => {
                  setCustomGender(event.target.value);
                  setHint(null);
                }}
                className="mt-4 h-12 w-full max-w-md rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-input)] px-5 text-base font-bold text-[var(--animal-text-body)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_3px_0_0_var(--animal-focus-yellow-dark)]"
                placeholder="请写下 TA 更准确的性别描述"
                required
              />
            )}
          </fieldset>
          <label className="block">
            <span className="mb-3 block text-sm font-black text-[var(--animal-text)]">
              TA 的年龄 <span className="text-[var(--animal-text-muted)]">（可选）</span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={age}
              onChange={(event) => setAge(event.target.value.replace(/\D/g, ""))}
              className="h-12 w-full max-w-md rounded-[var(--animal-radius-pill)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-input)] px-5 text-base font-bold text-[var(--animal-text-body)] shadow-[0_3px_0_0_var(--animal-shadow-input)] outline-none placeholder:text-[var(--animal-text-disabled)] focus:border-[var(--animal-focus-yellow)] focus:shadow-[0_3px_0_0_var(--animal-focus-yellow-dark)]"
              placeholder="只填写数字，例如 24"
            />
          </label>
          </div>
        </div>
        {hint && (
          <p className="mt-4 flex items-start gap-2 font-mono text-sm leading-6 text-[var(--echo-stamp)]">
            <MessageCircleQuestion aria-hidden="true" size={17} className="mt-1 shrink-0" />
            {hint}
          </p>
        )}
        {errorMessage && (
          <div className="mt-5 border border-[var(--echo-stamp)] bg-[rgba(122,43,38,0.08)] p-4 font-mono text-sm leading-6 text-[var(--echo-stamp)]">
            {errorMessage}
            <Button asChild variant="ghost" className="ml-2 h-auto px-1 py-0">
              <Link to="/settings">
                <KeyRound aria-hidden="true" size={15} />
                前往设置
              </Link>
            </Button>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 rounded-[var(--animal-radius-lg)] border-2 border-[var(--animal-primary)] bg-[var(--animal-primary-bg)] p-4 shadow-[0_5px_0_0_var(--animal-shadow-input)] sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={() => void handleStartQuestionnaire()}
            className="h-14 w-full border-[var(--animal-primary-active)] bg-[var(--animal-primary)] px-8 text-base text-white shadow-[0_6px_0_0_var(--animal-primary-active)] hover:shadow-[0_7px_0_0_var(--animal-primary-active)] active:shadow-[0_2px_0_0_var(--animal-primary-active)] sm:w-auto sm:min-w-52"
          >
            <MapPinned aria-hidden="true" size={18} />
            {isSubmitting ? "正在准备问卷" : "领取登岛问卷"}
          </Button>
          <p className="font-mono text-xs leading-5 text-[var(--animal-text-muted)]">
            <MapPinned aria-hidden="true" size={14} className="mr-1 inline" />
            先领取一份登岛小问卷，再把 TA 的样子整理得更清楚。
          </p>
        </div>
      </article>
    </div>
  );
}
