/**
 * InteractionRouter — P7a 交互门控 + P7b 目标解析路由器
 *
 * 职责：
 *   P7a: 判断当前是否允许玩家交互（checkGate）
 *   P7b: 从候选列表中解析出优先级最高的交互目标（resolveTarget）
 * 
 * 设计原则：
 *   - 纯决策层：返回 GateResult / ResolvedTarget，不直接操作玩家/面板/对话
 *   - 优先级显式化：门控/目标顺序由代码位置决定，与原逻辑一致
 *   - 可测试：Snapshot/Candidate 是纯数据/纯函数，可离线验证
 * 
 * P7b 目标解析优先级（与 tryInteract 原 if-return 顺序完全一致）：
 *   1. house_tidy            老屋整理（house 场景）
 *   2. house_old_shadow      旧日留影相框（house 场景）
 *   3. bed                   睡觉（house/farm 床铺）
 *   4. music_box             音乐盒（house 场景）
 *   5. grandpa_gift          归星包裹（house 场景）
 *   6. stargaze              观星点
 *   7. butterfly             捕虫（farm/town）
 *   8-11. art_show_*         星光艺术展系列
 *   12-14. dryyard_*         秋日晒场系列
 *   15. laojiang             钓鱼老人
 *   16-20. qinghe_*          青禾河畔系列
 *   21. fishing              钓鱼
 *   22. gather               采集
 *   23. lighthouse           灯塔探索
 *   24. elder_star           镇长委托
 *   25. xiya_gate            大门夏雅
 *   26. gate_wall            大门锁
 *   27. dawn_xiya            清晨夏雅
 *   28. elder_hint           镇长家提示
 *   29. gardener_plum        小梅种花
 *   30. market_square        集市广场
 *   31. shop_machine         自动售货机
 *   32. resident_board       居民需求板
 *   33. evening_xiya         傍晚夏雅
 *   34. grandpa_note         爷爷笔记
 *   35. garden_restore       花园恢复
 *   36. xiya_garden          院子照顾
 *   37. old_house_restore    老屋修复
 *   38. mailbox              邮箱
 *   39. xiya_old_shadow_deliver 旧照片交付
 *   40. xiya_photo           整理旧照片
 *   41. xiya_letter          春深有信
 *   42. bloom_xiya           花期未至
 *   43. gardener_field       花田开垦
 *   44. forest_road          山路修复
 *   45. garden_xiya          花园夏雅
 *   46. old_robot            旧农业机器人
 *   47. stall_keeper         集市摊主
 *   48. npc                  最近 NPC
 *   49. town_shop            镇商店
 *   50. old_tree            后山老树
 *   51. forest_shard         森林星之碎片
 *   52. mine_lamp            矿灯
 *   53. mine_ore             挖矿
 *   54. chop_tree            砍树
 *   55. farm_tile            农田交互
 *
 * P7b 红线：
 *   - 目标优先级必须与 tryInteract 原 if-return 顺序完全一致
 *   - resolve 函数必须纯（无副作用）
 *   - 执行逻辑（副作用）保留在 MapScene
 */

/**
 * 交互目标候选项（P7b）
 * 
 * 每个候选项代表一种可能的交互目标。
 * check() 为纯函数（无副作用），返回是否命中该目标。
 * 候选数组顺序 = 优先级顺序（先到先得）。
 * 
 * 使用：
 *   const candidates = this.buildInteractionCandidates();  // MapScene 构建
 *   const target = router.resolveTarget(candidates);
 *   if (target) {
 *     this.executeInteraction(target.id, target.data);  // MapScene 执行副作用
 *   }
 */
export interface InteractionCandidate {
  /** 目标唯一标识（与 tryInteract 原 try* 方法对应） */
  id: string;
  /** 纯函数：无副作用，返回是否命中该目标 */
  check: () => boolean;
  /** 可选：check 命中时返回的附加数据（如 NPC 引用、目标坐标等） */
  data?: () => unknown;
}

export interface ResolvedTarget {
  id: string;
  data?: unknown;
}

export interface GateSnapshot {
  createFailed: boolean;
  endingPanelOpen: boolean;
  inStargazeCutscene: boolean;
  inArtShowCutscene: boolean;
  photoAlbumOpen: boolean;
  discoveryOpen: boolean;
  hudMenuOpen: boolean;
  residentBoardOpen: boolean;
  shopOpen: boolean;
  backpackOpen: boolean;
  questOpen: boolean;
  waitPanelOpen: boolean;
}

