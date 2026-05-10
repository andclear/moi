import Dexie, { type Table } from "dexie";

import { ECHO_DB_NAME, ECHO_DB_STORES } from "@/db/schema";
import type {
  ActivationRecord,
  AdminSettingRecord,
  ExportRecord,
  GenerationTask,
  HistorySnapshot,
  Project,
  SettingsRecord,
} from "@/db/types";

export class EchoDatabase extends Dexie {
  settings!: Table<SettingsRecord, string>;
  activations!: Table<ActivationRecord, string>;
  adminSettings!: Table<AdminSettingRecord, string>;
  projects!: Table<Project, string>;
  histories!: Table<HistorySnapshot, string>;
  generations!: Table<GenerationTask, string>;
  exports!: Table<ExportRecord, string>;

  constructor(name = ECHO_DB_NAME) {
    super(name);
    this.version(1).stores(ECHO_DB_STORES);
  }
}

export const echoDb = new EchoDatabase();

export function createEchoDatabase(name: string) {
  return new EchoDatabase(name);
}
