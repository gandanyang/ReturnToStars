/**
 * 剧情系统 — 序章：归乡
 *
 * 状态流转：
 *   station_intro → station_move → arrive_manor → xiya_talk → get_key
 *   → gate_opened → clear_land → sow_seeds → water_crops → evening_talk → done
 */

import { isMobileLayout } from '../config';

export type StoryStep =
  | 'station_intro'       // 车站开场对话
  | 'station_move'        // 移动教学：前往星黎庄园
  | 'arrive_manor'        // 到达庄园门口
  | 'xiya_talk'           // 与夏雅对话
  | 'get_key'             // 获得庄园钥匙
  | 'gate_opened'         // 大门打开，夏雅给锄头
  | 'clear_land'          // 清理3块土地
  | 'sow_seeds'           // 夏雅给种子，播种3块
  | 'water_crops'         // 夏雅给水壶，浇水
  | 'evening_talk'        // 晚间对话
  | 'done'                // 教程完成
  | 'observatory_complete'; // 观星夜收尾完成（Demo 结尾终态，复用 storyStep 模式）

/** 全部合法剧情步骤（存档边界保护白名单，SaveSystem 复用） */
export const STORY_STEPS: StoryStep[] = [
  'station_intro', 'station_move', 'arrive_manor', 'xiya_talk', 'get_key',
  'gate_opened', 'clear_land', 'sow_seeds', 'water_crops', 'evening_talk',
  'done', 'observatory_complete',
];

export interface DialogueLine {
  speaker: string;
  color: string;
  text: string;
  inner?: boolean;
  /** 选项行：显示为可点击选项（当前仅观星夜收尾使用） */
  options?: string[];
}

export const COLORS = {
  linche: '#7eb8da',
  xiya: '#f0a050',
  elder: '#c8b898',
  girl: '#b8a0e8',
  letter: '#e8d8a8',
  system: '#aaaaaa',
  miner: '#b89878',
  gardener: '#a0d888',
  adventurer: '#88b8e8',
  laojiang: '#d8b878',
};

/** 操作提示文案：移动端（触屏）与桌面端（键盘）差异 */
function hint(pc: string, mob: string): string {
  return isMobileLayout() ? mob : pc;
}

// ============ 对话数据 ============

/** 车站开场（v0.10 收口：压缩独白 + 目的地锚 + 出发前主动选择）
 *  P0-3（2026-08-08 制作人拍板）：独白压到核心 4 句（五年/换个环境/爷爷说/自己选），
 *  保留 station_01~04 配音匹配；删 2 个冗余旁白 + 末尾移动 hint（由 showMoveHint 承担）；
 *  目的地锚「爷爷把这里留给了他」+ 出发前选择「现在就走吗？」/「再看看这里。」（选项行由
 *  StationScene.onChoice 收尾，不影响流程/存档/step）。 */
export const STATION_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（手机屏幕还亮着。HR 的话停在最后一句：）' },
  { speaker: '', color: COLORS.system, text: '「林先生，根据评估，你完全可以加入智能生态部门。」' },
  { speaker: '', color: COLORS.system, text: '（留在城市？还是……去看看爷爷留下的地方？）' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '五年了。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '……换个环境，也许也不错。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '我不是讨厌AI，只是突然发现，我好像很久没有认真看过一次天空了。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '爷爷说，如果不知道往哪走，就回来看看。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '至少这次，是我自己选的离开。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '……爷爷把这里留给了我。' },
  { speaker: '', color: COLORS.system, text: '', options: ['现在就走吗？', '再看看这里。'] },
];

/** 初遇夏雅（v0.7 减少等待感） */
export const XIYA_DIALOGUE: DialogueLine[] = [
  { speaker: '夏雅', color: COLORS.xiya, text: '你就是林澈？' },
  { speaker: '林澈', color: COLORS.linche, text: '你认识我？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '林爷爷以前提过你。……大家都以为，不会有人回来了。' },
  { speaker: '林澈', color: COLORS.linche, text: '我也没想到自己会回来。本来只是想看看爷爷留下的地方。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '那就先从这扇门开始吧。' },
  { speaker: '', color: COLORS.system, text: '（夏雅递出钥匙。）' },
  { speaker: '', color: COLORS.system, text: hint('获得物品：【庄园钥匙】  按 [B] 键打开背包，使用钥匙打开大门。', '获得物品：【庄园钥匙】  点按右下角「背包」按钮，使用钥匙打开大门。') },
];

/** 开门后 → 整理庄园（v0.7 旧锄头+祖孙情感；E-07 现实动机+情感动机叠加）
 *  2026-08-09 开场 180 秒优化（制作人拍板）：11 → 8 句——删除疑问+解释组（"爷爷一个人打理/只要还有人愿意住下来"）
 *  与说教收尾（"有些事要等你自己回来"），保留四件套：荒凉第一眼 → 旧物锚点（锄头）→ 情绪入口（没跟我说过这些）→ 行动目标。
 *  关联配音：gate_03/gate_04/gate_07 随删句停用（voicebank 已同步移除映射，音频文件保留）。 */
export const GATE_OPENED_DIALOGUE: DialogueLine[] = [
  { speaker: '林澈', color: COLORS.linche, text: '……比我以为的还要荒。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '这里以前不是这样的。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '旧了点，但还能用。你爷爷当年就是用这把锄头，把这片地一锄一锄开出来的。' },
  { speaker: '林澈', color: COLORS.linche, text: '他从来没跟我说过这些。' },
  { speaker: '', color: COLORS.system, text: '（夏雅拿出一把旧锄头。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '先开三块地。地要先翻过，才愿意接住新的种子。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '小时候觉得翻土很麻烦。现在才发现，土地一直在等有人重新照顾它。' },
  { speaker: '', color: COLORS.system, text: hint('获得物品：【旧锄头】  对着农田区域按 [E] 键锄地，清理 3 块土地。', '获得物品：【旧锄头】  对着农田区域点「交互」锄地，清理 3 块土地。') },
];

/** v0.5.3 剧情密度 E1：夏雅清晨偶遇（教程完成后，清晨 06-08 时进入农场触发） */
export const XIYA_DAWN_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（清晨的庄园很安静。夏雅蹲在田边，正看着昨夜露水下的土地。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '这么早？我睡不着，就过来看看这些地。' },
  { speaker: '林澈', color: COLORS.linche, text: '你每天都起这么早？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '（笑）岛上的人都这样。太阳一出来，就想醒着。' },
  { speaker: '林澈', color: COLORS.linche, text: '……我以前，都是被闹钟叫醒的。' },
];

/**
 * 第一章「复苏」开场独白（[A-1] 章节切换仪式感，2026-08-13 制作人拍板）
 *
 * 叙事定位：观星夜结束 → EndingPanel 关闭后，玩家站在 farm 晨光里。
 * 此刻玩家心理从"昨晚看星"跳到"今天种田"，缺少"我决定住下了"的认知信号。
 * 本对白用 3 行建立"新生活开始"的仪式感，承接第0章结尾、引出第一章老屋整理。
 *
 * 触发：EndingPanel.onClose → 延迟 600ms → triggerOnce('ch1_awakening')
 * 与 first_morning_response（day2 清晨）时间错开，不冲突。
 */
export const CH1_AWAKENING_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（晨光里，林澈站在老屋前。昨晚的星星还留在记忆里。）' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '……是的。这里，可以是我新的家。' },
  { speaker: '', color: COLORS.system, text: '（新的一天开始了。该去老屋看看，整理一下了。）' },
];

/**
 * 岛屿的第一声回应（day2 清晨自动触发，制作人定稿 2026-08-07，Agent 不得扩写/改写）
 * 关键剧情节点：第一天睡觉后，玩家第一次"完整循环"的回报——岛屿开始回应玩家的努力。
 * 触发：day2 清晨首次进 farm（EventManager triggerOnce 判重，见 MapScene.tryFirstMorningSequence）。
 * day3+ 清晨仍走 XIYA_DAWN_DIALOGUE 闲聊（两条并存）。
 */
export const FIRST_MORNING_RESPONSE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（清晨。阳光从老屋的窗户透进来，外面传来鸟叫和风吹树叶的声音。）' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '……天亮了。' },
  { speaker: '', color: COLORS.system, text: '（林澈走到门口。夏雅已经站在老屋门口，正看着农田。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '早上好，林澈。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '昨晚睡得还好吗？' },
  { speaker: '林澈', color: COLORS.linche, text: '还行……只是感觉这里安静得有点过头了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。以前爷爷还在的时候，天不亮就有人起来种田、修路、聊天。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '后来人慢慢少了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不过今天早上，我过来看了看——昨天的苗还立着。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '如果愿意的话，可以帮我一起整理一下这里。' },
  { speaker: '', color: COLORS.system, text: '（新目标：让农场重新运转起来——收获成熟作物 / 种下新的作物 / 清理农场杂物）' },
  { speaker: '', color: COLORS.system, text: '（田里，昨天种下的萝卜苗，有一株已经悄悄长高了一点。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '你看，这株。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '昨晚睡觉前我来看过，还只有这么点。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '以前爷爷种东西的时候，也喜欢蹲在旁边看半天。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '他说，种下去以后，剩下的事情，就交给时间。' },
];

/** v0.5.3 剧情密度 E5：爷爷的笔记（庄园角落可读物件，多条轮换、不解释） */
export const GRANDPA_NOTES: DialogueLine[] = [
  { speaker: '爷爷的笔记', color: COLORS.letter, text: '今年番茄长得很好，比去年早熟了几天。' },
  { speaker: '爷爷的笔记', color: COLORS.letter, text: '后山的竹子又长高了，看来春天比往年来得早。' },
  { speaker: '爷爷的笔记', color: COLORS.letter, text: '村口老周家的孩子回来了一趟，带了不少城里的东西。' },
  { speaker: '爷爷的笔记', color: COLORS.letter, text: '今晚的星星，比往年亮。' },
];

