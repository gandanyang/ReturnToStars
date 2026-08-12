/**
 * 音效系统 MVP（Phase 0.25）
 *
 * 使用 Web Audio API 程序合成短音效，无需外部音频文件。
 * 模块级单例，所有场景共用同一个 AudioContext。
 *
 * 后续可替换为真实音频文件，只需修改 play() 内部实现。
 */

type SfxName =
  | 'hoe' | 'plant' | 'water' | 'harvest' | 'buy' | 'sell' | 'levelup' | 'chop' | 'tree_fall' | 'invalid'
  // 演出音效（试玩-14）：列车 / 大门 / 星之碎片 / 观星夜
  | 'train' | 'train_hiss' | 'gate_open' | 'shard' | 'stargaze'
  // v0.10.3 首次收获：风铃/木叶轻响（一次性、低音量，区别于普通 harvest 的丰收三连音）
  | 'harvest_first'
  // v0.10.4 观星夜 v2：微风（树叶沙沙 + 远处虫鸣，低音量一次性，约 20% 强度）
  | 'wind'
  // 声音补全计划 v1.0（2026-08-09）：P0-4/5/6 成就感音效 + 高频通用音效
  | 'quest_complete' | 'repair_complete' | 'shard_deliver' | 'ui_confirm' | 'door_open' | 'door_close'
  // v1.1 采集体验升级：挖矿三击（岩石震动石屑 / 矿石破碎闪光）
  | 'rock_hit' | 'rock_break'
  // 第一章 P1-1 老屋整理：收音机"过去的声音"（程序合成生活声，零资产文件）
  | 'radio_life'
  // 第一章 P1-2 村长来访：敲门声（程序合成低频双响，零资产）
  | 'knock';

let ctx: AudioContext | null = null;

/** 懒初始化 AudioContext（浏览器要求用户交互后才能创建） */
export function getCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) throw new Error('AudioContext not supported');
    ctx = new AC();
  }
  // 某些浏览器会暂停 AudioContext，需要 resume
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

/** 播放一个简单的音调（频率 + 持续时间 + 波形） */
export function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  delay = 0,
): void {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, c.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + duration + 0.01);
}

/** 播放白噪声（用于浇水等） */
export function noise(duration: number, volume = 0.08, delay = 0): void {
  const c = getCtx();
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  // 低通滤波让噪声更柔和
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2000;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  source.start(c.currentTime + delay);
}

/**
 * 播放指定音效。
 * 用法：AudioSystem.play('harvest')
 */
