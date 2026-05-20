import type { BeautificationUiStyleId } from "@/db/types";

export interface BeautificationStylePreset {
  id: BeautificationUiStyleId;
  label: string;
  prompt: string;
}

export const beautificationStylePresets: BeautificationStylePreset[] = [
  {
    id: "none",
    label: "不使用任何设计风格",
    prompt: "用户没有选择预置 UI 风格。请根据用户美化需求、角色档案和世界观自行选择合适的视觉方案，但仍必须保证可读性、移动端适配和 SillyTavern 可执行性。",
  },
  {
    id: "aurora_glass",
    label: "极光玻璃",
    prompt: [
      "使用“极光玻璃”视觉语言：未来奢华、动态渐变、高透明玻璃拟态。",
      "色彩以深宇宙蓝、极光紫、青色光带和高对比白色高光为主，可使用 #020617、#A855F7、#06B6D4、#F8FAFC。",
      "背景应有深色径向渐变或极光流动层；卡片使用 30px 以上 backdrop-filter 模糊、半透明边框和多层玻璃面板。",
      "阴影以柔和有色光晕为主，不使用笨重黑影；圆角偏大，整体应有流动、闪烁、多层纵深感。",
      "字体可参考 Inter / Outfit，标题字距略宽，界面像高级未来仪表或玻璃舱面板。",
    ].join("\n"),
  },
  {
    id: "digital_garden",
    label: "数字花园",
    prompt: [
      "使用“数字花园”视觉语言：有机形态、生态绿色、轻玻璃、自然疗愈感。",
      "色彩以清新薄荷、苔藓绿、柔和陶土色、半透明白色为主，可使用 #DFF5ED、#4A5D45、#E5957C、#F8FAF9。",
      "背景可使用植物感柔雾、浅绿色光斑或低透明有机纹理；卡片采用叶片般的圆角或非对称 squircle。",
      "阴影应大半径、低透明、非常柔和；按钮使用 pill 形和柔和绿色渐变。",
      "字体应友好、易读，整体像自然生态和数字界面的结合，而不是冷硬科技面板。",
    ].join("\n"),
  },
  {
    id: "soft_future",
    label: "软性未来",
    prompt: [
      "使用“软性未来”视觉语言：超椭圆、mesh gradient、空气感模糊、柔软触感科技。",
      "色彩以棉花糖粉、柔桃色、淡薰衣草、云白为主，可使用 #FEE2E2、#F3E8FF、#FFF1E7、#F8FAFC。",
      "背景使用大面积柔和 mesh 渐变；界面表面为半透明白，圆角 40px 以上或接近 squircle。",
      "阴影使用多层空气阴影和内阴影，像膨胀的软垫；按钮应厚实、圆润、轻微浮起。",
      "字体可参考 Comfortaa / Quicksand，整体轻盈、圆润、低压，不要锐利或高攻击性。",
    ].join("\n"),
  },
  {
    id: "cyber_elegant",
    label: "赛博优雅",
    prompt: [
      "使用“赛博优雅”视觉语言：夜色霓虹线条、发光边框、深色理性、高精度界面。",
      "色彩以黑曜石、虚空黑、电子青、霓虹紫、电粉色为主，可使用 #050505、#00F3FF、#BC13FE、#FF00BD。",
      "背景使用深黑或深蓝底，可叠加网格或扫描线；卡片为暗色半透明填充和霓虹 wireframe 边框。",
      "阴影使用紧致外发光和脉冲光，不要自然纸质阴影；圆角偏小，允许 2px 到 8px 的锐利边角。",
      "字体可参考 JetBrains Mono / Space Grotesk，适合数据密集型标题、HUD、赛博终端或黑市界面。",
    ].join("\n"),
  },
  {
    id: "nordic_minimal",
    label: "北欧简约",
    prompt: [
      "使用“北欧简约”视觉语言：克制温暖、自然纹理、低饱和、安静高级。",
      "色彩以燕麦白、鼠尾草绿、炭灰、暖米白、低饱和陶土色为主，可使用 #F9F8F6、#506053、#333333、#B58D7E。",
      "背景使用细微纸张或亚麻噪点，整体留白充足；表面尽量平整，只保留轻微层级。",
      "阴影应像自然光一样扩散，不使用霓虹或重阴影；圆角中等，约 8px 到 12px，排版精准克制。",
      "字体可参考 Plus Jakarta Sans，重点放在文字层级、间距和细分割线，适合信息清楚、成熟低调的面板。",
    ].join("\n"),
  },
];

export function getBeautificationStylePreset(styleId: BeautificationUiStyleId) {
  return beautificationStylePresets.find((preset) => preset.id === styleId) ?? beautificationStylePresets[0];
}
