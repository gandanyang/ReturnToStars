/**
 * BGM 播放系统（v0.10 Web Audio 改造）
 *
 * - fetch + AudioContext.decodeAudioData + AudioBufferSourceNode 播放
 * - 绕过 HTMLAudioElement 媒体嗅探（防 IDM 下载弹窗）
 * - 复用 AudioSystem 的全局 AudioContext（单例）
 * - LRU 缓存已解码音频，上限 2 首防内存膨胀
 * - 浏览器自动播放拦截：先记录 pending，首次用户交互时 ctx.resume() + 补播
 * - 场景切换由各场景 SHUTDOWN 调 stop()，避免叠播
 * - 使用 ogg（P0 资产瘦身：mp3 fallback 已移出 runtime，现代浏览器均支持 ogg vorbis）
 */

import { getCtx, isSoundEnabled } from '../systems/AudioSystem';

// 文件实际位于 public/assets/audio/music/，必须带 assets/ 前缀
const TRACKS: Record<string, string> = {
  // 主题曲（2026-08-09 制作人归档《Stars Gather》）：title_main.ogg；旧 title.ogg 保留未引用
  title: 'assets/audio/music/title_main.ogg',
  farm_day: 'assets/audio/music/farm_day.ogg',
  stargaze_night: 'assets/audio/music/stargaze_night.ogg',
  stargaze_final: 'assets/audio/music/stargaze_final.ogg',
  // 声音补全计划 v1.0（2026-08-09）：青禾镇日常 BGM + 夏雅《春深有信》专属音乐
  town: 'assets/audio/music/town.ogg',
  spring_letter: 'assets/audio/music/spring_letter.ogg',
  // 林澈个人曲（2026-08-09 制作人归档《The Waiting Shore》）：主角清晨独处等内心时刻
  linche_theme: 'assets/audio/music/linche_theme.ogg',
  // 林澈个人曲 2（2026-08-09 制作人归档《The Road I Choose》）：老屋（情绪基地）默认 BGM
  linche_theme2: 'assets/audio/music/linche_theme2.ogg',
  // 音乐盒收藏扩容（2026-08-10 制作人归档 4 首 no-watermark）：功能分配待定（"后面分功能"）
  island_wakes: 'assets/audio/music/island_wakes.ogg',
  follow_wind: 'assets/audio/music/follow_wind.ogg',
  roads_wind: 'assets/audio/music/roads_wind.ogg',
  chasing_wind: 'assets/audio/music/chasing_wind.ogg',
  // 第一章主题曲《Returning Home》（2026-08-12 制作人归档 no-watermark）：功能分配待拍板
  returning_home: 'assets/audio/music/returning_home.ogg',
};

/**
 * 音乐盒曲目目录（家的音乐盒 · P1 OST 收藏系统）
 *
 * - 仅收录已接入 TRACKS 的曲目（森林/矿洞暂缺专属曲，待声音补全后追加）
 * - 面板按此数组顺序渲染；点击即 MusicSystem.play(key)
 * - 展示"收藏唱片"感：中文名 + 英文名 + 一句话描述
 */
export interface MusicTrackMeta {
  key: string;
  /** 歌单中文名 */
  title: string;
  /** 英文名（唱片副标题） */
  en: string;
  /** 一句话描述 */
  desc: string;
}

export const MUSIC_CATALOG: MusicTrackMeta[] = [
  { key: 'title', title: '归来与新生之岛', en: 'Stars Gather', desc: '归星岛主题曲' },
  { key: 'farm_day', title: '农场日常', en: 'Farm Days', desc: '归星岛的日子' },
  { key: 'town', title: '青禾镇的清晨', en: 'Morning in Qinghe Town', desc: '小镇日常' },
  { key: 'spring_letter', title: '春深有信', en: 'Letters in Spring', desc: '夏雅主题曲' },
  { key: 'linche_theme', title: '林澈主题曲', en: 'The Waiting Shore', desc: '等待的彼岸' },
  { key: 'linche_theme2', title: '林澈·抉择之路', en: 'The Road I Choose', desc: '老屋的旋律' },
  { key: 'stargaze_night', title: '观星夜', en: 'Stargazing Night', desc: '星夜氛围' },
  { key: 'stargaze_final', title: '观星夜·终章', en: 'Starlight Finale', desc: '群星之约' },
  // 音乐盒收藏扩容（2026-08-10 制作人归档 no-watermark 版，功能分配待定——"后面分功能"）
  { key: 'island_wakes', title: '岛之苏醒', en: 'When The Island Wakes', desc: '归星岛主题曲候选' },
  { key: 'follow_wind', title: '随风而行', en: 'Follow the Wind', desc: '风之旋律 · 候选' },
  { key: 'roads_wind', title: '风之路', en: 'Roads of the Wind', desc: '风之旋律 · 候选' },
  { key: 'chasing_wind', title: '逐风', en: 'Chasing the Wind', desc: '风之旋律 · 候选' },
  // 第一章主题曲（2026-08-12 制作人归档 no-watermark）：功能分配待拍板
  { key: 'returning_home', title: '归途', en: 'Returning Home', desc: '第一章主题曲' },
];

