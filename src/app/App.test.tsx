import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";

describe("App", () => {
  it("首次进入时显示开场页", async () => {
    window.localStorage.clear();
    render(<App />);

    expect(await screen.findByRole("button", { name: /去小岛上找 TA/ })).toBeInTheDocument();
  });

  it("已进入过的用户默认进入工作台", async () => {
    window.localStorage.setItem("echo.hasEntered", "true");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "你记得 TA 的哪一部分？" })).toBeInTheDocument();
  });
});
