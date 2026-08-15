/**
 * 邮箱信件数据（2026-08-15 制作人逐封定稿，见 docs/design/邮箱系统-信件文字定稿-v0.1.md）
 *
 * 定位：邮箱不是消息中心——信是"玩家做完事以后，NPC 告诉他'我看见了'"，不是任务/奖励。
 * 三类：
 *   first  首封（爷爷，必达）
 *   world  世界状态信（事件后插队，各 1 封）
 *   life   生活信（普通轮换，每人 2 封）
 */

export interface MailLetter {
  id: string;
  sender: string;
  color: string;
  title: string;
  text: string;
  type: 'first' | 'world' | 'life';
}

/** 世界状态信条件表（MapScene 用；条件满足且未读未排 → 插队） */
export interface WorldMailRule {
  letterId: string;
  /** 返回该世界信是否可发（玩家做过对应的事） */
  ready: () => boolean;
}

export const MAIL_LETTERS: MailLetter[] = [
  // ── 首封：爷爷（必达） ──
  {
    id: 'grandpa_first', sender: '爷爷', color: '#e8d8a8', title: '归乡', type: 'first',
    text: `小澈：\n你终于回来了。\n门口那个信箱，是爷爷年轻时候钉的。\n木头旧了，可它一直在这儿。\n爷爷想着，总有一天会有人打开它。\n——爷爷`,
  },
  // ── 世界状态信（各 1 封） ──
  {
    id: 'laozhou_oldhouse', sender: '木匠老周', color: '#c89860', title: '老屋', type: 'world',
    text: `林澈：\n窗框修好了。\n风不会再从那里进来了。\n这屋子的木头是好木头，空了这么多年，还是有用。\n老房子啊，就怕没人管。有人住，它才像个家。\n——老周`,
  },
  {
    id: 'elder_market', sender: '镇长', color: '#d9c8a0', title: '集市', type: 'world',
    text: `林澈：\n集市又开起来了。\n头几天我站在摊子边，光听人说话，心里就踏实。\n镇上走路的人多了，连风都像热闹了一点。\n有空回来看看。\n——镇长`,
  },
  {
    id: 'laojiang_release', sender: '老姜', color: '#c8b898', title: '河', type: 'world',
    text: `林澈：\n河里的小家伙，最近多起来了。\n我寻思，是有人把它们放了回去。\n河这东西，你对它好，它记得。\n——老姜`,
  },
  {
    id: 'xiya_tomato', sender: '夏雅', color: '#f0a050', title: '番茄架', type: 'world',
    text: `林澈：\n今天经过农场，看见那排番茄架。\n忽然想起，小时候爷爷也种过。\n那时候觉得，每年都会有。\n后来才发现，有些东西消失以后，就很难再回来。\n谢谢你。\n——夏雅`,
  },
  {
    id: 'traveler_artshow', sender: '旅人', color: '#88b8e8', title: '那天的展', type: 'world',
    text: `林澈：\n那天的展，我一直记得。\n夜里河边的灯，还有大家坐在一起聊天的样子。\n我留下的那幅画，就挂在广场东边。\n不用替我介绍名字。\n以后有人看到它，知道这里曾经有过这样的夜晚，就够了。\n——旅人`,
  },
  // ── 生活信（普通轮换，每人 2 封） ──
  {
    id: 'xiya_life_1', sender: '夏雅', color: '#f0a050', title: '花', type: 'life',
    text: `林澈：\n花田今天开了几朵新花。你忙的话不用来，花开着就是让人看的。\n——夏雅`,
  },
  {
    id: 'xiya_life_2', sender: '夏雅', color: '#f0a050', title: '傍晚', type: 'life',
    text: `林澈：\n傍晚的风变凉了。你从田里回来，记得加件衣服。\n——夏雅`,
  },
  {
    id: 'laojiang_life_1', sender: '老姜', color: '#c8b898', title: '河边', type: 'life',
    text: `林澈：\n河边傍晚的风凉了。你要来，记得带件外套。\n——老姜`,
  },
  {
    id: 'laojiang_life_2', sender: '老姜', color: '#c8b898', title: '桥底下', type: 'life',
    text: `林澈：\n昨天看见一条大的，从桥底下游过去了。我没动，就看着。\n——老姜`,
  },
  {
    id: 'xiaomei_life_1', sender: '花匠小梅', color: '#a0d888', title: '菜园', type: 'life',
    text: `林澈：\n菜园边上那棵草，我帮你拔了。不客气。\n——小梅`,
  },
  {
    id: 'xiaomei_life_2', sender: '花匠小梅', color: '#a0d888', title: '花田', type: 'life',
    text: `林澈：\n花田的土，这两天松得正好。你要种什么，跟我说一声。\n——小梅`,
  },
  {
    id: 'laozhang_life_1', sender: '矿工老张', color: '#d8a050', title: '矿洞', type: 'life',
    text: `林澈：\n矿洞里的水声，跟以前一样。我收工早，路过镇上坐了一会儿。\n——老张`,
  },
  {
    id: 'laozhang_life_2', sender: '矿工老张', color: '#d8a050', title: '干粮', type: 'life',
    text: `林澈：\n下回带点干粮来。矿洞那边，中午没地方吃饭。\n——老张`,
  },
];

/** 按 id 查信 */
export function getMailLetter(id: string): MailLetter | undefined {
  return MAIL_LETTERS.find((l) => l.id === id);
}