/** 根据浏览器支持选择最佳格式 */
function getTrackUrl(key: string): string | null {
  const track = TRACKS[key];
  if (!track) return null;
  return track;
}

// ── LRU 缓存（最多 2 首） ──
const CACHE_MAX = 2;
const cache = new Map<string, AudioBuffer>();
const cacheOrder: string[] = []; // 最近使用的在末尾

function cacheGet(key: string): AudioBuffer | undefined {
  if (!cache.has(key)) return undefined;
  // 移到末尾（最近使用）
  const idx = cacheOrder.indexOf(key);
  if (idx >= 0) cacheOrder.splice(idx, 1);
  cacheOrder.push(key);
  return cache.get(key);
}

function cacheSet(key: string, buf: AudioBuffer): void {
  if (cache.has(key)) {
    const idx = cacheOrder.indexOf(key);
    if (idx >= 0) cacheOrder.splice(idx, 1);
  } else if (cacheOrder.length >= CACHE_MAX) {
    // 淘汰最久未使用的
    const evict = cacheOrder.shift();
    if (evict) cache.delete(evict);
  }
  cache.set(key, buf);
  cacheOrder.push(key);
}

// ── 播放状态 ──
// 录制视频期间全局屏蔽 BGM（2026-08-06 制作人要求）→ 已恢复（同日）。
// 2026-08-13 制作人：游戏音乐暂时屏蔽 + 重新打开开关 → 改为读取 AudioSystem 全局声音总开关
// （默认静音，开关持久化于 localStorage，见 AudioSystem.isSoundEnabled）。
let currentSource: AudioBufferSourceNode | null = null;
let currentGain: GainNode | null = null;
let currentKey: string | null = null; // 当前播放曲目（查询用：剧情中途回归补播等）
let currentVolume = 0.35;
let pendingKey: string | null = null;
// BUG-FIX（P1 竞态）：play 的 fetch→decode 为异步链，快速切图时旧解码迟到会覆盖新曲
// （在青禾镇听农场 BGM）。每次 stopCurrent/play 递增令牌，解码返回后校验，过期即丢弃。
let playToken = 0;
let retryBound = false;

// ── 音乐优先级（剧情 > 音乐盒"我的歌" > 地图默认）──
// 玩家在音乐盒选择的曲目（本次游玩有效，不写存档；音乐盒停止播放时清空）
let currentMusicBoxTrack: string | null = null;
// 剧情覆盖 BGM（观星终章 / 春深有信 / 林澈独处等），剧情结束由 endStory() 清除
let storyBgm: string | null = null;

// 播放状态变更监听（音乐盒面板实时刷新「正在播放」徽标用）
const listeners: Array<() => void> = [];
function notifyListeners(): void {
  for (const fn of listeners) fn();
}

function tryStart(): void {
  if (!pendingKey) return;
  const key = pendingKey;
  pendingKey = null;
  MusicSystem.play(key);
}

function bindRetry(): void {
  if (retryBound) return;
  retryBound = true;
  window.addEventListener('pointerdown', tryStart, { once: true, capture: true });
  window.addEventListener('keydown', tryStart, { once: true, capture: true });
}

/** 防 IDM：给 URL 加随机参数，让 IDM 识别不出是音频文件 */
function antiIDM(url: string): string {
  return url + '?_t=' + Date.now();
}

/** 加载并解码音频（fetch → AudioBuffer） */
async function loadAndDecode(key: string): Promise<AudioBuffer | null> {
  // 优先从缓存读取
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = getTrackUrl(key);
  if (!url) return null;

  try {
    const resp = await fetch(antiIDM(url));
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arrayBuf = await resp.arrayBuffer();
    const ctx = getCtx();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    cacheSet(key, audioBuf);
    return audioBuf;
  } catch (err) {
    console.warn(`[MusicSystem] 加载失败: ${key}`, err);
    return null;
  }
}

/** 停止当前播放 */
function stopCurrent(): void {
  playToken++; // 使在途的异步解码失效
  pendingKey = null;
  currentKey = null;
  if (currentSource) {
    try {
      currentSource.stop();
      currentSource.disconnect();
    } catch { /* ignore */ }
    currentSource = null;
  }
  if (currentGain) {
    try { currentGain.disconnect(); } catch { /* ignore */ }
    currentGain = null;
  }
}

