import type { EchoDatabase } from "@/db/db";
import { echoDb } from "@/db/db";
import type { ActivationRecord } from "@/db/types";
import { nowIso } from "@/shared/lib/date";

const CURRENT_ACTIVATION_ID = "current";

export function createActivationRepository(db: EchoDatabase = echoDb) {
  return {
    async getCurrent() {
      return db.activations.get(CURRENT_ACTIVATION_ID);
    },

    async save(record: Omit<ActivationRecord, "id" | "updatedAt">) {
      const activation: ActivationRecord = {
        ...record,
        id: CURRENT_ACTIVATION_ID,
        updatedAt: nowIso(),
      };
      await db.activations.put(activation);
      return activation;
    },

    async clear() {
      await db.activations.delete(CURRENT_ACTIVATION_ID);
    },
  };
}

export const activationRepository = createActivationRepository();
