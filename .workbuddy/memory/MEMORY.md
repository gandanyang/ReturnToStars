# 《归星物语》项目长期记忆

> 跨会话约定与"轮子清单"。开工先读：`docs/AI开发前必读.md` + `docs/开发约束与架构入口.md` + 任务卡。

## 核心规范（避免反复造轮子）
- **新需求动手前先做"已有系统检查"**（复用方案/新增文件/修改文件），确认后再编码。
- **红线**：禁第二个 SaveManager/EventManager/QuestTrigger；禁 Scene 直存 localStorage/global（收口 SaveSystem）；禁单 NPC 独立管理器；禁无任务要求的行为不变重构；一次性触发必须 `EventManager.triggerOnce(id, fn)`。

## 轮子清单（直接复用）
- 存档 `SaveSystem.ts`｜一次性事件 `EventManager.ts`｜剧情 `StorySystem.ts`（冻结区单写者制）｜任务 `QuestSystem.ts`+`DailyQuestSystem.ts`｜相簿 `data/PhotoAlbum.ts`｜恢复 `data/FarmRestore.ts`｜NPC `NPCSystem.ts`｜环境音 `AmbienceSystem.ts`｜音乐 `audio/MusicSystem.ts`｜语音 `audio/VoiceBank.ts`（`镇长→村长` key 桥接）｜Debug `main.ts` window.debug（绕过 Vite dev 双模块）
- UI：模块级单例+panelFadeIn/Out 统一面板；`StoryDialogue.ts` 打字机；`MemoryFlashback.ts` 闪回；`MemoryMoment.ts` 飘字
- tools/（50+ 先查再写）：语音 gen_voice/gen_mainline_voice/gen_xiya_minimax.py+minimax_tts/fish_tts.ts；出图 gen_portrait_comfy.py/gpt_image_gen.mjs；GPT tileset 管线 gpt_tileset_normalizer.py（切块→量化→调色板映射→无缝→16px）+prompts/*.txt，锚点 `tools/star_island_palette.json`；打包 build_apk/install_apk.py；gpt-bridge.mjs 请示桥
- 探针 tests/probes/：ch1-walkthrough/stargaze/photo-album/dialogue-history/voice/npc-*/lighthouse/west-coast-visual 等

## 协作约定
- 多 AI 并发（WorkBuddy/TRAE/Codex）：git 写操作协调；git 写统一交 opencode/制作人（AGENTS.md 红线）；对象损坏停手报告不自行 gc
- 截图归档进程活跃（08-10 起）：test-screenshots/ 与 tmp/ 大 png 会被并行会话移入 `archive/screenshots/`——消失≠清理，重跑探针重建即可
- 宣发图 `public/assets/images/promo/`；相簿图 `public/assets/photos/album/`（webp ≤1280）
- 试玩 `tmp/_player-run.mjs`：瞬时按键须 HOLD；click 弹窗须 mouse.click；坐标闭环走位；玩家被出口"吸走"时 player 可能 null（容忍）

## 制作人拍板（要点）
- **配音（最高优先级）**：一律优先 MiniMax（T2A v2），VoxCPM 仅离线备选；夏雅=female-shaonv-jingpin 定案，其他角色先定音色
- **T2 红线**：只做 Day1 引导链+关键对白+出售反馈世界化；禁新货币/建筑/任务链/UI/经济公式；冻结：好感、新地图、战斗、大型农业扩展；EventManager 不再扩接口
- **美术（08-07）**：GPT tileset A 工具做扎实→farm 达标复制管线；调色板映射锁定；重出图绝不覆盖历史素材
- **术语（08-09）**：「心语任务」=角色剧情统一命名；「村长」→「镇长」全仓收敛
- **BUG-071 关闭（08-09）**：双夏雅三层根因修复；P2 候补 XiyaStateManager（禁手工互斥列表，稳定期不重构）
- **阶段（08-09）**：Alpha→可展示版；P0=收口→回归→TapTap→实机 PV；收口完成 `6aca71d`；下一批=「3 分钟体验测量版」

## 平台事实
- **横屏优先**：🔴 探针视口红线（制作人点名）：禁止竖屏视口（375×812）——触发 #rotate-hint + isMobileLayout 竖屏分支拦截交互；必须横屏（1024×768 或移动端 844×390+hasTouch）
- 标题有"请旋转设备横屏游玩"提示；iOS 横屏 Home Indicator 安全区已适配

