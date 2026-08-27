import Phaser from 'phaser';
import './ui/ui-theme.css';
import { GAME_CONFIG, GAME_TITLE } from './config';
import { TitleScene } from './scenes/TitleScene';
import { MapScene } from './scenes/MapScene';
import { StationScene } from './scenes/StationScene';
import { getTime, nextDay as timeNextDay, setTime as setGameTime, setTimeFull as setGameTimeFull, consumeMinutes as consumeGameMinutes, formatTime } from './data/TimeSystem';
import { getLevel, getXp } from './data/FarmProgress';
import { getCurrentState as natureState, getWeatherToday as natureWeather, getTimePhase as naturePhase } from './systems/NatureSystem';
import { isCurrentlyRaining } from './systems/WeatherSystem';
import { getAllDiscoveries, recordDiscovery } from './systems/DiscoveryManager';
import { refreshSchedule, getDailyNpcLine } from './systems/NPCSystem';
import { refreshDailyQuests as refreshDQ, getDailyQuestSaveData, onWoodcut as dqOnWoodcut, getDailyQuests } from './systems/DailyQuestSystem';
import { getQuestState, setQuestState } from './systems/QuestSystem';
import { resetStamina, getStamina } from './data/Stamina';
import { resetOres } from './data/MineState';
import { save, getPlayerData } from './systems/SaveSystem';
import { markRestored, getRestoreEntries } from './data/FarmRestore';
import { advanceStory, getStoryStep, setStoryStep, isObservatoryComplete, markCh1TownIntroDone } from './systems/StorySystem';
import { initAndroidBackHandler, initPcEscapeHandler } from './systems/AndroidBackHandler';
import { addItem, getItemCount } from './data/Inventory';
import { getRobotCount, runDailyAutomation } from './systems/AutomationSystem';
import { setTileState as farmSetTile, setCrop as farmSetCrop, getTileState as farmGetTile, getCrop as farmGetCrop } from './data/FarmState';
import { unlockPhoto as albumUnlock, PHOTO_DATABASE } from './data/PhotoAlbum';
import { triggerOnce, triggerOnceIf, evalCondition, hasTriggered, markTriggered, getGameEventSaveData, type GameEventSaveData, type EventCondition } from './systems/EventManager';
import { getChapter, setChapter } from './systems/ChapterSystem';
import { getHouseTidyLevel, isHouseTidyComplete } from './data/HouseTidy';
import { getTriggeredTags } from './systems/GuiXingRecordSystem';
import { MusicSystem } from './audio/MusicSystem';
import * as AmbienceSystem from './systems/AmbienceSystem';
import { play as sfxPlay, getSfxLog } from './systems/AudioSystem';
import { InteractionRouter } from './modules/InteractionRouter';
import { StorySequenceRunner } from './modules/StorySequenceRunner';
import { CutsceneGuard } from './modules/CutsceneGuard';
import { isTouchDevice } from './config';

// 桌面端标记：禁用竖屏提示层（避免开发者工具窄窗口误触发）
// 触屏设备竖屏时由 CSS @media (orientation:portrait) 显示提示
if (!isTouchDevice()) {
  document.body.classList.add('desktop');
}

// 临时调试入口：URL 带 ?reset=1 时启动前强制清除本地存档（用于移动端真机测试清档）
// 仅前端操作 localStorage，不进存档逻辑、不属于正式功能
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('reset')) {
  try {
    localStorage.removeItem('return_star_save');
    console.log('[reset] 已清除本地存档');
  } catch (e) {
    console.warn('[reset] 清档失败', e);
  }
}