/** v0.5.3 剧情密度 E2：第一次收获反馈（v0.8 生活化） */
export const FIRST_HARVEST_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夏雅不知什么时候走了过来，看着你手里的收获。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '第一次自己种出来？' },
  { speaker: '林澈', color: COLORS.linche, text: '嗯。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '感觉怎么样？' },
  { speaker: '林澈', color: COLORS.linche, text: '比想象中重。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '看吧。它真的长出来了。有时候，土地比我们想象得更愿意回应。' },
];

/** v0.5.3 剧情密度 E9：夏雅傍晚简单关心（v0.8 删 KPI/周报） */
export const XIYA_EVENING_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（傍晚的庄园染上一层金色。夏雅坐在栅栏边，看着远处的海。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '累吗？' },
  { speaker: '林澈', color: COLORS.linche, text: '挺累的。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '以前你也是这样？' },
  { speaker: '林澈', color: COLORS.linche, text: '嗯。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '那以后记得早点休息。' },
];

/** NPC 剧情覆盖日程扩展（2026-08-16）：河畔夏雅（16-18 时在青禾河畔出现，看河/发呆，18 点后回农场） */
export const XIYA_RIVERSIDE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（河边的风比庄园大一点。夏雅蹲在岸边的石头上，看着水面出神。）' },
  { speaker: '林澈', color: COLORS.linche, text: '怎么一个人来河边？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '下午没事，就想来看看水。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '以前爷爷还在的时候，天一热他就搬个凳子坐这儿。什么都不干，就看。' },
  { speaker: '林澈', color: COLORS.linche, text: '……看什么？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不知道。可能就是觉得，水一直在流，心里就踏实。' },
  { speaker: '', color: COLORS.system, text: '（她站起身，拍了拍裙子上的土。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '快傍晚了，我该回去了。你要是有空，明天下午也来坐坐。' },
];

/**
 * 河畔夏雅·雨天变体（2026-08-16 天气扩面第二刀，制作人拍板）：
 * 雨日 16-18 河畔看水时播放（雨窗 10-16，雨天她也在河边看雨），呼应雨天河螺——
 * "雨天是青禾镇的自然日"，看水对白与雨天世界规律同源。D-017 文风已审。
 */
export const XIYA_RIVERSIDE_RAIN_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（雨落进河里，溅起很细的圈。夏雅蹲在岸边的石头上，撑着伞看水面。）' },
  { speaker: '林澈', color: COLORS.linche, text: '下雨天也来看水？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '下雨的时候，水面上什么都会冒出来。' },
  { speaker: '', color: COLORS.system, text: '（她指了指浅滩的方向。水汽里，好像有什么东西在动。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '雨天的河，跟晴天的河，不是同一条河。' },
  { speaker: '林澈', color: COLORS.linche, text: '……就为了看这个？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。小时候爷爷说，别怕下雨，那是河在说话。' },
];

/**
 * L3「点灯人」观察台词（灯意象，制作人拍板 2026-08-05：缺陷保持 v1.3，只加侧面表现）
 * 首次傍晚与夏雅对话时追加（MapScene 内存标记 lampFlashbackDone 控制，一次性，不入档）
 * 内容：林澈发现村里人都依赖夏雅，却没人问过她累不累——缺陷的侧面表现。
 */
export const XIYA_EVENING_OBS_DIALOGUE: DialogueLine[] = [
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '村里人有什么难处，第一个想到的都是夏雅。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '可好像，从没人问过她，累不累。' },
];

/** 清理完成 → 播种（v0.7 生活化引导；A2 角色自主表达测试：删②林澈总结式独白「先有人开始」，独白只保留一处=开垦处①） */
export const SOW_SEEDS_DIALOGUE: DialogueLine[] = [
  { speaker: '夏雅', color: COLORS.xiya, text: '地翻好了。把萝卜种子撒下去，浇水后就会发芽。' },
  { speaker: '', color: COLORS.system, text: '获得物品：【萝卜种子】×3' },
  { speaker: '', color: COLORS.system, text: hint('按 [R] 键切换到萝卜种子，然后对着锄过的土地按 [E] 播种。播种 3 块土地。', '对着锄过的土地点「交互」播种萝卜（默认种子）。播种 3 块土地。') },
];

/** 播种完成 → 浇水（v0.7 生活化引导；E-08 金币循环意义：卖钱→修庄园；A2：③林澈独白改技术脑「观察→分析」短句） */
export const WATER_CROPS_DIALOGUE: DialogueLine[] = [
  { speaker: '夏雅', color: COLORS.xiya, text: '种下去，就得天天来看它。你爷爷说，庄稼最怕被忘记。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '水浇下去，能不能活，明天才知道。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '庄园还有不少地方需要修，等收成以后，可以拿去镇上的店换些钱。' },
  { speaker: '林澈', color: COLORS.linche, text: '卖掉？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。留下需要的，换成需要的东西，这里才能慢慢恢复起来。' },
  { speaker: '', color: COLORS.system, text: '获得物品：【旧水壶】' },
  { speaker: '', color: COLORS.system, text: hint('对已播种的土地按 [E] 键浇水。为所有作物浇水。', '对已播种的土地点「交互」浇水。为所有作物浇水。') },
];

/** 晚间结尾（v0.7 第一夜·睡前+旧笔记本） */
export const EVENING_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夜晚，林澈坐在庄园门口，看着重新整理过的土地。）' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '以前总觉得，只要不断追赶时代，就不会被淘汰。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '可是现在……也许慢下来，也不是坏事。' },
  { speaker: '', color: COLORS.system, text: '（回到屋里，翻到一本旧笔记本。）' },
  { speaker: '', color: COLORS.system, text: '（笔记本里夹着一张纸条：「今年番茄长得很好。植物似乎会记住照顾它的人。」）' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '……爷爷连种地都要记笔记。' },
  { speaker: '', color: COLORS.system, text: '回到床上睡觉，结束第一天。' },
];

// ============ 第一章：小镇的居民 ============

/** 首次进入小镇 */
export const TOWN_INTRO_DIALOGUE: DialogueLine[] = [
  // 2026-08-13 P0 残留清理：对齐新地图实际路径（第一章从农场老屋进镇，非第0章"庄园石桥"）
  { speaker: '', color: COLORS.system, text: '（清晨，林澈从老屋出来，沿着土路走了一段，第一次踏上青禾镇的街道。）' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '这就是青禾镇……爷爷信里提起过的地方。' },
  { speaker: '', color: COLORS.system, text: '（街道两旁是低矮的木屋，商店门口已经支起了摊子。一个老人正在清扫门前的台阶。）' },
  { speaker: '', color: COLORS.system, text: '（镇长早就听说老屋来了新主人。他放下扫帚，朝林澈招了招手。）' },
  { speaker: '', color: COLORS.system, text: hint('（靠近镇长、商人或居民，按 [E] 键与他们对话。镇长看起来有话想说。）', '（靠近镇长、商人或居民，点「交互」与他们对话。镇长看起来有话想说。）') },
];

/** 镇长委托星之碎片任务（第一章主线开启，v0.8 拆信息+老人化） */
export const ELDER_QUEST_DIALOGUE: DialogueLine[] = [
  { speaker: '镇长', color: COLORS.elder, text: '你就是小林吧？林爷爷家的孙子。' },
  { speaker: '林澈', color: COLORS.linche, text: '您好，您是……' },
  { speaker: '镇长', color: COLORS.elder, text: '我是青禾镇的镇长。你爷爷啊，年轻时候就喜欢晚上坐在那块石头上看天。' },
  { speaker: '林澈', color: COLORS.linche, text: '……他真的喜欢看星星？' },
  { speaker: '镇长', color: COLORS.elder, text: '喜欢。他以前也经常往后山跑。' },
  { speaker: '林澈', color: COLORS.linche, text: '去做什么？' },
  { speaker: '镇长', color: COLORS.elder, text: '（笑了笑）他说那里有些东西，值得看看。' },
  { speaker: '', color: COLORS.system, text: '（镇长看向远处的后山，没有再说下去。）' },
  { speaker: '林澈', color: COLORS.linche, text: '……那我去看看吧。' },
  { speaker: '', color: COLORS.system, text: '主线任务已接受：去爷爷以前常去的后山看看。' },
];

/** A4 角色自主表达测试（2026-08-10 制作人定稿）：day1 见过镇长（elder_starter_gift 已触发）后的承接版，
 *  去掉重复自我介绍「你就是小林吧/您好您是……」；day1 未见过仍用 ELDER_QUEST_DIALOGUE 完整版。 */
export const ELDER_QUEST_RETURN_DIALOGUE: DialogueLine[] = [
  { speaker: '镇长', color: COLORS.elder, text: '来了。你爷爷的事，我们接着聊。' },
  { speaker: '镇长', color: COLORS.elder, text: '昨天那个石头后面，我就知道你会来。' },
  { speaker: '镇长', color: COLORS.elder, text: '你爷爷啊，年轻时候就喜欢晚上坐在那块石头上看天。' },
  { speaker: '林澈', color: COLORS.linche, text: '……他真的喜欢看星星？' },
  { speaker: '镇长', color: COLORS.elder, text: '喜欢。他以前也经常往后山跑。' },
  { speaker: '林澈', color: COLORS.linche, text: '去做什么？' },
  { speaker: '镇长', color: COLORS.elder, text: '（笑了笑）他说那里有些东西，值得看看。' },
  { speaker: '', color: COLORS.system, text: '（镇长看向远处的后山，没有再说下去。）' },
  { speaker: '林澈', color: COLORS.linche, text: '……那我去看看吧。' },
  { speaker: '', color: COLORS.system, text: '主线任务已接受：去爷爷以前常去的后山看看。' },
];

/** f7（2026-08-07 制作人拍板）：第一天镇长「暂时有事」——主线委托推迟到第二天，顺带赠送启动物资 */
export const ELDER_BUSY_DIALOGUE: DialogueLine[] = [
  { speaker: '镇长', color: COLORS.elder, text: '你就是小林吧？林爷爷家的孙子。' },
  { speaker: '林澈', color: COLORS.linche, text: '您好，您是……' },
  { speaker: '镇长', color: COLORS.elder, text: '我是青禾镇的镇长。本想跟你好好聊聊你爷爷的事——' },
  { speaker: '', color: COLORS.system, text: '（镇长叹了口气，指了指身后正在修缮的公告栏。）' },
  { speaker: '镇长', color: COLORS.elder, text: '镇上这几天忙着修缮，我实在抽不开身。明天吧，明天你来镇长家找我，咱们详谈。' },
  { speaker: '镇长', color: COLORS.elder, text: '这些是给你准备的启动物资：种子、工具，还有一点金币、木材和石头。你先在农场安顿下来。' },
  { speaker: '', color: COLORS.system, text: hint('（获得镇长赠送的启动物资。镇长说：明天再来详谈。）', '（获得镇长赠送的启动物资。镇长说：明天再来详谈。）') },
];

