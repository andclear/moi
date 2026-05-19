import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { createElement } from "react";
import type { ReactNode } from "react";
import { vi } from "vitest";

vi.mock("animal-island-ui", () => ({
  Cursor: ({ children, className }: { children?: ReactNode; className?: string }) =>
    createElement("div", { className, "data-animal-cursor": "true" }, children),
  Footer: ({ type = "tree", className }: { type?: string; className?: string }) =>
    createElement("footer", { className, "data-animal-footer": type }),
  Icon: ({ name, size = 24, className }: { name: string; size?: number | string; className?: string }) =>
    createElement("span", {
      "aria-hidden": "true",
      className,
      "data-animal-icon": name,
      style: { display: "inline-block", width: size, height: size },
    }),
  Modal: ({
    open,
    title,
    footer,
    children,
  }: {
    open: boolean;
    title?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
  }) =>
    open
      ? createElement(
          "section",
          { role: "dialog", "aria-label": typeof title === "string" ? title : undefined },
          title ? createElement("h2", null, title) : null,
          children,
          footer,
        )
      : null,
  ICON_LIST: [],
}));