// 创建 Phaser 游戏实例
// 4 个区域各注册一个 MapScene 实例，首个（农场）自动启动
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  backgroundColor: GAME_CONFIG.backgroundColor,
  title: GAME_TITLE,
  // 画布自适应：FIT + 动态逻辑宽度（见 applyAdaptiveLogicalSize）
  // 逻辑高度恒定 600，宽度随屏幕宽高比扩展 → 画布比例 = 屏幕比例，等比缩放铺满
  // 屏幕（无黑边、不裁剪）；相机 zoom=2 整数倍保持像素清晰，垂直视野恒定 300
  // 世界像素完整可见（玩家/地图永不超出镜头），水平方向显示更多地图内容。
  // 地图坐标/碰撞/NPC 位置仍基于世界坐标，不改内部尺寸
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // 像素渲染优化（屏幕适配升级）：pixelArt 禁用纹理抗锯齿避免像素发虚，
  // roundPixels 让相机/精灵渲染取整避免地图边缘抖动（高清 AI 封面单独恢复 LINEAR）
  pixelArt: true,
  roundPixels: true,
  // 启用 Arcade 物理系统（场景内 this.physics 依赖此配置）
  physics: {
    default: 'arcade',
    arcade: {
      // 物理调试已关闭（美术升级后不再需要可视化碰撞体）
      debug: false,
    },
  },
  scene: [
    new TitleScene(),
    new StationScene(),
    new MapScene('gate'),
    new MapScene('farm'),
    new MapScene('town'),
    new MapScene('forest'),
    new MapScene('mine'),
    new MapScene('house'),
    new MapScene('elder_house'),
    // 灯塔轻量版（2026-08-10 制作人解冻）：farm 海角可进入的探索区域
    new MapScene('lighthouse'),
    // 青禾河畔（2026-08-15 制作人拍板：第一章替代灯塔开放的可玩新地图）
    new MapScene('qinghe_river'),
  ],
});

// 开发阶段把 game 实例挂到 window，便于浏览器控制台调试与自动化测试
(window as unknown as { __game: Phaser.Game }).__game = game;

// Android 物理返回键层级处理（仅 Capacitor 原生环境生效；浏览器内无副作用）
initAndroidBackHandler(game);
// PC 端 Esc 系统菜单（浏览器/桌面端；与 Android 返回键行为一致）
initPcEscapeHandler(game);

/**
 * P0 防黑屏（2026-08-09）：WebGL context lost 兜底。
 * 背景：压测发现长时间切图后偶发黑屏（浏览器 GPU/渲染进程崩溃），且移动端 WebView
 * 弱 GPU/内存受限时 context lost 更常见。Phaser 不内置 contextlost 恢复，
 * 一旦丢失画面永久黑屏无反馈。这里监听 contextlost：
 *  - preventDefault 配合浏览器/驱动可能的自动重建；
 *  - 给 3 秒恢复窗口，contextrestored 触发则一切照旧（隐藏遮罩）；
 *  - 超时未恢复 → GPU 已不可用，显示遮罩 + 刷新按钮（进度有 beforeunload 自动存档），
 *    避免永久黑屏。
 */
function setupContextLostGuard(): void {
  const canvas = game.canvas;
  // 仅 WebGL 渲染器需要兜底（Canvas 渲染器不存在 context lost）
  if (!canvas || game.renderer.type !== Phaser.WEBGL) return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let overlayEl: HTMLDivElement | null = null;

  const showOverlay = (): void => {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'gl-lost-overlay';
    overlayEl.style.cssText =
      'position:fixed;top:0;right:0;bottom:0;left:0;background:#000;z-index:9999;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'font-family:Arial,sans-serif;text-align:center;padding:20px';
    const title = document.createElement('div');
    title.textContent = '图形渲染遇到问题';
    title.style.cssText = 'font-size:18px;color:#ffe082;margin-bottom:12px';
    const hint = document.createElement('div');
    hint.textContent = '游戏画面无法继续渲染，请刷新页面（进度已自动保存）';
    hint.style.cssText = 'font-size:13px;color:#aaa;max-width:80%;margin-bottom:16px';
    const btn = document.createElement('button');
    btn.textContent = '刷新页面重试';
    btn.style.cssText = 'padding:8px 20px;font-size:14px;cursor:pointer';
    btn.addEventListener('click', () => location.reload());
    overlayEl.append(title, hint, btn);
    document.body.appendChild(overlayEl);
  };

  const hideOverlay = (): void => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (timer) clearTimeout(timer);
    timer = setTimeout(showOverlay, 3000);
  });
  canvas.addEventListener('webglcontextrestored', hideOverlay);
}
setupContextLostGuard();