/** f7：第一天再次对话（礼物已给）——镇长简短提醒，不重复长篇 */
export const ELDER_BUSY_SHORT_DIALOGUE: DialogueLine[] = [
  { speaker: '镇长', color: COLORS.elder, text: '这几天镇上忙着修缮。你先在农场安顿，明天来镇长家找我详谈你爷爷的事。' },
];

/** 交付星之碎片（第一章完成）
 *  v0.10.1（2026-08-08 制作人方向）：弱化"解释设定"，强化"老人经验 + 情感收尾"——
 *  碎片不是旧答案（等着被发现的）+ 归乡的意义（终于又有人走到这里来）。 */
export const SHARD_DELIVER_DIALOGUE: DialogueLine[] = [
  { speaker: '林澈', color: COLORS.linche, text: '镇长，星之碎片……我拿到了。' },
  { speaker: '', color: COLORS.system, text: '（林澈摊开手掌，一枚泛着幽蓝光芒的碎片静静躺在掌心。）' },
  { speaker: '镇长', color: COLORS.elder, text: '这光泽……没错，就是星之碎片。你爷爷当年捡到第一片的时候，也是这样的光。' },
  { speaker: '镇长', color: COLORS.elder, text: '他还说，这座岛上的碎片，只有真正"想留下来"的人才能拿起来。' },
  { speaker: '镇长', color: COLORS.elder, text: '你能把它带回来，说明这一次，是你自己选择了回来。' },
  { speaker: '林澈', color: COLORS.linche, text: '……我其实没做什么。它就在那儿，我只是走过去拿起来而已。' },
  { speaker: '镇长', color: COLORS.elder, text: '（笑）那就够了。你愿意走过去，它就愿意回应你。' },
  { speaker: '镇长', color: COLORS.elder, text: '不过，比起它是什么，我更在意一件事——' },
  { speaker: '镇长', color: COLORS.elder, text: '这么多年过去，终于又有人走到这里来了。' },
  { speaker: '镇长', color: COLORS.elder, text: '你爷爷以前啊，总喜欢在晚上去农田后面的地方坐一会儿。他说，那里的星星很亮。' },
  { speaker: '', color: COLORS.system, text: '夜晚，也许可以去看看爷爷曾经看过的天空。' },
  { speaker: '', color: COLORS.system, text: '主线任务完成：星之碎片（1/…）。' },
];

// ============ Demo 结尾：观星 ============

// ============ 第一章：森林碎片（程序员能力展示） ============

/** 后山观景台：环境铺垫对白（一次性，靠近观景台触发；v0.10.1 第二层——"先让环境说话"）
 *  作用：告诉玩家归星岛过去不是"神秘"，而是"有人生活过"。
 *  世界观适配：原建议"看看海"→ 星空意象（与观星夜/爷爷看天闭环）。 */
export const FOREST_LOOKOUT_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（林间空地上，立着一座旧木台。木板已经发黑，边角的围栏塌了半边。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '……这里以前有个观景台。' },
  { speaker: '林澈', color: COLORS.linche, text: '看风景用的？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不算。大家只是喜欢坐在这里，看看星星。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '（抬头看了看树影间的天空）……爷爷也常来这里吗。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。他说这里的星星，比别处亮。' },
];

/** 森林采集对话（首次交互播放，结束后自动采集）
 *  v0.10.1（2026-08-08 制作人方向）：碎片发现从"任务道具"升级为"林澈重新认识归星岛"的事件——
 *  环境铺垫（这里曾有人生活）→ 碎片是"新变化"（夏雅也从没见过）→ 林澈情感反应（归来者视角）。 */
export const FOREST_SHARD_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（后山的小路尽头，是一片安静的空地。石阶上覆着青苔，像是很久没有人走过了。）' },
  { speaker: '', color: COLORS.system, text: '（一棵老树旁，一块泛着幽蓝光芒的碎片静静躺在树根之间。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '……这个，我以前从没见过。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '在岛上住了这么久，也没听人提过后山有这样的东西。' },
  { speaker: '林澈', color: COLORS.linche, text: '（走近蹲下）……它一直在这里吗？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不知道。也许，是这几天才出现的。' },
  { speaker: '林澈', color: COLORS.linche, text: '不是没有反应。' },
  { speaker: '林澈', color: COLORS.linche, text: '更像一个长期没有维护的系统。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '什么？' },
  { speaker: '林澈', color: COLORS.linche, text: '它在等待一个条件。没有回应，是因为条件还没满足。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '……你又在说奇怪的话了。' },
  { speaker: '林澈', color: COLORS.linche, text: '职业习惯。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '（抬头看了看这座岛）我以为回来以后，只会看到一座快要消失的岛。' },
  { speaker: '', color: COLORS.girl, text: '……它已经很久没有这样亮过了。' },
];

// ============ 引导对话：砍树 + 挖矿 ============

/** 砍树引导（教程完成后第一次砍树触发；夏雅引导版） */
export const WOODCUT_TIP_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（林澈握着旧斧头，站在庄园的老树下。）' },
  { speaker: '林澈', color: COLORS.linche, text: '……爷爷留下的庄园，要修的地方还不少。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '这些树正好用得上。砍下来的木材，能卖钱，也能修房子。' },
  { speaker: '林澈', color: COLORS.linche, text: '你倒是把什么都想好了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '（笑）在岛上住久了，自然就懂这些了。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '以前只会删代码，现在倒要学着砍树了。' },
  { speaker: '', color: COLORS.system, text: hint('靠近树，按 [E] 键用斧头砍伐。木材可以卖钱或修建设施。', '靠近树，点「交互」用斧头砍伐。木材可以卖钱或修建设施。') },
];

/** 挖矿引导（第一次进入矿洞触发；v0.8 减解释+爷爷线） */
export const MINE_TIP_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（矿洞深处，岩壁上隐约有光芒闪烁。）' },
  { speaker: '林澈', color: COLORS.linche, text: '那些发光的矿石……' },
  { speaker: '夏雅', color: COLORS.xiya, text: '老张年轻时候就在矿洞里讨生活，说那些石头、铜矿都能卖钱。' },
  { speaker: '林澈', color: COLORS.linche, text: '（点点头）那我挖一点回去试试。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '别逞强，你爷爷以前也是，忙起来连饭都忘了吃。' },
  { speaker: '林澈', color: COLORS.linche, inner: true, text: '以前加班熬到半夜，也没人跟我说"累了就歇着"。' },
  { speaker: '', color: COLORS.system, text: hint('靠近发光的矿脉，按 [E] 键开采。矿石可以卖给商店老板。', '靠近发光的矿脉，点「交互」开采。矿石可以卖给商店老板。') },
];

/** M1-3 爷爷的旧花园：夏雅见证对白（花园恢复完成后，夏雅在花园旁出现，靠近触发）
 *  制作人确认文案（2026-08-03）：生活记忆型——不解释主题，只补充一个生活片段。
 *  范围限定：A/B 类生活对白，无剧情节点/任务/StoryStep/存档字段。 */
export const GARDEN_RESTORED_XIYA_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夏雅不知什么时候站在了花园边，看着重新种上的花。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '这里以前也是爷爷最喜欢来的地方。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '小时候我经常看到他坐在这里，一坐就是很久。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '他说，院子有人照顾，就不会冷清。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '奇怪……爷爷以前说，这里的花总是比别的地方开得早。' },
  // L1 旧灯对话（灯意象，制作人拍板 2026-08-05：灯=工具包修出的旧物；追加于花园见证一次性对话）
  { speaker: '林澈', color: COLORS.linche, text: '你总背着这个旧工具包。……里面那盏灯，还用着？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。因为它还能亮。' },
  { speaker: '林澈', color: COLORS.linche, text: '坏了换一个不是更方便？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '可是它陪了我很多年。' },
];

/** FEATURE-037 统一对白批次 environment_restore_v010：老屋修复完成 → 镇长（制作人 2026-08-06 定稿）
 *  范围限定：A/B 类生活对白；花园恢复沿用既有 GARDEN_RESTORED_XIYA_DIALOGUE（制作人拍板，不新增小梅） */
export const OLD_HOUSE_RESTORED_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（老屋修好的第二天，镇长路过，在门口站了一会儿。）' },
  { speaker: '镇长', color: COLORS.elder, text: '你爷爷以前每天都会擦这里。' },
  { speaker: '林澈', color: COLORS.linche, text: '……擦门吗？' },
  { speaker: '镇长', color: COLORS.elder, text: '擦整座屋子。他说，人走了不要紧，屋子不能没人擦。' },
];

/** FEATURE-037 统一对白批次 environment_restore_v010：后山道路修复完成 → 老张（制作人 2026-08-06 定稿） */
export const FOREST_ROAD_RESTORED_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（矿场的老张扛着镐子路过，踩着新铺的石板路，愣了一下。）' },
  { speaker: '老张', color: COLORS.miner, text: '以前这条路通向整个岛。' },
  { speaker: '林澈', color: COLORS.linche, text: '现在也能了。' },
  { speaker: '老张', color: COLORS.miner, text: '（咧嘴一笑）好小子。' },
];

/** FEATURE-041 复兴循环 v0.11：木匠回归演出对白（老屋修复完成后，次日进入 farm 自动触发）
 *  已定稿（制作人 2026-08-10，A1 角色自主表达测试）：老周描述动作不总结规律，
 *  收尾"嗯。东西都带来了。"=生活事实非主题表达；结构=作者总结→玩家发现。
 *  角色定位：青禾镇留下来的手艺人，不善言辞但可靠；重建行动的第一个具体执行者。 */
export const CARPENTER_RETURN_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（老屋修好的第二天清晨，一个背着工具箱的人站在门口，正打量新补好的屋瓦。）' },
  { speaker: '木匠老周', color: '#c89860', text: '……瓦换过了。' },
  { speaker: '林澈', color: COLORS.linche, text: '嗯。我爷爷留下的。' },
  { speaker: '林澈', color: COLORS.linche, text: '荒了几年，我想着先修起来。' },
  { speaker: '木匠老周', color: '#c89860', text: '修得不错。' },
  { speaker: '木匠老周', color: '#c89860', text: '门轴、窗栓、田边的栅栏……有不顺手的地方，喊我。' },
  { speaker: '林澈', color: COLORS.linche, text: '你是说……你要留下？' },
  { speaker: '木匠老周', color: '#c89860', text: '（看了一眼工具箱）' },
  { speaker: '木匠老周', color: '#c89860', text: '嗯。东西都带来了。' },
  { speaker: '', color: COLORS.system, text: '（归星岛，多了一个会修东西的人。）' },
];

