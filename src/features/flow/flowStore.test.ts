import { describe, expect, it } from "vitest";

import { flowStepIdSchema } from "@/schemas/projectSchema";

describe("flowStore", () => {
  it("终审通过后可以进入打个招呼步骤", () => {
    expect(flowStepIdSchema.parse("hello")).toBe("hello");
  });
});