## 声音补全 v1.0（08-09 收口 ✅）
6 首 BGM + SFX 程序合成包（quest/repair/shard/种田四件套/ui_confirm/door）+ 环境音（waves/birds/犬吠猫叫）全部接线；door_close 无调用点（P2）

## 音乐盒扩容 v1.1（08-10 ✅，功能待分）
- MUSIC_CATALOG 7→12：补 linche_theme2（老屋 BGM 漏收录）+ 4 新曲（island_wakes=主题曲候选；follow_wind/roads_wind/chasing_wind=风三首候选，desc 标"候选"）；title 条目 en 修正为 Stars Gather（曾误标 When The Island Wakes）
- mp3 源归档 `art_source/audio/music_mp3/`（7 个 no-watermark，带 (1) 的 v2 版本仅归档不进音乐盒）；ogg 转码 128kbps（follow_wind 96k）全部 ≤3.5MB
- 老屋默认 BGM = linche_theme2（probe T7/T9 曾断言 farm_day 为过期期望，已修）
- 探针 probe-music-box 16/16；功能分配待制作人拍板

## 灯塔 = 未来内容预埋（08-10 制作人定调 ✅ 已落地，西侧海湾版）
- **三层**：①现在=农场西侧海湾可见灯塔岛但去不了（黑灯/无执灯人/无任务/无交互）②城市复兴后=灯塔自动亮起+克制台词「**西边的灯塔**……好像又亮起来了」③任务组完成后开放，首次走入见执灯人。链路：**城市复兴 → 执灯人归来 → 灯塔重新点灯 → 开放**。
- **实现（08-10 制作人"效果不合格"返工后）**：撤除 farm 东北角海角远景（setupFarmHorizon 删除）；**灯塔地图移农场西侧**——farm.json 左 cols0-2/rows10-13 石墙打通为海湾缺口（setupFarmWestCoast：海面/浪花/沙滩/碰撞墙 x<40），lighthouse.json 左 cols0-3/rows9-13 打通入口通道；exits.ts：farm 西侧海湾出口→lighthouse `locked:true`（ExitZone.locked，不触发切换不显示箭头，未来移除即开放）+ lighthouse 西侧出口→farm；灯塔远景+内部灯室恒灭 alpha=0、无光束；`lighthouseUnlocked` 仅设计记录不加字段；文档 `docs/design/灯塔未来内容预埋方案-v1.0.md`（含未来恢复点）。
- **未来恢复点**：亮灯=setupFarmWestCoast 灯室改 `night ? 0.75 : 0`+呼吸+光束 / setupLighthouseVisuals 光晕改 `night ? 0.35 : 0.06`+光束+地面光斑；开放=exits.ts 移除 locked。
- **验证**：tsc EXIT=0；west-coast 5/5、lighthouse 7/7、lighthouse-visual 9/9；像素核验海湾海面 64.7%、右上角 0% 蓝（已恢复草地）。

## ⭐ Phaser 教训（08-10）
- 相机判定勿信 `cam.scrollX` 属性（follow+setBounds 下与实际 getWorldPoint(0,0).x 不一致）——探针轮询用 getWorldPoint；玩家移位必须 `setPosition()`（body 同步）
- Graphics `fillStyle(color, alpha)` 的 alpha 烘焙进填充色，GameObject `.alpha` 恒 1——要 setAlpha 控制且探针断言它
- HMR 抖动（并行会话 5173）：视觉验证必须用独立端口（5199）+ 探针 __game.scene 守卫重试
- 探针定位场景用 `find(x => x.player)`（getScenes(true)[0] 可能是 title）；showDialogueText 是 canvas 文本，探针读 `.text`

## 文本护栏体系（08-10，制作人拍板）
- D-017 文风标准 v1.1（角色指纹/不连续漂亮/四层过滤/禁 AI 替代角色思考）｜D-018 自主表达审查流程（四层：角色→权限→表达→留白）｜**D-019 米哈游对白学习样本库 v0.1**（金句准入五问）
- **金句准入五问**（漂亮句五问全过才准入，非删除）：①资格（经历过/付过代价）②伤口 or 观点③行动支撑④不完整人话（"算了。"）⑤只有他能说（遮名可猜）+ 大词配额制（核心词全岛仅 1-2 个合法持有者）+ 删句测试补充（呼吸句不能当主题句删）
- **A1 老周**：已定稿（描述动作不总结规律，"东西都带来了"）**施工冻结**；"有人开始修就有人愿意留下"移入镇长候选池（资格决定台词成立与否）
- 学习库 v0.1 台词凭记忆转述，正式引用需核对原文