/** 反馈 #28：阿风热情欢迎「你回来了！」（一次性：玩家去过镇上第一章后回农场自动触发）
 *  纯生活化欢迎，不涉及主角成长/世界观/主线走向；触发实现见 MapScene.tryAdventurerWelcome。
 *  配音：阿风 4 条台词由 gen_voice.py 生成（adv_07/08/09/10），VoiceBank 按 (speaker,text) 匹配。
 *  2026-08-13 制作人拍板台词定稿（#28 v1.0 任务卡落地）：
 *   - 保留 adv_07「嘿！你回来了！」（复用）
 *   - 新增 adv_10「没想到这么多年过去，你还是回来了。」（点出童年旧友）
 *   - 替换 adv_08 →「我这些年也一直在外面跑，有时候走着走着，会想起小时候我们在这里吹风的日子。」
 *     （立旅行者身份 + 岛特殊联系，触碰旅行/故乡边缘但不展开）
 *   - 替换 adv_09 →「是啊，不过风还是那个风。慢慢来吧，我相信这里会重新热闹起来。」
 *     （呼应「追风的人」意象 + 留下期待，优于原「有人气就行」）
 *  镜像主题：林澈离开城市→回故乡；阿风离开故乡→看过世界→都回到青禾镇（角色分工：林澈归来 / 夏雅守护与记忆 / 阿风远方与自由 / 爷爷土地与传承）。 */
export const ADVENTURER_WELCOME_BACK_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（刚走进庄园，就看见阿风靠在木屋前的栅栏上，远远地朝你挥手。）' },
  { speaker: '阿风', color: '#88b8e8', text: '嘿！你回来了！' },
  { speaker: '林澈', color: COLORS.linche, text: '阿风？你怎么跑这里来了？' },
  { speaker: '阿风', color: '#88b8e8', text: '没想到这么多年过去，你还是回来了。' },
  { speaker: '阿风', color: '#88b8e8', text: '我这些年也一直在外面跑，有时候走着走着，会想起小时候我们在这里吹风的日子。' },
  { speaker: '林澈', color: COLORS.linche, text: '（笑）看来这里变化挺大的。' },
  { speaker: '阿风', color: '#88b8e8', text: '是啊，不过风还是那个风。慢慢来吧，我相信这里会重新热闹起来。' },
];

// ============ T2 改动 2：关键对白 ============
/** 镇长「为什么种田」：星之碎片交付完成后追加。
 *  2026-08-16 P1-01 改稿（制作人拍板方向：少讲道理、多讲具体生活，7→5 行）：
 *  保留一个具体生活细节（邻居给葱），删讲道理句与内部重复；末句落回玩家自己种的萝卜（行动型）。 */
export const ELDER_WHY_FARM_DIALOGUE: DialogueLine[] = [
  { speaker: '镇长', color: COLORS.elder, text: '以前家里缺点葱，出门喊一声，邻居就能给你一把。' },
  { speaker: '镇长', color: COLORS.elder, text: '后来日子好了，什么都买得到。菜市场、商店，要啥有啥。' },
  { speaker: '镇长', color: COLORS.elder, text: '可有时候，买回来的东西，总觉得少了点味儿。' },
  { speaker: '镇长', color: COLORS.elder, text: '自己地里收的，才知道这一口是怎么来的。' },
  { speaker: '镇长', color: COLORS.elder, text: '今年你那几畦萝卜，我看长势就好。' },
];

/** 夏雅「为什么小事会改变这里」：花园恢复见证对白（GARDEN_RESTORED_XIYA_DIALOGUE）后追加
 *  制作人 2026-08-06 定稿第一版（价值观但不演讲；不否定大事，只肯定小事价值；与玩家行为直接对应） */
export const XIYA_SMALL_THINGS_DIALOGUE: DialogueLine[] = [
  { speaker: '夏雅', color: COLORS.xiya, text: '你有没有发现，最近青禾镇好像比以前热闹了一点？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '其实也没发生什么特别大的事情。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '就是有人把院子收拾了一下，有人种了些花，田里的菜也慢慢长起来了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '以前我总觉得，要让这里变回来，得做一件很厉害的事情。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '后来才发现，好像不是这样。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '这些小事情多起来了，这里也就慢慢有了人生活的感觉。' },
];

/**
 * 第一章 P2 捕虫「自然记录」分享（2026-08-13，制作人拍板方向：观察→分享→情感连接，非送礼系统）。
 * 玩家清晨把在花丛里捉到的蝴蝶标本交给夏雅，解锁一句旧日记忆——分享无好感数值、无奖励循环，
 * 奖励即"世界因你的观察而回应你"。一次性（triggerOnce('natural_record_butterfly_xiya')）。
 */
export const XIYA_BUTTERFLY_SHARE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夏雅接过蝴蝶标本，安静地看了很久。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '……这是蝴蝶？' },
  { speaker: '林澈', color: COLORS.linche, text: '嗯，今天在花丛里看到的。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '好久没有这么仔细看过一只蝴蝶了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '小时候，我总觉得夏天应该很长很长。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '一抬头，蝴蝶还在，风也还在。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '后来不知道从什么时候开始，大家都变得很忙。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '连这些小东西什么时候消失了，都没人发现。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '谢谢你。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '你让我想起来——青禾镇，其实一直没有离开过。' },
];

// ============ P0.5 世界规律引导（2026-08-16 制作人拍板：生活发现式引导，不做任务） ============
// 原则：第一次明确告知 → 第二次环境暗示 → 第三次以后交给玩家记忆。
// 第一版只做"雨天→森林→蘑菇"（真实天气链 WeatherSystem → ResourceSpawner → DiscoveryManager 已闭环，
// 只差把关系告诉玩家）。触发侧在 MapScene（triggerOnce 一次性，不进任务系统）。

/** 第一场雨：小梅在农场顺口提起（第一次明确告知，玩家自主决定去不去） */
export const RAIN_MUSHROOM_HINT_DIALOGUE: DialogueLine[] = [
  { speaker: '花匠小梅', color: COLORS.gardener, text: '下雨啦……后山的蘑菇，是不是又冒出来了？' },
  { speaker: '林澈', color: COLORS.linche, text: '蘑菇还跟下雨有关系？' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '你自己去看看不就知道了。' },
];

/** 雨天第一次进森林：环境暗示（不直接告诉，只描述看到的） */
export const RAIN_FOREST_ENTRANCE_HINT_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（雨水顺着树叶滴下来。地上好像多了些平时没见过的东西。）' },
];

/**
 * 第一章 P2「自然记录」第三段昆虫观察（2026-08-13，制作人拍板方向：观察→记录→连接生命）。
 * 玩家捕捉到青禾凤蝶后，靠近小梅（gardener）按 E → 小梅递放大镜 → 玩家通过对话选项观察 3 个特点
 * （翅膀颜色 / 活动时间 / 喜欢环境）→ 填满自然笔记 → 解锁「青禾镇自然记录 1/10」。
 * 结尾以小梅点睛台词收束主题："原来它们一直都在"。一次性（triggerOnce('ch1_natural_record_1')）。
 */
export const XIAOMEI_OBSERVE_INTRO_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（小梅看见你手里的蝴蝶标本，眼睛亮了起来。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '咦，你捉到的？给我看看！' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '这种蝴蝶我好像见过，但一直没好好看过。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '来，用这个。看仔细点，别急着走。' },
];

/** 小梅递放大镜后，玩家逐项观察 3 个特点（选项行，onChoice 逐项引导） */
export const XIAOMEI_OBSERVE_CHOICES_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（小梅递过来一只放大镜。蝴蝶薄薄的翅膀，在光下透出浅蓝。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '先看它的翅膀——' },
  { speaker: '', color: COLORS.system, text: '', options: ['看翅膀的颜色', '看它什么时候出现', '看它喜欢待在哪里'] },
];

