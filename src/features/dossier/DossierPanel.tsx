import { Button as AnimalButton } from "animal-island-ui";
import { CheckCircle2, Clock3, IdCard, LockKeyhole, PenLine, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import type { Project } from "@/db/types";
import { projectRepository } from "@/db/repositories/projectRepository";
import { CharacterProfileModal } from "@/features/characterProfile/CharacterProfileModal";
import {
  generateAndSaveCharacterProfile,
  saveCharacterProfileYaml,
} from "@/features/characterProfile/characterProfileService";
import { DossierEditor } from "@/features/dossier/DossierEditor";
import { useDossierStore } from "@/features/dossier/dossierStore";

export function DossierPanel() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const {
    markdown,
    saveStatus,
    errorMessage,
    loadProject,
    updateMarkdown,
  } = useDossierStore();

  useEffect(() => {
    let ignored = false;

    async function loadCharacterProject() {
      if (!projectId) {
        setProject(null);
        return;
      }
      const nextProject = await projectRepository.getById(projectId);
      if (!ignored) {
        setProject(nextProject ?? null);
      }
    }

    if (projectId) {
      void loadProject(projectId);
      void loadCharacterProject();
    }

    const intervalId = window.setInterval(() => {
      void loadCharacterProject();
    }, 2000);

    return () => {
      ignored = true;
      window.clearInterval(intervalId);
    };
  }, [projectId, loadProject]);

  const statusText =
    saveStatus === "saving"
      ? "正在保存"
      : saveStatus === "saved"
        ? "已保存"
        : saveStatus === "error"
          ? "保存失败"
          : "等待记录";
  const StatusIcon =
    saveStatus === "saving" ? Clock3 : saveStatus === "error" ? TriangleAlert : CheckCircle2;
  const characterProfile = project?.characterProfile;
  const isCharacterProfileGenerating = characterProfile?.status === "generating";
  const shouldShowCharacterProfileButton = Boolean(projectId && characterProfile);
  const characterButtonText = isCharacterProfileGenerating
    ? "正在创建角色信息"
    : characterProfile?.status === "failed"
      ? "角色信息生成失败"
      : characterProfile?.yaml
        ? "角色信息"
        : "生成角色信息";

  async function handleCharacterProfileClick() {
    if (!projectId || !project) {
      return;
    }

    if (characterProfile?.status === "succeeded" && characterProfile.yaml) {
      setIsCharacterModalOpen(true);
      return;
    }

    setProject({
      ...project,
      characterProfile: {
        yaml: characterProfile?.yaml ?? "",
        status: "generating",
        retryCount: 0,
      },
    });
    const updatedProject = await generateAndSaveCharacterProfile(projectId, project.dossier.markdown);
    setProject(updatedProject ?? null);
  }

  async function handleSaveCharacterProfile(nextYaml: string) {
    if (!projectId) {
      return;
    }
    const updatedProject = await saveCharacterProfileYaml(projectId, nextYaml);
    setProject(updatedProject ?? null);
  }

  return (
    <aside className="flex h-full flex-col border-l-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)]">
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--echo-muted)]">
              TA 的记录
            </p>
            <h2 className="mt-2 font-display text-2xl font-black text-[var(--animal-text)]">
              岛民档案
            </h2>
          </div>
          <LockKeyhole aria-hidden="true" size={20} className="text-[var(--echo-muted)]" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--echo-muted)]">
            <StatusIcon aria-hidden="true" size={15} />
            <span>{statusText}</span>
          </div>
          {shouldShowCharacterProfileButton ? (
            <AnimalButton
              htmlType="button"
              type="primary"
              size="middle"
              loading={isCharacterProfileGenerating}
              disabled={isCharacterProfileGenerating}
              danger={characterProfile?.status === "failed"}
              icon={<IdCard aria-hidden="true" size={16} />}
              onClick={() => void handleCharacterProfileClick()}
            >
              {characterButtonText}
            </AnimalButton>
          ) : null}
        </div>
        {errorMessage && (
          <p className="mt-3 font-mono text-xs leading-5 text-[var(--echo-stamp)]">
            {errorMessage}
          </p>
        )}
        {characterProfile?.status === "failed" && characterProfile.errorMessage ? (
          <p className="mt-3 text-xs font-bold leading-5 text-[var(--animal-error-active)]">
            {characterProfile.errorMessage}
          </p>
        ) : null}
      </div>

      {projectId ? (
        <DossierEditor
          markdown={markdown}
          saveStatus={saveStatus}
          onChange={(nextMarkdown) => void updateMarkdown(nextMarkdown)}
          onSave={updateMarkdown}
        />
      ) : (
        <div className="p-5">
          <p className="font-mono text-sm leading-6 text-[var(--echo-muted)]">
            先写下一张岛民便笺，TA 的记录会在这里慢慢整理出来。
          </p>
          <div className="mt-6 rounded-[var(--animal-radius)] border border-dashed border-[var(--animal-border)] bg-[rgba(255,255,255,0.42)] p-4 font-mono text-sm leading-7 text-[var(--animal-text-muted)]">
            <div className="flex items-center gap-2 text-[var(--animal-text)]">
              <PenLine aria-hidden="true" size={16} />
              <span>等待第一条记录</span>
            </div>
            <div className="mt-4">
              ## 核心人格
              <br />
              尚未听见
              <br />
              <br />
              ## 世界观
              <br />
              尚未听见
            </div>
          </div>
        </div>
      )}
      <CharacterProfileModal
        open={isCharacterModalOpen}
        yaml={characterProfile?.yaml ?? ""}
        onClose={() => setIsCharacterModalOpen(false)}
        onSave={handleSaveCharacterProfile}
      />
    </aside>
  );
}