/**
 * 让 #game-container 尺寸 = 视口尺寸（全屏）。
 * 原因：动态逻辑宽度方案（applyAdaptiveLogicalSize）下画布比例 = 屏幕比例，
 * FIT 等比缩放后画布正好铺满视口，无黑边；容器保持全屏后，相对容器定位的
 * DOM UI（摇杆/按钮/HUD）与画布天然对齐。
 *
 * 注意：不能把容器设为 game.scale.displaySize——displaySize 基于父容器尺寸计算，
 * 容器缩小会反过来缩小 FIT 的缩放基准（循环缩小，画布只剩视口一部分）。
 *
 * 加固（P0 横屏触控布局修复）：
 * - 读取尺寸前先刷新 game.scale 的父尺寸，避免旋转/地址栏变化后取到旧 displaySize
 * - 多信号触发：Phaser resize + orientationchange + window resize（安卓 WebView 旋转时
 *   Phaser resize 偶发不触发，需 window resize 兜底）
 */
function syncGameContainer(): void {
  const c = document.getElementById('game-container');
  if (!c) return;
  c.style.width = `${window.innerWidth}px`;
  c.style.height = `${window.innerHeight}px`;
}

/**
 * 动态逻辑宽度（屏幕适配升级）：
 * 逻辑高度恒定 600（世界坐标/碰撞/NPC 位置不变），宽度随屏幕宽高比扩展，
 * 使画布比例 = 屏幕比例 → FIT 等比缩放正好铺满全屏（无黑边、不裁剪）。
 * 相机 zoom=2 保持不变 → 垂直视野恒定 300 世界像素完整可见（玩家永不丢），
 * 水平方向超宽屏显示更多地图内容（相机 setBounds 保证玩家始终在镜头内）。
 * 4:3 及更窄屏回落 800×600 原设计。
 */
function applyAdaptiveLogicalSize(): void {
  try {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!vw || !vh) return;
    const ratio = vw / vh;
    // 设计基准 800×600（4:3）；更宽屏幕按比例扩展逻辑宽度（最小 800）
    const logicalW = Math.max(800, Math.round(600 * ratio));
    const logicalH = 600;
    if (game.scale.gameSize.width !== logicalW || game.scale.gameSize.height !== logicalH) {
      game.scale.setGameSize(logicalW, logicalH);
    }
  } catch (e) {
    console.warn('[adapt] 动态逻辑尺寸调整失败', e);
  }
}

game.scale.on('resize', () => {
  syncGameContainer();
  applyAdaptiveLogicalSize();
});
window.addEventListener('orientationchange', () => {
  // 旋转瞬间 displaySize 可能仍是旧方向（安卓 WebView 时序不稳定），双延迟覆盖过渡态
  setTimeout(syncGameContainer, 300);
  setTimeout(syncGameContainer, 700);
  setTimeout(applyAdaptiveLogicalSize, 300);
  setTimeout(applyAdaptiveLogicalSize, 700);
});
window.addEventListener('resize', syncGameContainer);
window.addEventListener('resize', applyAdaptiveLogicalSize);
// visualViewport 变化（安卓地址栏收起/展开影响视口高度）也触发同步
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncGameContainer);
  window.visualViewport.addEventListener('scroll', syncGameContainer);
  window.visualViewport.addEventListener('resize', applyAdaptiveLogicalSize);
}
syncGameContainer();
applyAdaptiveLogicalSize();