/** 逐项观察的小梅引导台词（按下标对应：0翅膀 1活动时间 2环境） */
export const XIAOMEI_OBSERVE_DETAIL_DIALOGUE: DialogueLine[][] = [
  [
    { speaker: '林澈', color: COLORS.linche, text: '翅膀……是一种浅浅的蓝，最外面一圈颜色淡一些。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '嗯，你看它边缘那圈，像水晕开一样。这种蓝，只有青禾镇的花丛附近才有。' },
  ],
  [
    { speaker: '林澈', color: COLORS.linche, text: '它好像……白天才会出来，太阳一高就躲起来了。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '对，它喜欢清早和傍晚。天太热了，它就去花影里歇着。' },
  ],
  [
    { speaker: '林澈', color: COLORS.linche, text: '它总喜欢待在花丛附近，不怎么飞远。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '因为它认得这片花。花在，它就在。' },
  ],
];

// ============ 第一章 P2-1 集市「重新开张」布置玩法（Phase 2，2026-08-13 制作人拍板） ============
// 需求匹配布置：资源交付清理场地后，玩家按居民需求把 3 个摊位放对位置。
//   布置点 0=工具摊（老张，靠近路边）｜1=小吃摊（小梅，中间聚人气）｜2=花摊（夏雅，老树旁）。
//   放对 → 摊位就位 + 正面反馈；放错 → 温和纠正（不消耗，可重试）；3 摊齐 → 开张演出。
// 选项顺序固定：['工具摊','小吃摊','花摊'] = ['tool','food','flower']。

/** 摊位选项（菜单显示顺序 = 类型下标：0 工具 1 小吃 2 花） */
export const MARKET_STALL_OPTIONS = ['工具摊', '小吃摊', '花摊'] as const;

/** 每个布置点的需求提示（按下标对应：0 老张工具摊 1 小梅小吃摊 2 夏雅花摊） */
export const MARKET_STALL_HINT_DIALOGUES: DialogueLine[][] = [
  [
    { speaker: '', color: COLORS.system, text: '（老张站在广场路边，看着你搬来的摊架子。）' },
    { speaker: '老张', color: COLORS.miner, text: '工具摊要挨着路边摆，赶集的人放下锄头就能顺路买。' },
    { speaker: '', color: COLORS.system, text: '', options: [...MARKET_STALL_OPTIONS] },
  ],
  [
    { speaker: '', color: COLORS.system, text: '（小梅在广场中间比划着，眼睛亮晶晶的。）' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '中间摆个小吃摊吧，香味一飘大家就聚过来，我也好看个热闹。' },
    { speaker: '', color: COLORS.system, text: '', options: [...MARKET_STALL_OPTIONS] },
  ],
  [
    { speaker: '', color: COLORS.system, text: '（夏雅抱着几盆花，在广场一角的老树边停下来。）' },
    { speaker: '夏雅', color: COLORS.xiya, text: '花摊就放老树边上吧，花香飘到歇脚的人那里，正好。' },
    { speaker: '', color: COLORS.system, text: '', options: [...MARKET_STALL_OPTIONS] },
  ],
];

/** 放错摊位后的温和纠正（按下标对应布置点；不消耗、可重试） */
export const MARKET_STALL_WRONG_DIALOGUES: DialogueLine[][] = [
  [
    { speaker: '老张', color: COLORS.miner, text: '这个放这儿不合适。工具摊得挨着路边，方便人放下东西就走。' },
  ],
  [
    { speaker: '花匠小梅', color: COLORS.gardener, text: '中间不放这个啦，得留个聚人气的小吃摊，大家才愿意来。' },
  ],
  [
    { speaker: '夏雅', color: COLORS.xiya, text: '这个不配呀。花摊要放在老树边上，让经过的人一眼看到花。' },
  ],
];

/** 放对摊位后的正面反馈（按下标对应布置点） */
export const MARKET_STALL_PLACED_DIALOGUES: DialogueLine[][] = [
  [
    { speaker: '老张', color: COLORS.miner, text: '对，就这儿。镐头、灯油都摆上，赶集的乡亲要用伸手就够得着。' },
  ],
  [
    { speaker: '花匠小梅', color: COLORS.gardener, text: '好嘞！小吃摊开在这儿，香味一飘，准有人顺着味儿过来。' },
  ],
  [
    { speaker: '夏雅', color: COLORS.xiya, text: '花摆好了。老树底下，又有了颜色。' },
  ],
];

/** 3 摊齐开张演出（灯亮 / 人来 / 音乐 → 世界状态变化，制作人 2026-08-12 拍板） */
export const MARKET_OPEN_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（三个摊位都搭好了。灯一盏一盏亮起来，广场另一边传来脚步声。）' },
  { speaker: '镇长', color: COLORS.elder, text: '灯一亮，人一聚，青禾镇又像从前了。……谢谢你，林澈。' },
  { speaker: '商店老板', color: '#8ac8a0', text: '哈，看来我这小店，以后不愁没客人了。' },
];

/** 填满自然笔记后的收束对白（小梅点睛台词） */
export const XIAOMEI_OBSERVE_DONE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（你在自然笔记上写下了关于这只蝴蝶的三件事。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '青禾凤蝶……嗯，记好了。' },
  { speaker: '林澈', color: COLORS.linche, text: '原来每一只蝴蝶，都有自己喜欢待的地方。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '是呀。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '青禾镇的自然记录，这是第一条。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '原来它们一直都在。只是我们以前，没认真看过。' },
];

// ============ 第一章 v0.11 图鉴墙：柳叶蝶 / 夜光蛾观察（2026-08-14，制作人拍板） ============
// 复用 XIAOMEI_OBSERVE_CHOICES_DIALOGUE 的三个观察选项（翅膀/活动时间/环境），
// 各自拥有 intro / detail×3 / done 收束；收束计数 2/10、3/10（与青禾凤蝶 1/10 组成首版三虫图鉴）。
// 文本护栏：口语化、不演讲、留白，不重复青禾凤蝶已冻结收束台词「原来它们一直都在」。

/** 柳叶蝶观察：小梅没见过的虫（河边柳树下，翅膀像柳叶） */
export const XIAOMEI_OBSERVE_WILLOW_INTRO_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（小梅接过标本，歪着头看了好一会儿。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '咦，这只我没见过。翅膀绿绿的，像一片柳叶。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '来，用放大镜仔细看看，说不定能记下来。' },
];

/** 柳叶蝶观察细节（按下标对应：0翅膀 1活动时间 2环境） */
export const XIAOMEI_OBSERVE_WILLOW_DETAIL_DIALOGUE: DialogueLine[][] = [
  [
    { speaker: '林澈', color: COLORS.linche, text: '翅膀细长，绿得发亮，越靠近边儿颜色越淡。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '它贴柳枝上一动不动的时候，跟叶子混在一起，根本认不出来。' },
  ],
  [
    { speaker: '林澈', color: COLORS.linche, text: '它好像喜欢早上风小的时候出来，太阳一大就不见了。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '嗯，风一大它就躲进叶子背面去，等风停了再出来。' },
  ],
  [
    { speaker: '林澈', color: COLORS.linche, text: '它一直绕着河边那几棵柳树飞，不怎么往远处去。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '它把家安在河边了。柳树在，它就在。' },
  ],
];

/** 柳叶蝶观察收束（自然记录第二条） */
export const XIAOMEI_OBSERVE_WILLOW_DONE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（你在自然笔记上写下了关于这只蝴蝶的三件事。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '柳叶蝶……嗯，记好了。' },
  { speaker: '林澈', color: COLORS.linche, text: '原来它连颜色，都长成了柳树的样子。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '是呀。青禾镇的自然记录，这是第二条。' },
];

/** 夜光蛾观察：小梅夜里才见得到的虫（老树旁，翅膀泛淡光） */
export const XIAOMEI_OBSERVE_MOTH_INTRO_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（小梅接过标本，就着月光看了半天，抬头时眼睛亮亮的。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '夜光蛾呀。白天躲树影里，天一黑才出来，能碰到它不容易。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '来，仔细看看，记一笔。' },
];

/** 夜光蛾观察细节（按下标对应：0翅膀 1活动时间 2环境） */
export const XIAOMEI_OBSERVE_MOTH_DETAIL_DIALOGUE: DialogueLine[][] = [
  [
    { speaker: '林澈', color: COLORS.linche, text: '翅膀不是白的，有点发灰，暗处会泛一点点光。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '那是它身上带着的夜光，天越黑越看得清楚。' },
  ],
  [
    { speaker: '林澈', color: COLORS.linche, text: '白天看不到它，天一黑才出来。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '对，它白天就歇在老树底下那块阴凉里，晚上才起身。' },
  ],
  [
    { speaker: '林澈', color: COLORS.linche, text: '它总待在那棵老树旁边，飞得不高也不远。' },
    { speaker: '花匠小梅', color: COLORS.gardener, text: '老树年岁大了，树皮缝里藏着些小东西，它守着自己的那一口。' },
  ],
];

/** 夜光蛾观察收束（自然记录第三条） */
export const XIAOMEI_OBSERVE_MOTH_DONE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（你在自然笔记上写下了关于这只蛾子的三件事。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '夜光蛾……嗯，记好了。' },
  { speaker: '林澈', color: COLORS.linche, text: '白天它藏起来，晚上才出来，像是守着那棵树。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '老树在，它就在。青禾镇的自然记录，这是第三条。' },
];

// ============ T3 NPC 生活事件（制作人 2026-08-07 定稿微调） ============
// 三条：夏雅「整理旧照片」（过去有人生活过）/ 老张「矿灯」（曾经有人努力过）/ 小梅「小梅花」（未来还会继续生长）。
// 夏雅：老屋修复完成后，老屋门口互动 → 无实物交付 → 相簿新照片 + 记忆卡。
// 老张：矿洞独立点灯点，交付铜矿×2 → 点亮矿灯；无记忆卡（避免记忆卡变成任务奖励，制作人拍板）。
// 小梅：小镇花圃互动 → 种下梅花 → 花圃长出梅花（环境变化）；无实物交付。

/** T3 夏雅「整理旧照片」：老屋修复后，老屋门口入口对白 */
export const XIYA_PHOTO_ENTRY_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（老屋修好后，夏雅站在门口，怀里抱着一个落灰的木盒。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '这些照片，是爷爷以前留下的。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '我整理东西的时候才发现，已经落灰这么久了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '要是不嫌弃……陪我一起整理整理？' },
  { speaker: '林澈', color: COLORS.linche, text: '（点头）好。' },
];

/** T3 夏雅「整理旧照片」：整理完成对白（解锁相簿 + 记忆卡） */
export const XIYA_PHOTO_DONE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（两个人把照片一张张擦干净、摆开。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '你看这张，是你爷爷年轻的时候，站在这片田里。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '原来以前的青禾镇，是这个样子的啊……' },
  { speaker: '夏雅', color: COLORS.xiya, text: '感觉离我们好近。' },
  { speaker: '林澈', color: COLORS.linche, text: '（看了看手里的照片，没说话）' },
];

// ============ P1-3 夏雅《旧日留影》（第一章性格铺垫，剧情大纲 v0.3 §八） ============
// 触发：老屋整理完成后 house 翻柜子 → 翻出旧相框 → farm 老屋门口找夏雅 → 她擦干净
// 台词逐字取自剧情大纲 v0.3 §八（拍板基线）；目标：引出夏雅"保存小镇记忆"性格，不展开《春深有信》。
// 复用 trySideXiyaPhoto 范式：MapScene 实例字段 sideXiyaOldShadowAsked/Done + StoryDialogue + save。

/** P1-3 翻出旧物件：house 整理完成后，翻柜子入口对白 */
export const XIYA_OLD_SHADOW_ENTRY_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（整理好的屋子里，柜子最底下还压着一个旧物件。）' },
  { speaker: '', color: COLORS.system, text: '（一个褪了色的旧相框，边角磨得发亮。林澈把它拿出来，擦了擦灰。）' },
  { speaker: '林澈', color: COLORS.linche, text: '……这个，也许夏雅认识。' },
];

/** P1-3 交付旧物件：farm 老屋门口找夏雅，她接过擦干净（§八 台词） */
export const XIYA_OLD_SHADOW_DELIVER_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夏雅接过相框，看了好一会儿。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '这个啊……以前大家搬家的时候，都舍不得丢。' },
  { speaker: '', color: COLORS.system, text: '（她从口袋里拿出一块软布，小心地把相框擦干净。）' },
  { speaker: '林澈', color: COLORS.linche, text: '你为什么一直留着这些？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '因为我觉得，有一天它们可能会派上用场。' },
];

