import type { LucideIcon } from "lucide-react";

import type { FlowStepId } from "@/features/flow/flowStore";

export interface FlowStep {
  id: FlowStepId;
  label: string;
  description: string;
  icon: LucideIcon;
}
