/**
 * 归星物语移动端方向约束
 *
 * IMPORTANT FOR AI AGENTS:
 * This game only supports landscape mode.
 * Do NOT implement portrait layouts.
 *
 * 本项目只支持横屏：
 * - 所有移动端 UI / 触控 / 镜头 / 安全区域设计均以横屏 16:9 为基准。
 * - 禁止默认按竖屏手游设计、禁止做竖屏适配。
 * - 模拟器 / 浏览器测试必须先设为横屏再评价布局。
 *
 * 强制手段（已存在，勿改动）：
 * - AndroidManifest.xml: android:screenOrientation="landscape"
 * - index.html: 竖屏旋转提示层 #rotate-hint（@media (orientation: portrait)）
 */
export const MOBILE_ORIENTATION = 'landscape' as const;

/** 项目是否已锁定横屏（Android 清单 + 网页旋转提示 + 本常量三处一致） */
export const ORIENTATION_ENFORCED = true as const;