// ============ 夏雅《春深有信·一》Demo Cut（D-011，对话逐字取自设计文档第一章定稿） ============
// 4 段：开场（触发）→ 互动一（花苗）→ 互动二（旧花种记录）→ 收尾（春祭/烟花埋伏笔）

/** 段 A 开场：演出 + 对白（设计文档 L47-119） */
export const XIYA_LETTER_OPEN_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夕阳落在田埂上。）' },
  { speaker: '', color: COLORS.system, text: '（刚浇过水的土地泛着湿润的光泽。）' },
  { speaker: '', color: COLORS.system, text: '（远处的风车慢慢转动。）' },
  { speaker: '', color: COLORS.system, text: '（夏雅蹲在田边，整理一小片刚种下的花苗。）' },
  { speaker: '林澈', color: COLORS.linche, text: '你每天都会来这里看看？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '虽然现在还看不出来什么。' },
  { speaker: '林澈', color: COLORS.linche, text: '不是已经种下了吗？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '种下去和长出来，中间还差一点时间。' },
  { speaker: '林澈', color: COLORS.linche, text: '听起来像是在等一个很慢的结果。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '可能吧。' },
  { speaker: '林澈', color: COLORS.linche, text: '你以前也是这样种东西？' },
  { speaker: '', color: COLORS.system, text: '（夏雅停了一下。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '以前……' },
  { speaker: '夏雅', color: COLORS.xiya, text: '比现在更忙一点。' },
  { speaker: '林澈', color: COLORS.linche, text: '为什么？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '因为那时候，总觉得岛上什么都不会消失。' },
  { speaker: '', color: COLORS.system, text: '（她停了一会儿。）' },
  { speaker: '林澈', color: COLORS.linche, text: '后来呢？' },
  { speaker: '', color: COLORS.system, text: '（夏雅看向远处。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '后来才发现。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '有些东西，如果没人记得，它就真的没有了。' },
  { speaker: '', color: COLORS.system, text: '（沉默了一会儿。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不过现在，好像又开始不一样了。' },
  { speaker: '林澈', color: COLORS.linche, text: '因为我？' },
  { speaker: '', color: COLORS.system, text: '（夏雅笑了一下。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '因为大家。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '你只是刚好回来了。' },
];

/** 段 B 互动一：整理花苗（设计文档 L121-131） */
export const XIYA_LETTER_FLOWER_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（你走近那片花苗，蹲下看了看。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这些花什么时候会开？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '快的话，几天。' },
  { speaker: '林澈', color: COLORS.linche, text: '慢的话？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '可能要等一个季节。' },
  { speaker: '林澈', color: COLORS.linche, text: '这么久？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。但花又不知道我们觉得它慢。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '它只是按照自己的时间长出。' },
];

/** 段 C 互动二：旧花种记录（设计文档 L133-142；物品以记忆 moment 表现，制作人拍板） */
export const XIYA_LETTER_RECORD_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夏雅递来一本翻旧了的册子。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这是你的记录？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。' },
  { speaker: '林澈', color: COLORS.linche, text: '写了好多年。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '有些花没种出来。' },
  { speaker: '林澈', color: COLORS.linche, text: '为什么还留着？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '因为失败也算种过。' },
];

/** 段 D 收尾：对白续 + 演出 + 春祭/烟花埋伏笔（设计文档 L149-175） */
export const XIYA_LETTER_FINAL_DIALOGUE: DialogueLine[] = [
  { speaker: '林澈', color: COLORS.linche, text: '你一直都在做这些事情？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '差不多。' },
  { speaker: '林澈', color: COLORS.linche, text: '不觉得累吗？' },
  { speaker: '', color: COLORS.system, text: '（夏雅想了一下。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '会啊。' },
  { speaker: '林澈', color: COLORS.linche, text: '那为什么还继续？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '因为总要有人先开始。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '以前爷爷也是这么说的。' },
  { speaker: '', color: COLORS.system, text: '（风吹过田野。）' },
  { speaker: '', color: COLORS.system, text: '（远处村子的旧路灯亮起。）' },
  { speaker: '', color: COLORS.system, text: '（只是普通的晚上。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '对了。' },
  { speaker: '林澈', color: COLORS.linche, text: '什么？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '下周岛上有个小活动。' },
  { speaker: '林澈', color: COLORS.linche, text: '什么活动？' },
  { speaker: '', color: COLORS.system, text: '（夏雅笑了一下。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '到时候你就知道了。' },
];

// ============ 夏雅《春深有信·二 花期未至》（§二 冻结正文 + Scene Flow S1→S8 定稿；制作人 2026-08-08 结构审查通过）============
// 接入规则：
// - 前置：春深有信·一 完成 + 集市恢复（marketSquare）；CURRENT_TASK §衔接设计：·二 绑市场广场恢复。
// - 载体：town 旧广场独立剧情夏雅（不撞 NPC 日常）；8 段逐步推进（stage 驱动），与·一 一致。
// - 存档：新增 xiyaBloomAsked / xiyaBloomDone / xiyaBloomStage（均 optional，旧档兼容，不升 SAVE_VERSION）。
// - 禁词：那个约定 / 那个人 / 她一直等待——改用"以前的习惯 / 大家一起做的事 / 岛上的老传统"。

/** 【S1 承接开场】青禾镇旧广场公告栏边的邀约（衔接·一末尾"下周有个活动"＝秋日晒场，2026-08-29 口径） */
export const XIYA_BLOOM_S1_OPEN_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（青禾镇。午后阳光穿过树叶，斑驳落在旧广场。）' },
  { speaker: '', color: COLORS.system, text: '（夏雅从边角冒出来，手里抱着一卷布。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '喂——林澈！' },
  { speaker: '林澈', color: COLORS.linche, text: '嗯？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '还记得我上回说的那个"小活动"吗？' },
  { speaker: '林澈', color: COLORS.linche, text: '你说下周有个活动。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '对，就是下周的事了。收成下来了，要把一年的东西拿出来晒一晒。晒架还没支起来，得趁这几天把东西都腾出来。' },
  { speaker: '林澈', color: COLORS.linche, text: '……多大的活动？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不大。就是大家老时候会一起过的一个日子。你也来帮忙吧？' },
  { speaker: '林澈', color: COLORS.linche, text: '我？我不会这些。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不用会，人手够就行。多一个人搭手，事情就快一点。' },
  { speaker: '林澈', color: COLORS.linche, text: '（点了点头。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '别站着了，帮忙搬箱子！' },
];

/** 【S2 整理旧物】临时仓库里摊开的晒场旧物——旧晒架、竹匾、褪色灯笼穗 */
export const XIYA_BLOOM_S2_STORAGE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（临时仓库。阳光从窗缝漏进来，尘埃在光里浮着。）' },
  { speaker: '', color: COLORS.system, text: '（地上摊着一地旧东西：晒架、竹匾、一串褪了色的旧灯笼穗。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这些都是以前的？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。一年一年留下来的。有些还能用，扫扫灰就行。' },
  { speaker: '林澈', color: COLORS.linche, text: '这个晒架……这么旧了还留着？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '旧但不坏。补一补，还能再撑一个秋天。' },
  { speaker: '', color: COLORS.system, text: '（林澈弯腰拾起一条旧竹牌。上面写着一个个名字和年份。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这上面写了好多字。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '每年谁家晒了什么、谁收拾的，都记在上面。' },
  { speaker: '林澈', color: COLORS.linche, text: '记这些做什么？' },
  { speaker: '', color: COLORS.system, text: '（夏雅抬眼看了看窗外。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '以前大家一起做的时候，留着，是怕忘了。' },
  { speaker: '林澈', color: COLORS.linche, text: '没人整理的话，它们可能就找不到了吧？' },
  { speaker: '', color: COLORS.system, text: '（夏雅轻轻应了一声，像是说给自己听的。之后又自己笑了一下，低头继续理东西。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '……嗯。还在这里，真好。' },
];

/** 【S3 修补晒架】旧晒架重新立起来——玩家和夏雅一起修 */
export const XIYA_BLOOM_S3_FLOWERSTAND_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（白天。夏雅把旧晒架搬出来，架在树荫下。林澈帮忙打下手，递钉子。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这个晒架，每年这个时候都要这么弄一次？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '能弄就弄。不弄的话，它就那么坏着。' },
  { speaker: '林澈', color: COLORS.linche, text: '坏了换新的不就行？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '新的没有旧的这份……（想了想）这份用久了才有的顺手。你不是也修过老屋的门？' },
  { speaker: '林澈', color: COLORS.linche, text: '那倒是。' },
  { speaker: '', color: COLORS.system, text: '（两个人一起把晒架扶正。晒架缺的地方露着旧木纹，被新木片衬得新旧交错。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这样就能用了吗？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '能用一阵。' },
  { speaker: '林澈', color: COLORS.linche, text: '那你每年都守着这个老地方，累吗？' },
  { speaker: '', color: COLORS.system, text: '（夏雅没有立刻答。她关好工具箱，抬头看了看渐暗的天。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '累倒不怕。' },
  { speaker: '林澈', color: COLORS.linche, text: '为什么还做？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '有人记得，它就还是这个岛的东西。没人记得……它就只是一块木头了。' },
  { speaker: '', color: COLORS.system, text: '（天黑下来，旧广场亮起。远处村头的灯一户户亮起。只是普通的一个晚上。）' },
];

/** 【S4 误解形成】旧名单上出现爷爷的名字——林澈误以为"夏雅一直在等某个人" */
export const XIYA_BLOOM_S4_MISUNDERSTAND_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（临时仓库，灰尘里翻出几叠旧纸。夏雅蹲在箱边，一张张抚平卷边。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '这些都是往年晒场的单子，先放这边。' },
  { speaker: '林澈', color: COLORS.linche, text: '我来帮你搬。' },
  { speaker: '', color: COLORS.system, text: '（林澈随手翻页，忽然停住。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这些是晒场的名单？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。每年都会列一张，看谁负责什么。' },
  { speaker: '林澈', color: COLORS.linche, text: '「玉米」「鱼干」「场地」「灯笼」……原来灯笼以前也是要挂满的。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。很久以前。' },
  { speaker: '', color: COLORS.system, text: '（林澈翻到更早的几页，注意到其中一个名字。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这里也有爷爷的名字。' },
  { speaker: '', color: COLORS.system, text: '（夏雅动作停了一下。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '……嗯。' },
  { speaker: '林澈', color: COLORS.linche, text: '他以前也在晒场帮忙？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '岛上的很多事情，大家都会一起做。' },
  { speaker: '林澈', color: COLORS.linche, text: '那后来，是谁带头做这些？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '没有带头的人。' },
  { speaker: '林澈', color: COLORS.linche, text: '嗯？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '做的人不够的时候，就轮到剩下的几个人做。' },
  { speaker: '林澈', color: COLORS.linche, text: '（低声）你把这些留了好多年。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。' },
  { speaker: '林澈', color: COLORS.linche, text: '为什么？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '因为留着，才有人记得还有这回事。' },
];

/** 【S5 真相转换】村民陆续加入——林澈理解夏雅等的不是一个人 */
export const XIYA_BLOOM_S5_TURNING_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（晒场前一天，场外。王婶端着一篮点心过来。）' },
  { speaker: '王婶', color: COLORS.laojiang, text: '听说今年要弄晒场了？我给带了点南瓜饼，添个味。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '婶儿，您怎么来了？' },
  { speaker: '顾婶', color: COLORS.gardener, text: '从前每年的这个时候，我们也都会弄。今年听说你要弄，就说来帮把手。' },
  { speaker: '林澈', color: COLORS.linche, text: '原来……不是只有你一个人记得。' },
  { speaker: '', color: COLORS.system, text: '（夏雅没立刻答。她低头叠了会儿布，才开口。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '我只是觉得……如果今年也没人准备的话，明年，可能就真的没人记得了。' },
  { speaker: '林澈', color: COLORS.linche, text: '所以你就自己弄了这么多年？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '也不全是自己。隔一阵子，总有那么一两个人，还愿意一起弄。' },
  { speaker: '林澈', color: COLORS.linche, text: '所以你等的，不是一个人。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。我等的，是有人还愿意一起做这些事。' },
  { speaker: '林澈', color: COLORS.linche, text: '你不是想把以前变回来？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '以前回不来。只是……如果没有人接着做，它就一直留在"以前"了。' },
  { speaker: '', color: COLORS.system, text: '（镜头：晒架重新支起、竹席上铺满新收的玉米、跑过广场的孩子。）' },
];

/** 【S6 村民参与】晒场当日早晨：居民带着各自的旧习惯回来 */
export const XIYA_BLOOM_S6_VILLAGERS_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（晒场当天早晨，旧广场。前两天还空荡荡的地方，今天支起一排排晒架，竹席上摊着玉米和萝卜干，鱼干架边晾着几条咸鱼。）' },
  { speaker: '林澈', color: COLORS.linche, text: '来的人……比我想的多。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。陆陆续续都来了。' },
  { speaker: '老爷爷', color: COLORS.elder, text: '今年还有人记得这摊子呢？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '记得。您去年说腿脚不好，我还怕您不来。' },
  { speaker: '老爷爷', color: COLORS.elder, text: '腿是老了，可这天一年就一趟。不来，心里空。' },
  { speaker: '', color: COLORS.system, text: '（老晒架支起来了、旧竹席铺开了、孩子们在人群里钻来钻去。）' },
  { speaker: '林澈', color: COLORS.linche, text: '（小声）他们……是因为你才来的吗？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不是。他们本来就住在这里。只是有一阵子，大家都忘了还能这样。不是我拉他们回来，是日子把他们带回来了。' },
];

/** 【S7 晒场日】广场上的东西一眼看得出发旧——"不完美但聚起了人"的傍晚 */
export const XIYA_BLOOM_S7_FESTIVAL_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（午后。广场上很热闹，但东西一眼看得出发旧：竹席补过好几处、玉米串得不太齐、有几样没晒够。）' },
  { speaker: '林澈', color: COLORS.linche, text: '东西好像不太够？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯，是有点不够。往年那些做得好的，这几年没人做，都散在别处了。' },
  { speaker: '林澈', color: COLORS.linche, text: '那怎么办？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '怎么办？又不是非要跟以前一样齐整。（她递过一盏旧灯）有这个，够看着热闹就行。' },
  { speaker: '', color: COLORS.system, text: '（林澈接过灯，才发现灯罩上贴着一小块补丁，是旧布缝的。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这灯，也修过？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。灯罩那时候撕了，我拿旧布缝上的。' },
  { speaker: '林澈', color: COLORS.linche, text: '缝得还挺细。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '一个人没事做，习惯了手上有点活。' },
  { speaker: '', color: COLORS.system, text: '（天色渐晚，广场上的旧灯一盏盏亮起来。不是崭新的光，是旧灯透出的、暖黄的日常的光。）' },
];

/** 【S8 收束】不是烟花——人回来了＋远处灯塔亮一下；归星岛重新有了一天像以前一样的日子（2026-08-29 口径） */
export const XIYA_BLOOM_S8_FIREWORKS_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夜。晒场收尾，村民搬出条凳长桌，围坐在一起。海风从桌边过去，灯笼摇摇晃晃。）' },
  { speaker: '', color: COLORS.system, text: '（远处海面上，灯塔亮了一下。）' },
  { speaker: '林澈', color: COLORS.linche, text: '那是什么？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '……是灯塔。以前也这样，偶尔亮一下。' },
  { speaker: '林澈', color: COLORS.linche, text: '现在……也是吗？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '现在，你看，大家都在看。' },
  { speaker: '林澈', color: COLORS.linche, text: '辛苦了。这么多年。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '……谢谢你们愿意来。' },
  { speaker: '', color: COLORS.system, text: '（夜深下去。灯笼还亮着。夏雅没有一直看着远处——她时不时看向人群里跑着的孩子、聊着的老人。）' },
];

/** 【章末·尾声衔接】晒场散场，夏雅留下收拾——为第三章入口"她还需要继续守着吗？"留口
 *  （2026-08-29 拍板：纸花=花期未至人物记忆物保留；樱花=人物隐喻保留，不指代活动本体） */
export const XIYA_BLOOM_EPILOGUE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（人群散去，空下来的广场。风卷着几张飘落的纸花滚过脚边。）' },
  { speaker: '林澈', color: COLORS.linche, text: '我来帮你收。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '不用，你快回去歇着。' },
  { speaker: '林澈', color: COLORS.linche, text: '这么多年，你到底图什么？' },
  { speaker: '', color: COLORS.system, text: '（夏雅停了一下，回头看看空下来的广场，又看看远处那盏亮着的旧灯。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '（轻声）我只是，不想让它被我忘了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '要是哪天没人知道了，它就从"这是我们的地方"，慢慢只剩"曾经有个地方"。我过别人记着的日子，自己也想替这地方留一块。' },
  { speaker: '林澈', color: COLORS.linche, text: '那……你以后还留在这？' },
  { speaker: '', color: COLORS.system, text: '（夏雅提着那盏补过的旧灯，往家方向走了两步，才回头。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '樱花落地还会再开。地方也一样。肯等它的人多了，它就又会长出来。' },
  { speaker: '', color: COLORS.system, text: '（她提着的那盏旧灯，背影。镜头缓缓收成一点光。）' },
];

/** T3 老张「矿灯」：矿洞入口对白（交付铜矿×2） */
export const MINER_LAMP_ENTRY_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（矿洞深处的墙上，挂着一盏锈迹斑斑的旧矿灯。）' },
  { speaker: '矿工老张', color: COLORS.miner, text: '这盏灯，我年轻时点过。' },
  { speaker: '矿工老张', color: COLORS.miner, text: '灯芯还能用，就差两块铜矿修一修灯座。' },
];

/** T3 老张「矿灯」：铜矿不足提示（可重复触发） */
export const MINER_LAMP_NEED_DIALOGUE: DialogueLine[] = [
  { speaker: '矿工老张', color: COLORS.miner, text: '灯座还缺两块铜矿。你挖矿的时候帮我留意着点。' },
];

/** T3 老张「矿灯」：铜矿×2 交付，点亮矿灯 */
export const MINER_LAMP_DONE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（你递过铜矿。老张拾掇一阵，"啪"的一声，灯亮了起来。）' },
  { speaker: '矿工老张', color: COLORS.miner, text: '这灯还能亮，就说明这地方还没废。' },
  { speaker: '矿工老张', color: COLORS.miner, text: '以前我们就是靠它干活的。' },
  { speaker: '矿工老张', color: COLORS.miner, text: '（拍拍你的肩）谢了，小子。' },
];

/** T3 小梅「小梅花」：小镇花圃入口对白 */
export const GARDENER_PLUM_ENTRY_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（小镇花圃边，小梅正对着一小块空地发愁。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '花圃东边那块地，我留了好久。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '一直没想好种什么……你能帮我种一株梅花吗？' },
  { speaker: '林澈', color: COLORS.linche, text: '种梅花？' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '嗯。等它开花的时候，冬天也不会那么冷清了。' },
];

/** T3 小梅「小梅花」：种下完成对白（花圃长出梅花，环境变化） */
export const GARDENER_PLUM_DONE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（花种入土。小梅小心地覆上土，又浇了一点水。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '你看，埋下去的时候才这么点土。它会开花的，梅花耐冷。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '到时候你来看，它会长得很好的。' },
];

/** 花田支线：帮小梅开垦花田入口对白（farm 左上角花田，2026-08-11 制作人拍板） */
export const GARDENER_FIELD_ENTRY_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（农场角落的花田荒了挺久，小梅正蹲在旁边翻土。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '这片地空着怪可惜的……我想把它收拾出来，种上花。' },
  { speaker: '林澈', color: COLORS.linche, text: '要我帮忙吗？' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '嗯！先得立一圈篱笆，把地圈起来。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '你要是能弄来几根木材，这块花田就能开工了。' },
];

/** 花田支线：交付完成对白（花田盛开，环境变化） */
export const GARDENER_FIELD_DONE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（篱笆立好，小梅把翻松的土拢成一畦一畦，撒下花种。）' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '你看，一畦向阳，一畦靠树。过些日子，这里会开出一小片花。' },
  { speaker: '花匠小梅', color: COLORS.gardener, text: '爷爷以前说过，土地荒了，只要还有人愿意种，它就还有得盼。' },
  { speaker: '林澈', color: COLORS.linche, text: '……嗯。' },
];

// ============ 支线试点（2026-08-06 制作人拍板方案 A） ============
// 夏雅「院子有人照顾」：花园恢复后，旧藤架修复事件（交付木材×3 → 记忆卡收尾）
/** 支线入口：夏雅请林澈一起修旧藤架 */
export const XIYA_GARDEN_TRELLIS_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（花田边的旧藤架，风一吹就吱呀作响。夏雅正蹲在一旁看着。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '你来得正好。这架藤蔓，爷爷走后就没人管了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '要是能修一修，明年花开的时候，还能靠着它看一会儿。' },
  { speaker: '林澈', color: COLORS.linche, text: '（检查了一下）需要几根木材。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '我去找工具。……等你凑齐了木材，我们再一起把它立起来。' },
];

/** 支线交付：木材不足提示（可重复触发） */
export const XIYA_GARDEN_TRELLIS_NEED_DIALOGUE: DialogueLine[] = [
  { speaker: '夏雅', color: COLORS.xiya, text: '藤架还差几根木材。你要是有空，从庄园里砍几根来？' },
];

/** 支线交付：木材×3 交付完成 */
export const XIYA_GARDEN_TRELLIS_DONE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（你递过木材。两个人一起把旧藤架重新立了起来。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '好了……以后每年花开，都有地方靠了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '他说，院子有人照顾，就不会冷清。' },
];

// 镇长「看星星的地方」：观星夜完成后，镇长委托 → 夜晚去农田边空地 → 记忆卡收尾
/** 支线入口：镇长委托（挂在观星夜完成后的镇长后续对话） */
export const ELDER_TEA_QUEST_DIALOGUE: DialogueLine[] = [
  { speaker: '镇长', color: COLORS.elder, text: '对了——你爷爷以前啊，忙完一天的活，总喜欢去农田边坐一会儿。' },
  { speaker: '镇长', color: COLORS.elder, text: '他说，那里安静，能看见很远的星星。' },
  { speaker: '镇长', color: COLORS.elder, text: '你要是晚上有空，带壶茶去那儿坐坐，就当替他看看。' },
  { speaker: '林澈', color: COLORS.linche, text: '……好。' },
];

/** 支线触发：夜晚在农田边空地 */
export const ELDER_STAR_SITE_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夜晚。农田边的空地安静极了，远处传来虫鸣。）' },
  { speaker: '', color: COLORS.system, text: '（你坐下，把茶壶放在脚边，抬头看向星星。）' },
  { speaker: '林澈', color: COLORS.linche, text: '……爷爷以前，就坐在这里吗？' },
  { speaker: '', color: COLORS.system, text: '（风穿过田野。星光落在空地上。）' },
];

/** FEATURE-036 旧农业机器人修复对白（花园恢复后，花园旁发现旧设备 → 修复）
 *  制作人方向（2026-08-03）：路线 A「爷爷留下的旧农业机器人 + 修复」。
 *  范围限定：A/B 类生活事件，不扩世界观真相、不主动提及爷爷具体回忆（任务卡红线），
 *  无新剧情节点/任务/StoryStep/存档字段。 */
export const OLD_ROBOT_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（花园旁的土里，半埋着一台旧机器。外壳锈迹斑斑，结构却还算完整。）' },
  { speaker: '林澈', color: COLORS.linche, text: '这是……农业机器人？很旧的样子。' },
  { speaker: '林澈', color: COLORS.linche, text: '修一修，说不定还能用。' },
  { speaker: '', color: COLORS.system, text: '（你清理了锈蚀和灰尘，重新接上电源。）' },
  { speaker: '', color: COLORS.system, text: '（指示灯亮了起来。老机器轻轻嗡鸣，重新运转。）' },
  { speaker: '林澈', color: COLORS.linche, text: '……它能帮我看顾农田。' },
];

// ============ Demo 结尾：观星夜（定稿版 v0.3） ============

/** 观星夜收尾（第一章完成 + 夜晚，靠近观星点触发；含静默镜头与选项） */
export const DEMO_ENDING_DIALOGUE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（夜幕降临。庄园外，今天的星空格外明亮。）' },
  { speaker: '夏雅', color: COLORS.xiya, text: '你爷爷以前每天都会坐在这里。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '他走以后，岛上的人还是会偶尔来看这里。' },
  { speaker: '林澈', color: COLORS.linche, text: '他也喜欢看星星？' },
  { speaker: '夏雅', color: COLORS.xiya, text: '嗯。他说，总有一天，会有人回来继续看。' },
  { speaker: '', color: COLORS.system, text: '（夏雅看了看林澈，没有继续说下去。）' },
  { speaker: '', color: COLORS.system, text: '（夏雅看向石头边。那里压着一封信，被月光晒得发白。）' },
  { speaker: '信', color: COLORS.letter, text: '如果看到这封信，说明你终于回来了。' },
  { speaker: '信', color: COLORS.letter, text: '小澈，你小时候总问我，为什么每天都要给花浇水。' },
  { speaker: '信', color: COLORS.letter, text: '爷爷想了很久。后来发现，人做很多事情，不一定都是为了结果。' },
  { speaker: '信', color: COLORS.letter, text: '如果有一天机器比我们更聪明，你觉得人还需要留下些什么？' },
  { speaker: '', color: COLORS.system, text: '（林澈握着信，抬头看向星空。）' },
  { speaker: '林澈', color: COLORS.linche, text: '城市里，很久没见过这样的星星了。' },
  { speaker: '', color: COLORS.system, text: '（他没有说话。）' },
  { speaker: '', color: COLORS.system, text: '（远处传来虫鸣。星光落在庄园旧墙上。）' },
  { speaker: '', color: COLORS.system, text: '', options: ['至少现在，我想留下来看看。', '我想先弄清楚爷爷到底在这里经历了什么。', '我只是……还没想好怎么回那个城市。'] },
];

/** 观星夜三选项分支独白（选择后播放，随后汇聚到结局） */
export const DEMO_ENDING_BRANCHES: Record<'try_stay' | 'unknown' | 'tonight', DialogueLine[]> = {
  try_stay: [
    { speaker: '', color: COLORS.system, text: '（林澈把信收好。这一次，他不想再走了。）' },
    { speaker: '林澈', color: COLORS.linche, text: '这些年换了几个城市，没有哪个地方让我觉得……是应该留下的。' },
    { speaker: '夏雅', color: COLORS.xiya, text: '（轻轻笑了笑）那就别走了。' },
    { speaker: '', color: COLORS.system, text: '（她说话的语气，就像在说"今天天气不错"一样自然。）' },
  ],
  unknown: [
    { speaker: '', color: COLORS.system, text: '（林澈把信收好。爷爷在这里留下的东西，比一封信更多。）' },
    { speaker: '林澈', color: COLORS.linche, text: '他为什么来这里？他一个人在这里住了多久？' },
    { speaker: '林澈', color: COLORS.linche, text: '……我好像从来没问过他这些。' },
    { speaker: '', color: COLORS.system, text: '（夏雅没有说话，只是安静地站在一旁。）' },
  ],
  tonight: [
    { speaker: '', color: COLORS.system, text: '（林澈把信收好。城市还在那里，但今晚，他属于这里。）' },
    { speaker: '林澈', color: COLORS.linche, text: '……说实话，我连明天会怎样都不知道。' },
    { speaker: '夏雅', color: COLORS.xiya, text: '不需要知道。' },
    { speaker: '', color: COLORS.system, text: '（她往他那边挪了挪，风把她的头发吹起来一点。）' },
    { speaker: '夏雅', color: COLORS.xiya, text: '……就是晚上风有点大。' },
    { speaker: '林澈', color: COLORS.linche, text: '你冷？' },
    { speaker: '夏雅', color: COLORS.xiya, text: '有一点。' },
    { speaker: '夏雅', color: COLORS.xiya, text: '你在这里，就足够了。' },
  ],
};

/** 观星夜收尾：选择后的汇聚结尾（次日清晨，自由模式） */
export const DEMO_ENDING_FINALE: DialogueLine[] = [
  { speaker: '', color: COLORS.system, text: '（那一夜，他没有再说话。只有风穿过田野。）' },
  { speaker: '', color: COLORS.system, text: '第二天清晨，新的早晨开始了。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '已经很久了，这片地没有这么热闹过。' },
  { speaker: '夏雅', color: COLORS.xiya, text: '青禾镇，欢迎你。' },
  { speaker: '', color: COLORS.system, text: '已存档。现在开始，这座岛都是你的了。' },
];

// ============ 状态管理 ============

let currentStep: StoryStep = 'station_intro';

/** 第一章：是否已触发过「首次进入小镇」剧情 */
let ch1TownIntroDone = false;

/** 第一章：是否已触发过小镇剧情 */
export function isCh1TownIntroDone(): boolean {
  return ch1TownIntroDone;
}

/** 标记小镇剧情已触发 */
export function markCh1TownIntroDone(): void {
  ch1TownIntroDone = true;
}

/** Demo 结尾：观星夜是否已完成（复用 storyStep，不新增存档字段） */
export function isObservatoryComplete(): boolean {
  return currentStep === 'observatory_complete';
}

/** 标记观星夜收尾完成（进入终态；isTutorialDone 兼容此终态） */
export function markObservatoryComplete(): void {
  currentStep = 'observatory_complete';
}

/** v0.5.3 剧情密度 E5：按天取爷爷笔记一条（seed = day，无状态轮换） */
export function getGrandpaNote(day: number): DialogueLine {
  return GRANDPA_NOTES[day % GRANDPA_NOTES.length];
}

/** 观星夜选择类型（第三章多结局预留，仅内存暂存） */
export type EndingChoice = 'try_stay' | 'unknown' | 'tonight';
let endingChoice: EndingChoice | null = null;

/** 读取观星夜选择 */
export function getEndingChoice(): EndingChoice | null {
  return endingChoice;
}

/** 记录观星夜选择（暂不入档，第三章再定） */
export function setEndingChoice(choice: EndingChoice | null): void {
  endingChoice = choice;
}

export function getStoryStep(): StoryStep {
  return currentStep;
}

export function setStoryStep(step: StoryStep): void {
  currentStep = step;
}

export function isTutorialDone(): boolean {
  return currentStep === 'done' || currentStep === 'observatory_complete';
}

export function advanceStory(): void {
  const order: StoryStep[] = [
    'station_intro', 'station_move', 'arrive_manor', 'xiya_talk',
    'get_key', 'gate_opened', 'clear_land', 'sow_seeds',
    'water_crops', 'evening_talk', 'done',
  ];
  const idx = order.indexOf(currentStep);
  if (idx >= 0 && idx < order.length - 1) {
    currentStep = order[idx + 1];
  }
}
