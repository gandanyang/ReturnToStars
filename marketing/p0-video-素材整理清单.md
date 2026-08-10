# P0 实机宣传视频·素材整理清单

> 2026-08-11 ｜ 用途：制作人录制 60~120 秒实机视频时的对照清单 + 素材索引
> 分工：录制=制作人；素材整理/bug 修复/流程验证=WorkBuddy

---

## 一、镜头脚本（对应成功标准 6 大展示点）

| 序 | 展示点 | 游戏内位置/操作 | 录制要点 | 状态 |
|---|---|---|---|---|
| 1 | 归来/海岛氛围 | 车站开场 → 农场西侧海湾（灯塔远景） | 开场黑屏→列车→老屋；西侧海湾看灯塔剪影+浪花 | ✅ 流程通 |
| 2 | 农场玩法 | 老屋前农田（播种→浇水→等待） | 播种/浇水动作 + 作物生长反馈 | ✅ 流程通 |
| 3 | 青禾镇探索 | 农场→小镇（石桥入口） | 街景/老木屋/石板路/花圃 | ✅ 流程通 |
| 4 | NPC 互动 | 镇长/夏雅/阿风/商店老板对话 | 对话气泡 + 立绘 + 语音 | ✅ 流程通 |
| 5 | 商店复兴 | 小镇商店（出售作物/买种子） | SmartSell 面板 + 商店灯光 | ✅ 流程通 |
| 6 | 夜晚/观星 | 观星点（夜间） | 星空/银河/流星/小镇灯光 | ✅ 流程通 |

> 走查验证：`probe-ch1-walkthrough` EXIT=0，0 运行时错误，9 节点截图齐全
> 截图参考：`tests/probes/test-screenshots/walkthrough-ch1/01~09-*.png`

## 二、录制建议（构图/节奏）

- **横屏 1024×768 基准**（项目红线，禁止竖屏）
- 建议 4K/1080p 录制后剪辑：归来(10s) → 农场(20s) → 小镇(20s) → NPC(15s) → 商店(15s) → 观星夜(25s) + 标题收尾(10s)
- 观星夜是情感峰值，建议放最后压轴，配 `stargaze_final` BGM

## 三、素材索引（录制备用）

### BGM（13 首，全部 ogg ≤3.5MB）
| 曲目 | 用途 |
|---|---|
| `title_main.ogg` / `island_wakes.ogg` | 开场/标题 |
| `farm_day.ogg` / `linche_theme2.ogg` | 农场日常/老屋 |
| `town.ogg` | 青禾镇 |
| `stargaze_night.ogg` / `stargaze_final.ogg` | 观星夜/结尾 |
| `spring_letter.ogg` | 夏雅主题 |
| `follow_wind.ogg` / `roads_wind.ogg` / `chasing_wind.ogg` | 阿风/风系列 |

### 氛围图（AI 生成，可做封面/转场）
- `marketing/cover/linchen-seaside-hero-v1.png`（林澈海边）
- `marketing/cover/linchen-town-revival-v1.png`（俯瞰村庄）
- `marketing/cover/lighthouse-hero-v1.png`（灯塔）
- `archive/promo/stargaze_night_bg_v1.jpg`（星空）
- `archive/promo/promo_town_dusk_v1.jpg`（小镇黄昏）

### 现有 AI 视频（可参考风格）
- `tmp/beach-couple.mp4`（9MB，海边）
- `tmp/img2video-44ea87f0-...mp4`（4MB，图生视频）

## 四、待制作人确认的展示点（我无法肉眼判断画面）

1. **灯塔西侧海湾**视觉是否到位（撤海角远景后）
2. **观星夜**特效密度（银河/流星/灯光）
3. **立绘**（夏雅 v4 / 阿风 v2）在对话中显示是否正常
4. **商店 SmartSell 面板**布局是否适合录屏

> 以上 4 点流程均通（探针通过），但画面质感需制作人录制时肉眼确认；若有问题反馈我立即修。
