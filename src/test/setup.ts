import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import React, { createElement } from "react";
import type { ReactNode } from "react";
import { vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("animal-island-ui", () => ({
  Button: ({
    children,
    loading,
    htmlType = "button",
    onClick,
  }: {
    children?: ReactNode;
    loading?: boolean;
    htmlType?: "submit" | "reset" | "button";
    onClick?: () => void;
  }) =>
    createElement(
      "button",
      { type: htmlType, "aria-busy": loading ? "true" : undefined, onClick },
      children,
    ),
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
  Select: ({
    options,
    value,
    onChange,
  }: {
    options: Array<{ key: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
  }) =>
    createElement(
      "select",
      { value, onChange: (event) => onChange((event.target as HTMLSelectElement).value) },
      options.map((option) => createElement("option", { key: option.key, value: option.key }, option.label)),
    ),
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