export const MusicSystem = {
  async play(key: string): Promise<void> {
    if (!isSoundEnabled()) {
      stopCurrent();
      return;
    }
    const url = getTrackUrl(key);
    if (!url) return;
    // 同曲幂等：当前正在播放同一首（且无挂起重试）则继续播放，不打断重播。
    // 用途：换地图时 playSceneBgm 仍会以"我的歌/剧情曲"为目标调用本函数，
    // 命中此分支即可实现跨场景音乐连续（配合 MapScene SHUTDOWN 保留我的歌策略）。
    if (currentKey === key && currentSource && !pendingKey) {
      notifyListeners();
      return;
    }
    stopCurrent();
    const token = playToken;

    const audioBuf = await loadAndDecode(key);
    if (!audioBuf) return;
    if (token !== playToken) return; // 解码期间发生了新的 play/stop → 本次的已过期，丢弃

    // 播放
    try {
      const ctx = getCtx();
      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.loop = true;

      const gain = ctx.createGain();
      gain.gain.value = currentVolume;

      source.connect(gain);
      gain.connect(ctx.destination);

      source.start(0);

      currentSource = source;
      currentGain = gain;
      currentKey = key;
      notifyListeners();

      // 如果 AudioContext 被挂起，记录 pending 等用户交互补播
      if (ctx.state === 'suspended') {
        pendingKey = key;
        bindRetry();
      }
    } catch (err) {
      console.warn(`[MusicSystem] 播放失败: ${key}`, err);
      stopCurrent();
    }
  },

  stop(): void {
    stopCurrent();
    notifyListeners();
  },

  /** 当前播放曲目 key（无播放返回 null；供剧情补播判断） */
  current(): string | null {
    return currentKey;
  },

  setVolume(v: number): void {
    currentVolume = v;
    if (currentGain) {
      currentGain.gain.value = v;
    }
  },

  /** 订阅播放状态变更（切换/停止后触发，供 UI 实时刷新） */
  onPlaybackChange(fn: () => void): void {
    listeners.push(fn);
  },

  /** 玩家在音乐盒选择"我的歌"（null=停止播放，之后走地图默认） */
  setMusicBoxTrack(key: string | null): void {
    currentMusicBoxTrack = key;
  },

  /** 当前音乐盒"我的歌"（无选择返回 null） */
  getMusicBoxTrack(): string | null {
    return currentMusicBoxTrack;
  },

  /** 剧情音乐覆盖（优先级最高；剧情结束调 endStory() 清除） */
  playStory(key: string): void {
    storyBgm = key;
    void MusicSystem.play(key);
  },

  /** 剧情结束：清除剧情覆盖（恢复"我的歌"/地图默认由 playSceneBgm 决定） */
  endStory(): void {
    storyBgm = null;
  },

  /**
   * 计算当前优先级下的目标曲目（剧情 > 音乐盒"我的歌" > 地图默认）。
   * 返回 null 表示"不应播放 BGM"（当前无剧情覆盖、无我的歌时由调用方按地图决定默认曲）。
   */
  resolveBgmKey(mapKey: string, hour: number): string | null {
    if (storyBgm) return storyBgm;
    if (currentMusicBoxTrack) return currentMusicBoxTrack;
    if (mapKey === 'town' && hour >= 5 && hour < 19) return 'town';
    if (mapKey === 'house') return 'linche_theme2';
    // 第三章：灯塔半岛（昼=「岛之苏醒」——灯塔开放即岛屿苏醒的听觉化；夜=观星夜曲延续星空气质）。
    // 专属曲归档后在此替换（音乐制作需求清单见 docs/design/第三章音乐需求与分配方案-v0.1.md）。
    if (mapKey === 'lighthouse') return hour >= 19 || hour < 5 ? 'stargaze_night' : 'island_wakes';
    // 青禾河畔：暂沿用农场曲（第一章既定），专属曲归档后同上替换
    return hour >= 19 || hour < 5 ? 'stargaze_night' : 'farm_day';
  },

  /** 当前正在播放的曲目是否属于"地图默认曲"（非我的歌/剧情曲）——供场景 SHUTDOWN 判断是否可停止 */
  isSceneDefaultPlaying(): boolean {
    if (storyBgm || currentMusicBoxTrack) return false;
    return currentKey !== null;
  },

  /**
   * 场景 BGM 统一入口：按优先级决定播放内容。
   * 剧情 > 音乐盒"我的歌" > 地图默认（青禾镇白天=小镇曲，老屋=林澈个人曲 2《The Road I Choose》，
   * 其余白天=农场曲，夜晚=观星夜曲）。
   * 同曲幂等：目标曲与当前播放一致时直接返回，实现跨场景/剧情恢复时音乐连续不打断。
   */
  playSceneBgm(mapKey: string, hour: number): void {
    const target = MusicSystem.resolveBgmKey(mapKey, hour);
    if (!target) {
      // 理论上不会走到（resolve 恒有默认曲兜底），保险起见按 farm_day 处理
      void MusicSystem.play('farm_day');
      return;
    }
    void MusicSystem.play(target);
  },
};