export type GateResult =
  // 完全阻断：不允许任何输入处理
  | { type: 'block'; reason: string }
  // 冻结所有：玩家冻结 + 输入清空（无相交流程）
  | { type: 'freeze_all'; reason: string }
  // 只允许对话推进：观星夜/艺术展演出期间
  | { type: 'dialogue_only'; scene: 'stargaze' | 'art_show' }
  // 面板打开：冻结 + 可通过对应键关闭
  | { type: 'panel_open'; panel: 'resident' | 'shop' | 'backpack' | 'quest' | 'wait' }
  // 无门控：正常进入交互流程
  | { type: 'none' };

/**
 * 交互门控路由器
 * 
 * 使用：
 *   const router = new InteractionRouter();
 *   const snapshot = this.buildGateSnapshot();  // MapScene 提供
 *   const result = router.checkGate(snapshot);
 *   // MapScene 根据 result 类型执行对应副作用
 */
export class InteractionRouter {
  /**
   * 检查当前交互门控状态
   * 按优先级返回第一个激活的门控
   */
  public checkGate(snapshot: GateSnapshot): GateResult {
    // 1. 创建失败：完全阻断
    if (snapshot.createFailed) {
      return { type: 'block', reason: 'create_failed' };
    }

    // 2. Demo 结算界面：冻结+清空
    if (snapshot.endingPanelOpen) {
      return { type: 'freeze_all', reason: 'ending_panel' };
    }

    // 3. 观星夜演出：冻结+对话推进
    if (snapshot.inStargazeCutscene) {
      return { type: 'dialogue_only', scene: 'stargaze' };
    }

    // 4. 星光艺术展演出：冻结+对话推进
    if (snapshot.inArtShowCutscene) {
      return { type: 'dialogue_only', scene: 'art_show' };
    }

    // 5. 归星录·相簿：冻结+清空
    if (snapshot.photoAlbumOpen) {
      return { type: 'freeze_all', reason: 'photo_album' };
    }

    // 6. 自然记录图鉴：冻结+清空
    if (snapshot.discoveryOpen) {
      return { type: 'freeze_all', reason: 'discovery' };
    }

    // 7. HUD 功能菜单：冻结+清空
    if (snapshot.hudMenuOpen) {
      return { type: 'freeze_all', reason: 'hud_menu' };
    }

    // 8. 居民需求板：冻结+可关闭（E 键）
    if (snapshot.residentBoardOpen) {
      return { type: 'panel_open', panel: 'resident' };
    }

    // 9. 商店：冻结+可关闭（E 键）
    if (snapshot.shopOpen) {
      return { type: 'panel_open', panel: 'shop' };
    }

    // 10. 背包：冻结+可关闭（B 键）
    if (snapshot.backpackOpen) {
      return { type: 'panel_open', panel: 'backpack' };
    }

    // 11. 任务面板：冻结+可关闭（J 键）
    if (snapshot.questOpen) {
      return { type: 'panel_open', panel: 'quest' };
    }

    // 12. 等待面板：冻结+可关闭（T 键）
    if (snapshot.waitPanelOpen) {
      return { type: 'panel_open', panel: 'wait' };
    }

    // 13. 无门控
    return { type: 'none' };
  }

  /**
   * 门控调试信息：返回当前激活的门控描述
   * 供日志和探针使用
   */
  public describeGate(result: GateResult): string {
    switch (result.type) {
      case 'block':
        return `[Gate] BLOCKED: ${result.reason}`;
      case 'freeze_all':
        return `[Gate] FREEZE: ${result.reason}`;
      case 'dialogue_only':
        return `[Gate] DIALOGUE_ONLY: ${result.scene}`;
      case 'panel_open':
        return `[Gate] PANEL_OPEN: ${result.panel}`;
      case 'none':
        return '[Gate] NONE: interaction allowed';
    }
  }

  /**
   * P7b: 按优先级顺序从候选列表中解析出第一个命中的交互目标。
   * 
   * 候选数组的顺序 = 优先级顺序（先检查的先命中）。
   * 第一个 check() 返回 true 的候选被选中。
   * 
   * @param candidates 按优先级排序的候选项列表
   * @returns 命中的目标；若无命中返回 null
   */
  public resolveTarget(candidates: InteractionCandidate[]): ResolvedTarget | null {
    for (const candidate of candidates) {
      if (candidate.check()) {
        const data = candidate.data ? candidate.data() : undefined;
        return { id: candidate.id, data };
      }
    }
    return null;
  }

  /**
   * P7b: 目标解析调试信息
   */
  public describeTarget(target: ResolvedTarget | null): string {
    if (!target) return '[Target] NONE: no candidate matched';
    return `[Target] MATCHED: ${target.id}${target.data !== undefined ? ` data=${JSON.stringify(target.data)}` : ''}`;
  }
}