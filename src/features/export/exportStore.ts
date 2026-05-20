import { create } from "zustand";

import { exportRepository } from "@/db/repositories/exportRepository";
import type { ExportFormat, ExportRecord, Project } from "@/db/types";
import { buildCharacterCard, formatCharacterCardJson } from "@/features/export/characterCardBuilder";
import {
  imageFileToPngBytes,
  readCharacterCardJsonFromPng,
  writeCharacterCardTextChunks,
} from "@/features/export/pngTextWriter";

type ExportStatus = "idle" | "building" | "ready" | "failed";

interface ExportState {
  status: ExportStatus;
  error?: string;
  lastRecord?: ExportRecord;
  buildJson: (input: ExportBuildInput) => Promise<{ record: ExportRecord; formattedJson: string }>;
  buildPng: (input: ExportBuildInput & { imageFile: File }) => Promise<{
    record: ExportRecord;
    formattedJson: string;
    pngBytes: Uint8Array;
  }>;
  reset: () => void;
}

export interface ExportBuildInput {
  project: Project;
  versionLabel?: string;
  creator?: string;
}

function previewJson(formattedJson: string) {
  return formattedJson.length > 5000 ? `${formattedJson.slice(0, 5000)}\n...` : formattedJson;
}

function createDownloadName(project: Project, format: ExportFormat) {
  const safeTitle = project.title.replace(/[\\/:*?"<>|]/g, "_").trim() || "moi-character";
  return `${safeTitle}.${format}`;
}

export function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, filename: string, type = "application/json;charset=utf-8") {
  downloadBytes(new TextEncoder().encode(text), filename, type);
}

export const useExportStore = create<ExportState>((set) => ({
  status: "idle",
  buildJson: async ({ project, versionLabel, creator }) => {
    set({ status: "building", error: undefined });
    try {
      const card = buildCharacterCard({ project, versionLabel, creator });
      const formattedJson = formatCharacterCardJson(card);
      JSON.parse(formattedJson);
      const record = await exportRepository.create({
        projectId: project.id,
        format: "json",
        versionLabel,
        note: creator ? `署名：${creator}` : undefined,
        jsonPreview: previewJson(formattedJson),
      });
      downloadText(formattedJson, createDownloadName(project, "json"));
      set({ status: "ready", lastRecord: record });
      return { record, formattedJson };
    } catch (error) {
      const message = error instanceof Error ? error.message : "导出 JSON 失败。";
      set({ status: "failed", error: message });
      throw error;
    }
  },
  buildPng: async ({ project, versionLabel, creator, imageFile }) => {
    set({ status: "building", error: undefined });
    try {
      const card = buildCharacterCard({ project, versionLabel, creator });
      const formattedJson = formatCharacterCardJson(card);
      const sourcePng = await imageFileToPngBytes(imageFile);
      const pngBytes = writeCharacterCardTextChunks(sourcePng, formattedJson);
      const extractedJson = readCharacterCardJsonFromPng(pngBytes);
      if (extractedJson !== formattedJson) {
        throw new Error("PNG 写入校验失败，读取出的角色卡数据不一致。");
      }
      const record = await exportRepository.create({
        projectId: project.id,
        format: "png",
        versionLabel,
        note: creator ? `署名：${creator}` : undefined,
        jsonPreview: previewJson(formattedJson),
        pngTextKey: "ccv3",
      });
      downloadBytes(pngBytes, createDownloadName(project, "png"), "image/png");
      set({ status: "ready", lastRecord: record });
      return { record, formattedJson, pngBytes };
    } catch (error) {
      const message = error instanceof Error ? error.message : "导出 PNG 失败。";
      set({ status: "failed", error: message });
      throw error;
    }
  },
  reset: () => set({ status: "idle", error: undefined, lastRecord: undefined }),
}));
