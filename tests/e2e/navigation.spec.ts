import { expect, test } from "@playwright/test";

test("基础页面可以访问", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "寻找 TA 的回声" })).toBeVisible();
  await page.getByRole("button", { name: "寻找 TA 的回声" }).click();
  await expect(page.getByRole("heading", { name: "你记得 TA 的哪一部分？" })).toBeVisible();

  await page.getByRole("link", { name: /档案库/ }).click();
  await expect(page.getByRole("heading", { name: "我的 TA 的回音" })).toBeVisible();

  await page.getByRole("link", { name: /设置/ }).click();
  await expect(page.getByRole("heading", { name: "API 与模型设置" })).toBeVisible();
  await expect(page.getByRole("link", { name: /后台/ })).toHaveCount(0);
});

test("未登录管理员访问后台会进入登录页", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("heading", { name: "后台登录" })).toBeVisible();
});

test("工作台侧边抽屉可以从内部和工具栏收起", async ({ page }) => {
  await page.goto("/workspace");

  await page.getByRole("button", { name: "打开 TA 的回音" }).click();
  await expect(page.getByRole("heading", { name: "回音墙" })).toBeVisible();

  await page.getByRole("button", { name: "关闭侧边抽屉", exact: true }).click();
  await expect(page.getByRole("heading", { name: "回音墙" })).toBeHidden();

  await page.getByRole("button", { name: "查看 API 状态" }).click();
  await expect(page.getByRole("heading", { name: "尚未连接模型" })).toBeVisible();

  await page.mouse.click(20, 180);
  await expect(page.getByRole("heading", { name: "尚未连接模型" })).toBeHidden();
});

test("寻人启事阶段不显示流程，后续阶段显示左侧流程", async ({ page }) => {
  await page.goto("/workspace/current/post");

  await expect(page.getByRole("heading", { name: "你记得 TA 的哪一部分？" })).toBeVisible();
  await expect(page.getByText("档案流程")).toHaveCount(0);

  await page.goto("/workspace/current/profile");
  await expect(page.getByText("档案流程")).toBeVisible();
  await expect(page.getByRole("heading", { name: "辨认轮廓" })).toBeVisible();
});

test("创建项目后档案库可以读取本地项目", async ({ page }) => {
  const brief = "TA 总在雨夜出现，话很少。";

  await page.goto("/workspace/current/post");
  await page.getByRole("textbox", { name: "最初的回音" }).fill(brief);
  await page.getByRole("button", { name: "开始辨认轮廓" }).click();

  await expect(page).toHaveURL(/\/workspace\/project_/);
  await page.getByRole("link", { name: /回音匣|档案库/ }).click();

  await expect(page.getByRole("link", { name: /TA 总在雨夜出现/ })).toBeVisible();
});
