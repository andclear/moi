import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { echoDb } from "@/db/db";
import { projectRepository } from "@/db/repositories/projectRepository";
import { StepPost } from "@/pages/workspace/StepPost";

async function resetDb() {
  await echoDb.settings.clear();
  await echoDb.projects.clear();
}

describe("StepPost", () => {
  beforeEach(async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    await resetDb();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDb();
  });

  it("未配置模型时点击领取登岛问卷会直接拦截", async () => {
    const createSpy = vi.spyOn(projectRepository, "create");
    render(
      <MemoryRouter>
        <StepPost />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("最初的印象"), {
      target: { value: "TA 总在雨夜出现，话很少，像在等一封永远不会抵达的信。" },
    });
    fireEvent.click(screen.getByLabelText("女"));
    fireEvent.click(screen.getByRole("button", { name: /领取登岛问卷/ }));

    expect(await screen.findByText(/尚未连接模型/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /前往设置/ })).toHaveAttribute("href", "/settings");
    await waitFor(() => expect(createSpy).not.toHaveBeenCalled());
  });
});