// Debug API（Phase 4 仍保留，供测试用）
// 用法：
//   window.debug.nextDay()          结束今日，推进到次日 06:00
//   window.debug.setTime(21, 50)    设置当前时间（hour, minute）
//   window.debug.consumeMinutes(10) 动作时间成本（推进 n 游戏分钟，测试用）
//   window.debug.advanceStory()     推进教程剧情一步
//   window.debug.setStoryStep(s)    设置教程剧情步骤
//   window.debug.getStoryStep()     获取当前教程步骤
//   window.debug.getQuestState()     获取任务状态
//   window.debug.setQuestState(s)    设置任务状态
//   window.debug.getChapter()        获取当前章节
//   window.debug.setChapter(c)       设置当前章节（调试/章节切换验证用）
//   window.debug.setMusicBoxTrack(k) 设置音乐盒"我的歌"（null 清除，恢复地图默认）
(window as unknown as { debug: { nextDay: () => number; setTime: (h: number, m: number) => void; setTimeFull: (d: number, h: number, m: number) => void; consumeMinutes: (n: number) => void; advanceStory: () => void; setStoryStep: (s: string) => void; getStoryStep: () => string; getQuestState: () => string; setQuestState: (s: string) => void; markCh1TownIntroDone: () => void; getChapter: () => number; setChapter: (c: number) => void; getHouseTidyLevel: () => number; isHouseTidyComplete: () => boolean; getObservatoryComplete: () => boolean; getTimeStr: () => string; getStamina: () => number; getFarmXp: () => { level: number; xp: number }; giveRobot: (n?: number) => void; robotCount: () => number; giveItem: (item: string, count: number) => void; getItemCount: (item: string) => number; markRestored: (key: string) => void; getRestoreEntries: () => Record<string, boolean>; nature: { state: () => { id: string; label: string; gatherKinds: string[] }; weather: () => string; weatherLegacy: () => string; phase: () => string; discoveries: () => Record<string, { resourceId: string; firstDiscoverDay: number; firstDiscoverLocation?: string; specialDiscoveries: string[] }>; recordDiscovery: (resourceId: string, day: number, location: string, special?: string) => 'created' | 'special_added' | 'noop' }; npcDaily: (npcId: string, location?: string) => Array<{ speaker: string; color: string; text: string }> | null; farm: { setTileState: (col: number, row: number, state: string) => void; setCrop: (col: number, row: number, crop: { cropType: string; plantDay: number; watered: boolean } | undefined) => void; getTileState: (col: number, row: number) => string; getCrop: (col: number, row: number) => { cropType: string; plantDay: number; watered: boolean } | undefined }; unlockPhoto: (id: string) => void; getPhotoTotal: () => number; guixingTags: () => string[]; musicCurrent: () => string | null; setMusicBoxTrack: (k: string | null) => void; sfx: (name: string) => void; sfxLog: () => string[]; ambience: () => { map: string | null; layers: number }; interactionRouter: { resolveTarget: (candidates: Array<{ id: string; check: () => boolean; data?: () => unknown }>) => { id: string; data?: unknown } | null; describeTarget: (target: { id: string; data?: unknown } | null) => string; checkGate: (snapshot: any) => any; describeGate: (result: any) => string }; events: { triggerOnce: (id: string, fn: () => void) => boolean; triggerOnceIf: (id: string, cond: EventCondition | undefined, fn: () => void) => boolean; evalCondition: (cond?: EventCondition) => boolean; hasTriggered: (id: string) => boolean; markTriggered: (id: string) => void; getSaveData: () => GameEventSaveData }; storySequenceRunner: { createRunner: () => { isPlaying: boolean; currentId: string | null }; playDialogue: (id: string, lineCount: number) => { result: boolean; isPlaying: boolean; currentId: string | null }; interrupt: () => { isPlaying: boolean; currentId: string | null }; getState: () => { isPlaying: boolean; currentId: string | null; startCalled: boolean; endCalled: boolean; completeCalled: boolean; interrupted: boolean }; getSceneRunnerState: () => { isPlaying: boolean; currentId: string | null } | { error: string } }; cutsceneGuard: { unit: () => Record<string, boolean>; getSceneState: () => { isAnyActive: boolean; isBlocked: boolean; isWindowLocked: boolean; activeIds: string[]; snapshot: Record<string, boolean> } | { error: string }; testSetterGetter: () => { initVal: boolean; afterSet: boolean; afterClear: boolean; gateSnapshot: Record<string, unknown> | null } | { error: string } } } }).debug = {
  getChapter,
  setChapter,
  getHouseTidyLevel,
  isHouseTidyComplete,
  events: {
    triggerOnce,
    triggerOnceIf,
    evalCondition,
    hasTriggered,
    markTriggered,
    getSaveData: getGameEventSaveData,
  },
  markRestored: (key: string) => {
    markRestored(key as any);
    // Dev 后门（2026-08-16 制作人拍板 Bug 2）：用当前活跃玩家位置保存，不覆盖为 0,0,''
    const scene = game.scene.getScenes(true)[0] as MapScene | undefined;
    const player = (scene as unknown as { player?: { x: number; y: number; facing: string } })?.player;
    if (player) {
      save({ x: player.x, y: player.y, scene: scene?.scene.key ?? 'farm', facing: player.facing } as any);
    } else {
      const existing = getPlayerData();
      save(existing ?? { x: 0, y: 0, scene: 'farm', facing: 'down' });
    }
  },
  getRestoreEntries,
  nextDay: () => {
    // Phase 4 起统一走 TimeSystem.nextDay，它内调 FarmState.advanceDay
    const newDay = timeNextDay();
    // v0.6 庄园自动化：机器人每日清晨自动浇水/收获
    runDailyAutomation();
    // 体力恢复 + 矿脉刷新 + 每日任务刷新
    resetStamina();
    resetOres();
    refreshDQ();
    const scene = game.scene.getScenes(true)[0] as MapScene | undefined;
    if (scene) {
      if (typeof scene.createDailyQuestPanel === 'function') {
        scene.createDailyQuestPanel();
      }
      if (typeof scene.refreshFarmVisual === 'function') {
        scene.refreshFarmVisual();
      }
    }
    // 睡觉后自动存档（含每日任务数据）
    if (scene) {
      const player = (scene as unknown as { player?: { x: number; y: number; facing: string } })?.player;
      if (player) {
        save({
          x: player.x, y: player.y,
          scene: scene.scene.key, facing: player.facing,
          dailyQuest: getDailyQuestSaveData(),
        } as any);
      }
    }
    console.log(`[debug] nextDay → Day ${newDay} 06:00`);
    return newDay;
  },
  setTime: (hour: number, minute: number) => {
    setGameTime(hour, minute);
    // 时间跳变后刷新 NPC 日程并重建当前场景 NPC
    refreshSchedule();
    const scene = game.scene.getScenes(true)[0] as MapScene | undefined;
    if (scene && typeof scene.rebuildNPCs === 'function') {
      scene.rebuildNPCs();
    }
    console.log(`[debug] setTime → Day ${getTime().day} ${formatTime()}`);
  },
  setTimeFull: (day: number, hour: number, minute: number) => {
    setGameTimeFull(day, hour, minute);
    console.log(`[debug] setTimeFull → Day ${day} ${hour}:${String(minute).padStart(2, '0')}`);
  },
  // 自然状态钩子（指向游戏真实 NatureSystem 实例，绕过 Vite dev 双模块问题；探针经此测试）
  nature: {
    state: () => {
      const s = natureState();
      return { id: s.id, label: s.label, gatherKinds: s.gatherKinds };
    },
    // 2026-08-16：天气统一到 WeatherSystem（isCurrentlyRaining，Day2 10-16 时雨窗）。
    // 保留 natureWeather() 供对比旧占位规则，但"当前是否真的在下雨"以此为准。
    weather: () => (isCurrentlyRaining() ? 'rain' : 'clear'),
    weatherLegacy: () => natureWeather(),
    phase: () => naturePhase(),
    // P1 Discovery 图鉴：真实实例的发现记录快照（探针经此读取，绕过 Vite dev 双模块问题）
    discoveries: () => getAllDiscoveries(),
    // 真实实例的发现记录写入（探针经此写入，再经 SaveSystem 验证存档往返）
    recordDiscovery: (resourceId: string, day: number, location: string, special?: string) =>
      recordDiscovery({ resourceId, day, location, special }),
  },
  // 天气扩面第二刀（2026-08-16）：NPC 生活台词快照（探针经此读主实例 getDailyNpcLine，
  // 绕过 Vite dev 双模块分裂——动态 import 命中 ?t= 副本会导致时间读取不一致）
  npcDaily: (npcId: string, location?: string) =>
    getDailyNpcLine(npcId, getTime().day, location),
  consumeMinutes: (n: number) => {
    consumeGameMinutes(n);
    console.log(`[debug] consumeMinutes → ${n}min（${formatTime()}）`);
  },
  advanceStory: () => {
    advanceStory();
    console.log(`[debug] advanceStory → ${getStoryStep()}`);
  },
  setStoryStep: (s: string) => {
    setStoryStep(s as any);
    console.log(`[debug] setStoryStep → ${s}`);
  },
  // 钓鱼 Phase 1 探针需要：跳过 town 入口剧情（避免 storyDialogue.isOpen() 阻断钓鱼交互）
  markCh1TownIntroDone: () => markCh1TownIntroDone(),
  getStoryStep: () => {
    return getStoryStep();
  },
  getQuestState: () => {
    return getQuestState();
  },
  setQuestState: (s: string) => {
    setQuestState(s as any);
    console.log(`[debug] setQuestState → ${s}`);
  },
  getObservatoryComplete: () => {
    return isObservatoryComplete();
  },
  getTimeStr: () => {
    return formatTime();
  },
  getStamina: () => {
    return getStamina();
  },
  getFarmXp: () => {
    return { level: getLevel(), xp: getXp() };
  },
  giveRobot: (n = 1) => {
    addItem('auto_farmer_robot', n);
    console.log(`[debug] giveRobot → +${n} auto_farmer_robot`);
  },
  robotCount: () => {
    return getRobotCount();
  },
  giveItem: (item: string, count: number) => {
    addItem(item as any, count);
    console.log(`[debug] giveItem → ${item} ×${count}`);
  },
  getItemCount: (item: string) => {
    return getItemCount(item as any);
  },
  // 农场状态钩子：指向游戏真实 FarmState 实例（绕过 Vite dev 双模块问题，供自动化测试驱动）
  farm: {
    setTileState: (col, row, state) => {
      farmSetTile(col, row, state as never);
      console.log(`[debug] farm.setTileState(${col},${row}) → ${state}`);
    },
    setCrop: (col, row, crop) => {
      farmSetCrop(col, row, crop as never);
      console.log(`[debug] farm.setCrop(${col},${row})`);
    },
    getTileState: (col, row) => {
      return farmGetTile(col, row);
    },
    getCrop: (col, row) => {
      return farmGetCrop(col, row);
    },
  },
  // 相簿 debug 挂钩（指向游戏真实实例，供探针/测试驱动解锁，绕过 dev 双模块问题——同 dailyQuest 模式）
  unlockPhoto: (id: string) => albumUnlock(id),
  getPhotoTotal: () => PHOTO_DATABASE.length,
  // v1.0 生活仪式感：归星记录一次性标签只读钩子（探针断言 first_hoe/first_water 等，绕过双模块）
  guixingTags: () => Array.from(getTriggeredTags()),
  // 声音补全 v1.0（2026-08-09）：BGM 当前曲目只读钩子（探针断言 town/spring_letter 播放）
  musicCurrent: () => MusicSystem.current(),
  setMusicBoxTrack: (k) => {
    MusicSystem.setMusicBoxTrack(k);
    if (k) {
      void MusicSystem.play(k);
    }
  },
  // 声音补全 v1.0：SFX 冒烟钩子（探针调用各音效 key 验证可播放无异常）
  sfx: (name: string) => sfxPlay(name as never),
  // B-2（2026-08-13 体验债务）：最近请求播放的音效 key 列表（探针断言 tidy_bed/lamp/desk/radio_life 接线）
  sfxLog: () => getSfxLog(),
  // 声音补全 v1.0（2026-08-09）：环境音状态钩子（探针断言地图环境音组合已创建）
  ambience: () => ({ map: AmbienceSystem.getActiveMap(), layers: AmbienceSystem.getSourceCount() }),
  // P7b: InteractionRouter 交互目标解析测试钩子（探针验证优先级与纯函数行为）
  interactionRouter: (() => {
    const router = new InteractionRouter();
    return {
      // 解析目标（纯函数，仅在浏览器中测试用）
      resolveTarget: (candidates: Array<{ id: string; check: () => boolean; data?: () => unknown }>) => {
        return router.resolveTarget(candidates);
      },
      // 调试信息
      describeTarget: (target: { id: string; data?: unknown } | null) => {
        return router.describeTarget(target as any);
      },
      // 门控调试（复用 P7a 探针）
      checkGate: (snapshot: any) => {
        return router.checkGate(snapshot);
      },
      describeGate: (result: any) => {
        return router.describeGate(result);
      },
    };
  })(),
  // P7c-b: StorySequenceRunner 剧情序列编排测试钩子
  storySequenceRunner: (() => {
    let runner: StorySequenceRunner | null = null;
    let mockDialogue: { play: (lines: any[], onComplete?: () => void, onChoice?: (index: number) => void) => void; reset: () => void; isOpen: () => boolean } | null = null;
    let state = { isPlaying: false, currentId: null as string | null, startCalled: false, endCalled: false, completeCalled: false, interrupted: false };

    function ensureRunner() {
      if (!runner) {
        mockDialogue = {
          play: (_lines, onComplete) => {
            state.isPlaying = true;
            setTimeout(() => {
              state.isPlaying = false;
              if (onComplete) onComplete();
            }, 50);
          },
          reset: () => { state.isPlaying = false; },
          isOpen: () => state.isPlaying,
        };
        runner = new StorySequenceRunner(mockDialogue as any, {
          onDialogueStart: () => { state.startCalled = true; },
          onDialogueEnd: () => { state.endCalled = true; },
        });
      }
      return runner;
    }

    function resetState() {
      state = { isPlaying: false, currentId: null, startCalled: false, endCalled: false, completeCalled: false, interrupted: false };
    }

    return {
      createRunner: () => {
        resetState();
        const r = ensureRunner();
        r.setHooks({
          onDialogueStart: () => { state.startCalled = true; },
          onDialogueEnd: () => { state.endCalled = true; },
          updateHUD: () => {},
        });
        return { isPlaying: r.isPlaying(), currentId: r.getCurrentSequenceId() };
      },
      playDialogue: (id: string, lineCount: number) => {
        const r = ensureRunner();
        resetState();
        const lines = Array.from({ length: lineCount }, (_, i) => ({
          speaker: `测试${i}`,
          color: '#ffffff',
          text: `对话行 ${i + 1}`,
        }));
        state.completeCalled = false;
        const result = r.playDialogue(id, lines, () => { state.completeCalled = true; });
        return { result, isPlaying: r.isPlaying(), currentId: r.getCurrentSequenceId() };
      },
      interrupt: () => {
        const r = ensureRunner();
        r.interrupt();
        state.interrupted = true;
        return { isPlaying: r.isPlaying(), currentId: r.getCurrentSequenceId() };
      },
      getState: () => {
        const r = ensureRunner();
        const { isPlaying: _ip, currentId: _cid, ...restState } = state;
        return {
          isPlaying: r.isPlaying(),
          currentId: r.getCurrentSequenceId(),
          ...restState,
        };
      },
      // 测试：获取当前 MapScene 的 runner 状态（集成测试）
      getSceneRunnerState: () => {
        const scene = game.scene.getScenes(true)[0];
        if (!scene) return { error: 'no_scene' };
        // 调试：输出场景类型和可用属性
        const sceneProto = Object.getPrototypeOf(scene);
        const sceneType = sceneProto?.constructor?.name || typeof scene;
        const hasRunner = 'storySequenceRunner' in scene;
        const sr = (scene as unknown as { storySequenceRunner?: StorySequenceRunner }).storySequenceRunner;
        if (!sr) return { error: 'no_runner', sceneType, hasRunner };
        return {
          isPlaying: sr.isPlaying(),
          currentId: sr.getCurrentSequenceId(),
        };
      },
      // 测试：MapScene.playStory 实际调用验证
      testPlayStory: (id: string, lineCount: number, options: { withOnComplete?: boolean } = {}) => {
        const scene = game.scene.getScenes(true)[0];
        if (!scene) return { error: 'no_scene' };
        if (!(scene instanceof MapScene)) return { error: 'not_map_scene', sceneType: scene.constructor.name };
        
        const lines = Array.from({ length: lineCount }, (_, i) => ({
          speaker: `测试${i}`,
          color: '#ffffff',
          text: `对话行 ${i + 1}`,
        }));
        
        let completeCalled = false;
        const result = (scene as MapScene).playStory(
          lines,
          options.withOnComplete ? () => { completeCalled = true; } : undefined,
          undefined,
          id,
        );
        
        const sr = (scene as unknown as { storySequenceRunner?: StorySequenceRunner }).storySequenceRunner;
        return {
          result,
          isPlaying: sr?.isPlaying() ?? false,
          currentId: sr?.getCurrentSequenceId() ?? null,
          completeCalled,
          hasDialogue: !!(scene as unknown as { storyDialogue?: unknown }).storyDialogue,
        };
      },
      // 测试：验证 dialogueFactory 自动创建
      testDialogueAutoCreate: () => {
        const scene = game.scene.getScenes(true)[0];
        if (!scene) return { error: 'no_scene' };
        if (!(scene instanceof MapScene)) return { error: 'not_map_scene', sceneType: scene.constructor.name };
        
        const s = scene as unknown as {
          storyDialogue?: { isOpen: () => boolean } | null;
          storySequenceRunner: StorySequenceRunner;
        };
        
        // 记录初始状态
        const hadDialogue = !!s.storyDialogue;
        const wasPlaying = s.storySequenceRunner.isPlaying();
        
        // 如果已有对话，先重置
        if (s.storyDialogue?.isOpen()) {
          s.storySequenceRunner.interrupt();
        }
        
        // 调用 playStory，它应该自动创建 dialogue
        const result = (scene as MapScene).playStory(
          [{ speaker: '', color: '#ffffff', text: '自动创建测试' }],
          undefined,
          undefined,
          'auto_create_test',
        );
        
        return {
          hadDialogueBefore: hadDialogue,
          wasPlayingBefore: wasPlaying,
          playResult: result,
          hasDialogueAfter: !!s.storyDialogue,
          isPlayingAfter: s.storySequenceRunner.isPlaying(),
          currentIdAfter: s.storySequenceRunner.getCurrentSequenceId(),
        };
      },
    };
  })(),
  // P8: CutsceneGuard 场景演出守卫测试钩子
  cutsceneGuard: (() => {
    let guard: CutsceneGuard | null = null;

    function ensureGuard() {
      if (!guard) {
        guard = new CutsceneGuard();
      }
      return guard;
    }

    return {
      unit: () => {
        const g = ensureGuard();
        const r: Record<string, boolean> = {};
        r.initiallyNoActive = !g.isAnyActive();
        r.initiallyNotBlocked = !g.isBlocked();
        g.begin('stargaze');
        r.stargazeActive = g.isActive('stargaze');
        r.anyActiveAfterBegin = g.isAnyActive();
        g.begin('art_show');
        r.bothActive = g.getActiveIds().length === 2;
        g.end('stargaze');
        r.onlyArtShow = g.isActive('art_show') && !g.isActive('stargaze');
        g.beginWindow();
        r.windowLocked = g.isWindowLocked();
        r.blockedByWindow = g.isBlocked();
        g.endWindow();
        r.windowUnlocked = !g.isWindowLocked();
        g.end('art_show');
        r.allCleared = !g.isAnyActive() && !g.isBlocked();
        g.begin('stargaze'); g.beginWindow();
        const snap = g.getSnapshot();
        r.snapshotStargaze = snap.inStargazeCutscene === true;
        r.snapshotFirstMorning = snap.firstMorningActive === true;
        g.end('stargaze'); g.endWindow();
        return r;
      },
      getSceneState: () => {
        const scene = game.scene.getScenes(true)[0];
        if (!scene) return { error: 'no_scene' };
        const cg = (scene as unknown as { cutsceneGuard?: CutsceneGuard }).cutsceneGuard;
        if (!cg) return { error: 'no_guard' };
        return {
          isAnyActive: cg.isAnyActive(),
          isBlocked: cg.isBlocked(),
          isWindowLocked: cg.isWindowLocked(),
          activeIds: cg.getActiveIds(),
          snapshot: cg.getSnapshot(),
        };
      },
      testSetterGetter: () => {
        const scene = game.scene.getScenes(true)[0];
        if (!scene || !(scene instanceof MapScene)) return { error: 'not_map_scene' };
        const s = scene as unknown as Record<string, boolean>;
        const initVal = s['inStargazeCutscene'];
        s['inStargazeCutscene'] = true;
        const afterSet = s['inStargazeCutscene'];
        s['inStargazeCutscene'] = false;
        const afterClear = s['inStargazeCutscene'];
        const gs = (scene as unknown as { buildGateSnapshot?: () => Record<string, unknown> }).buildGateSnapshot?.();
        return { initVal, afterSet, afterClear, gateSnapshot: gs ?? null };
      },
    };
  })(),
};

// 每日任务 debug 挂载（指向游戏真实实例，供自动化测试驱动红点生命周期，绕过 dev 双模块问题）
(window as unknown as {
  dailyQuest: {
    onWoodcut: () => void;
    getClaimable: () => string[];
    // 测试辅助：强制第一条可完成任务置为已完成未领奖（仅测试，不属产品逻辑）
    forceClaimableFirst: () => boolean;
  }
}).dailyQuest = {
  onWoodcut: () => dqOnWoodcut(),
  getClaimable: () => getDailyQuests().filter(q => q.completed && !q.claimed).map(q => q.id),
  forceClaimableFirst: () => {
    const q = getDailyQuests().find(x => !x.completed && !x.claimed);
    if (!q) return false;
    q.progress = q.target;
    q.completed = true;
    return true;
  },
};

export default game;