export function play(name: SfxName): void {
  switch (name) {
    case 'hoe':
      // 锄地：低频碰撞感 + 土屑/土块碎裂（声音补全 v1.0 升级——"土回应我"）
      tone(80, 0.12, 'triangle', 0.26);
      tone(60, 0.08, 'sine', 0.2, 0.02);
      dirtBurst(0.09, 0.14, 0.03); // 土屑短促低通噪声（微延迟，贴合锄入瞬间）
      break;

    case 'plant':
      // 播种：轻快短促的弹跳音 + 种子落土（声音补全 v1.0——颗粒入土感）
      tone(600, 0.06, 'sine', 0.1);
      tone(800, 0.04, 'sine', 0.08, 0.03);
      dirtBurst(0.05, 0.06, 0.02); // 极轻土粒覆盖（微颗粒，不抢弹跳音）
      break;

    case 'water':
      // 浇水：柔和白噪声 + 水流 + 土壤吸水（声音补全 v1.0——低频下坠=水渗进土里）
      noise(0.25, 0.09);
      tone(400, 0.15, 'sine', 0.06, 0.05);
      tone(300, 0.22, 'sine', 0.05, 0.12); // 吸水：缓降的湿润感
      tone(220, 0.18, 'sine', 0.04, 0.2);
      break;

    case 'harvest':
      // 收获：上行三连音，丰收的愉悦感 + "啵"一声拔起（声音补全 v1.0）
      // v0.6 制作人反馈：原 880Hz 最高音偏尖锐，降频降幅使收成反馈更圆润
      dirtBurst(0.06, 0.09, 0.0); // 拔起瞬间的泥土轻响
      tone(440, 0.08, 'triangle', 0.16);
      tone(554, 0.08, 'triangle', 0.16, 0.06);
      tone(660, 0.14, 'triangle', 0.2, 0.12);
      tone(830, 0.18, 'triangle', 0.11, 0.2);
      break;

    case 'harvest_first':
      // 首次收获：风铃/木叶轻响——"土地回应"的瞬间（低音量、sine 柔、上扬尾音、不循环）
      tone(880, 0.1, 'sine', 0.08);
      tone(1175, 0.12, 'sine', 0.07, 0.08);
      tone(1568, 0.22, 'sine', 0.05, 0.16);
      break;

    case 'wind':
      // 观星夜微风（v0.10.4）：树叶沙沙（低通噪声 2.2s，音量 0.07≈20%）+ 远处虫鸣（高频短点，极轻）
      // 一次性、不循环——"声音告诉玩家：这里活着"
      noise(2.2, 0.07);
      tone(2500, 0.06, 'sine', 0.022, 0.5);
      tone(3200, 0.05, 'sine', 0.016, 1.0);
      tone(2800, 0.06, 'sine', 0.018, 1.5);
      break;

    case 'radio_life':
      // 第一章 P1-1 收音机"过去的声音"（2026-08-12，设计基线 §7.3 拍板）：
      // 不做真实电台，只做"生活声音"。电流杂音（柔和低通噪声）→ 广播信号感（双音轻响）
      // → 孩子笑/风铃（高频跳音）→ 车铃（双音）。程序合成、低音量、一次性 2.6s——
      // "声音告诉玩家：这里有过生活"。
      noise(2.6, 0.05);
      tone(392, 0.1, 'sine', 0.05, 0.4);   // 广播感单音
      tone(494, 0.1, 'sine', 0.05, 0.6);
      tone(784, 0.12, 'sine', 0.04, 1.0);  // 孩子笑般的跳音
      tone(1175, 0.1, 'sine', 0.03, 1.2);
      tone(1568, 0.18, 'sine', 0.03, 1.4); // 风铃尾音
      tone(880, 0.08, 'triangle', 0.05, 1.8);  // 车铃（双音）
      tone(1175, 0.1, 'triangle', 0.04, 1.95);
      break;

    case 'knock':
      // 第一章 P1-2 村长来访敲门声（2026-08-12）：低频闷响双连击（木门感），低音量
      // "笃、笃"两下——夜深时有人敲门，是"生活重新开始"的第一个外部信号
      tone(150, 0.12, 'triangle', 0.28);
      noise(0.05, 0.03);            // 门板共振感
      tone(140, 0.14, 'triangle', 0.26, 0.32);
      noise(0.05, 0.025, 0.32);
      break;

    case 'buy':
      // 购买：清脆的硬币声（v0.6 制作人反馈：原 square 方波谐波刺耳，改 triangle 圆润）
      tone(1100, 0.06, 'triangle', 0.06);
      tone(1450, 0.04, 'triangle', 0.04, 0.04);
      break;

    case 'sell':
      // 出售：稍低沉的硬币声（v0.6 制作人反馈：原 square 方波谐波刺耳，改 triangle 圆润）
      tone(830, 0.06, 'triangle', 0.06);
      tone(1100, 0.04, 'triangle', 0.04, 0.04);
      break;

    case 'levelup':
      // 升级：上行琶音，成就感
      tone(523, 0.1, 'triangle', 0.12);
      tone(659, 0.1, 'triangle', 0.12, 0.08);
      tone(784, 0.1, 'triangle', 0.12, 0.16);
      tone(1047, 0.2, 'triangle', 0.15, 0.24);
      break;

    case 'chop':
      // 砍树：斧头劈入木材的沉闷撞击 + 木屑碎裂感
      tone(120, 0.08, 'square', 0.18);
      tone(70, 0.12, 'triangle', 0.15, 0.01);
      noise(0.06, 0.1);
      break;

    case 'tree_fall':
      // 树倒：木质嘎吱声 → 坠地撞击
      tone(200, 0.3, 'sawtooth', 0.06);
      tone(150, 0.25, 'sawtooth', 0.05, 0.05);
      tone(80, 0.2, 'triangle', 0.12, 0.25);
      noise(0.15, 0.12, 0.3);
      break;

    case 'rock_hit':
      // 挖矿普通击：镐头凿入岩石的闷响 + 石屑溅落（低沉短促，区别于砍树的木质音）
      tone(95, 0.09, 'triangle', 0.22);
      tone(65, 0.12, 'triangle', 0.18, 0.02);
      rockBurst(0.07, 0.12, 0.02);
      break;

    case 'rock_break':
      // 矿石破碎（最后一击）：岩石碎裂 + 金属闪光余韵（成功感，同层于 tree_fall）
      tone(140, 0.14, 'square', 0.14);
      tone(90, 0.2, 'triangle', 0.16, 0.04);
      rockBurst(0.16, 0.2, 0.03); // 碎屑较多
      tone(880, 0.12, 'sine', 0.07, 0.08); // 闪光泛音（矿物亮起）
      tone(1320, 0.18, 'sine', 0.05, 0.16);
      break;

    case 'invalid':
      // 无效操作：短促低沉的"拒绝"音（区别于所有成功音效，让玩家知道"这里不能做"）
      // v0.6 制作人反馈：原 square 方波谐波刺耳，改 triangle + 略降频更低沉柔和
      tone(120, 0.1, 'triangle', 0.14);
      tone(90, 0.14, 'triangle', 0.16, 0.06);
      break;

    // ──────────── 演出音效（试玩-14，P0 发布门禁 A）────────────

    case 'train':
      // 列车：单声"哐当"（车轮过轨缝的低频金属敲击 + 车身共鸣），开场每拍调用两次
      tone(150, 0.05, 'square', 0.10);
      tone(120, 0.05, 'square', 0.08, 0.06);
      tone(75, 0.1, 'triangle', 0.13, 0.05);
      break;

    case 'train_hiss':
      // 列车到站：蒸汽"哧"声（明亮宽带噪声，慢衰减）
      {
        const c = getCtx();
        const dur = 1.1;
        const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buffer;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2600;
        bp.Q.value = 0.6;
        const g = c.createGain();
        g.gain.setValueAtTime(0.001, c.currentTime);
        g.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        src.connect(bp); bp.connect(g); g.connect(c.destination);
        src.start();
        src.stop(c.currentTime + dur + 0.01);
      }
      break;

    case 'gate_open':
      // 大门开启：铰链吱呀（下滑扫频，含金属二次吱呀）+ 门体到位撞击闷响
      {
        const c = getCtx();
        const t0 = c.currentTime;
        const creak = c.createOscillator();
        creak.type = 'sawtooth';
        creak.frequency.setValueAtTime(90, t0);
        creak.frequency.linearRampToValueAtTime(52, t0 + 0.95);
        const cg = c.createGain();
        cg.gain.setValueAtTime(0.001, t0);
        cg.gain.linearRampToValueAtTime(0.09, t0 + 0.3);
        cg.gain.linearRampToValueAtTime(0.001, t0 + 1.0);
        creak.connect(cg); cg.connect(c.destination);
        creak.start(t0); creak.stop(t0 + 1.05);
        const creak2 = c.createOscillator();
        creak2.type = 'square';
        creak2.frequency.setValueAtTime(210, t0);
        creak2.frequency.linearRampToValueAtTime(120, t0 + 0.7);
        const cg2 = c.createGain();
        cg2.gain.setValueAtTime(0.001, t0);
        cg2.gain.linearRampToValueAtTime(0.035, t0 + 0.25);
        cg2.gain.linearRampToValueAtTime(0.001, t0 + 0.75);
        creak2.connect(cg2); cg2.connect(c.destination);
        creak2.start(t0); creak2.stop(t0 + 0.8);
        // 到位撞击
        tone(70, 0.2, 'triangle', 0.24, 0.85);
        noise(0.15, 0.12, 0.85);
      }
      break;

    case 'shard':
      // 星之碎片采集：上扬琶音 + 高频闪烁（魔幻拾取感）
      tone(880, 0.09, 'sine', 0.12);
      tone(1175, 0.09, 'sine', 0.11, 0.05);
      tone(1568, 0.1, 'sine', 0.1, 0.1);
      tone(2093, 0.18, 'sine', 0.07, 0.16);
      break;

    case 'stargaze':
      // 观星夜：宁静的五声音阶琶音，极轻、长衰减（星空感）
      tone(523, 0.5, 'sine', 0.05);
      tone(659, 0.5, 'sine', 0.045, 0.15);
      tone(784, 0.6, 'sine', 0.04, 0.3);
      tone(1047, 0.7, 'sine', 0.035, 0.5);
      tone(1319, 0.8, 'sine', 0.028, 0.75);
      break;

    // ──────────── 声音补全计划 v1.0（2026-08-09）：成就感音效 + 高频通用音效 ────────────

    case 'quest_complete':
      // P0-4 任务完成：完整上行和弦（do-mi-sol-do，triangle 圆润）+ 尾音轻钟声
      // 区别于 levelup（XP 升级琶音）——"任务达成"更圆满、有收束感
      tone(523, 0.1, 'triangle', 0.13);
      tone(659, 0.1, 'triangle', 0.13, 0.07);
      tone(784, 0.12, 'triangle', 0.14, 0.14);
      tone(1047, 0.3, 'triangle', 0.16, 0.21);
      tone(1568, 0.35, 'sine', 0.04, 0.24); // 钟声泛音，柔和不刺
      break;

    case 'repair_complete':
      // P0-5 修复成功：温暖上行滑音（"建筑亮起来"的瞬间）+ 木料到位轻撞
      {
        const c = getCtx();
        const t0 = c.currentTime;
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, t0);
        osc.frequency.linearRampToValueAtTime(760, t0 + 0.4);
        const g = c.createGain();
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.12, t0 + 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
        osc.connect(g); g.connect(c.destination);
        osc.start(t0); osc.stop(t0 + 0.6);
        tone(90, 0.1, 'triangle', 0.12, 0.02); // 木料撞击
        tone(660, 0.16, 'triangle', 0.08, 0.3); // 尾声余韵
      }
      break;

    case 'shard_deliver':
      // P0-6 星之碎片交付：完整五声音阶上行 + 长衰减（"我做了一件改变岛屿的事"）
      // 比采集 shard 更完整、更亮——交付是承诺完成的瞬间
      tone(880, 0.12, 'sine', 0.11);
      tone(1175, 0.12, 'sine', 0.1, 0.08);
      tone(1568, 0.14, 'sine', 0.09, 0.16);
      tone(2093, 0.4, 'sine', 0.07, 0.24);
      tone(2637, 0.5, 'sine', 0.03, 0.3); // 高八度光感尾音
      break;

    case 'ui_confirm':
      // 通用 UI 确认：轻快短促（面板打开等），低音量不打扰
      tone(880, 0.05, 'triangle', 0.06);
      tone(1320, 0.04, 'triangle', 0.04, 0.03);
      break;

    case 'door_open':
      // 门开启：铰链吱呀（下滑短扫频，低音量）+ 到位轻撞（室内外进出）
      {
        const c = getCtx();
        const t0 = c.currentTime;
        const creak = c.createOscillator();
        creak.type = 'sawtooth';
        creak.frequency.setValueAtTime(130, t0);
        creak.frequency.linearRampToValueAtTime(72, t0 + 0.45);
        const cg = c.createGain();
        cg.gain.setValueAtTime(0.001, t0);
        cg.gain.linearRampToValueAtTime(0.05, t0 + 0.15);
        cg.gain.linearRampToValueAtTime(0.001, t0 + 0.5);
        creak.connect(cg); cg.connect(c.destination);
        creak.start(t0); creak.stop(t0 + 0.55);
        tone(80, 0.09, 'triangle', 0.1, 0.42); // 门板到位
      }
      break;

    case 'door_close':
      // 门关闭：木门轻撞（低频短促 + 极短噪声）
      tone(110, 0.07, 'triangle', 0.13);
      tone(85, 0.1, 'triangle', 0.09, 0.03);
      noise(0.04, 0.06, 0.01);
      break;
  }
}

/**
 * 土屑/颗粒噪声短促爆发（声音补全 v1.0 辅助）：低通白噪声，带极短包络。
 * 用于锄地土屑、播种落种、收获拔起等"泥土生活感"。
 */
function dirtBurst(duration: number, volume: number, delay: number): void {
  const c = getCtx();
  const bufferSize = Math.ceil(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 650; // 土感：中低频，避免"沙沙"电子感
  const g = c.createGain();
  g.gain.setValueAtTime(volume, c.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  src.start(c.currentTime + delay);
  src.stop(c.currentTime + delay + duration + 0.01);
}

/**
 * 岩屑/碎石短促爆发（v1.1 采集体验升级辅助）：中高频带通噪声，颗粒感强于土屑。
 * 用于挖矿石屑飞溅、矿石破碎的"碎裂"质感。
 */
function rockBurst(duration: number, volume: number, delay: number): void {
  const c = getCtx();
  const bufferSize = Math.ceil(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800; // 石感：中高频颗粒，区别于土屑的低通
  filter.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, c.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  src.connect(filter); filter.connect(g); g.connect(c.destination);
  src.start(c.currentTime + delay);
  src.stop(c.currentTime + delay + duration + 0.01);
}