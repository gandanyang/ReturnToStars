# 《归星物语》开幕曲 MV 视觉分镜 v0.1（R2 · 复兴主题）

> 制作人 2026-08-09 立项 ｜ 执行：ComfyUI 出图（anima_turbo + yourname 风格 LoRA）｜ 状态：📋 R5 完成（岛屿复苏篇·音乐高潮 5 镜头）
> 定位：围绕《归星物语》开幕曲，按「动画 MV / 游戏主题曲 MV」思路设计**连续镜头提示词**。
> 本轮不做完整 PV，先生成 **15 张叙事骨架镜头**，验证「音乐 + AI 二次元视觉 + 连续镜头」是否成立。
>
> **R2 修订说明（制作人拍板：从复兴主题出发——男女主一起努力，村子逐渐越来越好）**：
> - R0（游戏画面版）→ R1（音乐主题 · 个人归乡）→ **R2（音乐主题 · 复兴叙事）**
> - 核心叙事从「一个人的归来」改为「两个人的共同复兴」：**荒废的岛 → 两人相遇 → 一起努力 → 村子醒来 → 复兴之光**
> - 双人协作镜头为主；村子状态递进：**破败 → 修缮 → 恢复人气 → 繁荣**
> - 保留音乐骨架（钢琴=讲述者 / 大提琴=记忆与时间 / 弦乐=生命绽放）与角色连续锚点（R1 去游戏化形象）
> - **出图不覆盖历史版本**：R0 → `marketing/promo/v0/`，R1 → `marketing/promo/v1/`，R2 用新前缀 **`mv2_*`** 输出（绝对不动 `mv_*.png`）
>
> **历史版本**：
> - R0 初版（游戏画面版）：`marketing/promo/v0/mv_*.png`
> - R1 音乐主题版（个人归乡）：`marketing/promo/v1/mv_*.png` 与 `public/assets/images/promo/mv_*.png`
> - R2 音乐主题版（复兴叙事·双人）：`public/assets/images/promo/mv2_*.png`
> - R3 原始规格对照版（个人归乡）：`public/assets/images/promo/mv3_*.png`
> - R4 复兴主题版（两人努力 → 镇子与岛越来越好）：`public/assets/images/promo/mv4_*.png`
> - R5 岛屿复苏篇（音乐高潮 5 镜头，制作人提供 Scene prompt）：`public/assets/images/promo/mv5_*.png`
>
> **R5 说明（制作人 09:2x："切掉城市/火车/孤独，直接进入 PV 后半段——生命奔流 / 岛屿复苏篇"）**：
> - **核心洞察（制作人拍板）**：AI 笨在不知道"成长过程"——不能告诉它"繁荣的小镇"（它直接跳结果），要告诉它**"变化发生的瞬间"**（不是完成，是开始）
> - 高潮 = **一盏灯亮起来 / 一朵花开起来 / 一条街重新有人走**——小事形成大奇迹；**禁止**光柱/神迹/魔法/星球爆炸
> - 技巧：不用抽象词"修复（restoring）"，改用**具体动作**：painting old wooden signs / carrying flower pots / repairing broken fences / hanging lanterns / cleaning the harbor / planting flowers along the street / rebuilding old houses / lighting old street lamps
> - 核心立意：**林澈和夏雅不是拯救归星岛，而是让归星岛想起自己曾经活着**（伙伴关系，非情侣宣传、非英雄史诗）
> - 5 个 Scene prompt 由制作人提供（直接用 + 管线前缀 + 角色锚点增强）；**新前缀 `mv5_*`**（seed 6001-6005）；任务清单见「十二、R5 任务清单」
>
> **R4 说明（制作人拍板核心主题："在两个人的努力下，镇子和岛上变得越来越好！"）**：
> - R4 = 复兴主题重写，核心 = **两个人一起努力 → 镇子/岛越来越好**（去游戏化、音乐主题意象、电影化）
> - 五幕递进：A 荒废的岛（冷灰无人物）→ B 相遇（第一束暖光）→ C 一起努力（暖光+绿色）→ D 镇子醒来（人气+生命色）→ E 越来越好（暖峰→夜晚灯火）
> - **变化递进手法**：同一地点跨幕复现——老屋（A02 破败 → C01 修缮 → D01 新屋顶）、农田（A02 荒草 → C02 耕种 → D01 绿意）、小镇（A03 空街 → D02 人气）、岛全景（A01 荒废 → D03 黄昏亮灯 → E02 灯火通明）
> - 镜头：A01/A02/A03、B01/B02/B03、C01/C02/C03、D01/D02/D03、E01/E02/E03（各 3 张共 15 张）
> - **R4 出图用新前缀 `mv4_*`**（seed 5001-5403），不覆盖任何历史图；任务清单见「十二、R4 任务清单」

---

## 一、任务定位

围绕《归星物语》开幕曲，按「动画 MV / 游戏主题曲 MV」思路设计一套**具有连续性、可直接交给 AI 图片生成模型执行的视觉提示词**。先快速生成一批测试画面，验证「音乐 + AI 二次元视觉 + 连续镜头」能否形成真正有作品感的 MV。

## 二、核心创作方向（R2 · 复兴主题）

《归星物语》的核心不是单纯治愈/田园/种田/乡村生活，而是：

> **一个被时间遗忘的地方，在两个人的努力下重新呼吸。**

R2 的叙事重心从"个人归来"转向"共同复兴"：

- 两个人一起动手（修屋、种田、浇水）
- 村子逐渐变好（破败 → 修缮 → 人气 → 繁荣）
- 付出有回应，成果看得见
- 不是英雄救世，是**日常的、持续的、温柔的坚持**

音乐和画面共同表达：归来、记忆、**共同劳动**、生命复苏、**村子一天天醒来**、星光、希望。

整体情绪：**温暖 + 怀旧 + 生命感 + 微妙神秘 + 情绪逐渐展开**。不是热血战斗 / 英雄史诗 / 中二救世 / 单纯治愈 BGM / 普通乡村宣传片。

## 三、最重要的视觉原则：按照 MV 思维设计

不是"生成 15 张插画"，而是"制作一支 2~3 分钟的动画 MV，这 15 张图分别是其中的连续镜头"。

**镜头连续性**：每一个镜头都必须回答——前一个镜头发生了什么？当前镜头发生什么？下一个镜头为什么自然出现？

## 四、MV 故事结构（R2 复兴递进）

### 第一幕：荒（现状）
主题：**被时间遗忘的岛。**
表现：破败老屋、荒芜农田、冷清无人的小镇、灰海。不是苦大仇深，而是"这里曾经有人生活，后来安静了很久"。
音乐：亲密、缓慢的开场。

### 第二幕：遇见
主题：**两个人来到同一个地方。**
表现：男主来到老屋，女主出现；两人一起推开老屋的门；站在荒芜田边准备开始。
音乐：第一束暖光，旋律开始展开。

### 第三幕：一起努力
主题：**两个人一起动手。**
表现：一起修老屋、一起种田、一起看第一株幼苗。
音乐：弦乐渐强，生命在两人手中绽放。

### 第四幕：村子醒来
主题：**村子开始恢复人气。**
表现：花田盛开、小镇街道有了人、黄昏全村亮灯。
音乐：进入温暖高潮——「村子活过来了」。

### 第五幕：复兴之光
主题：**两个人看自己的成果。**
表现：夜晚并肩站在山坡俯瞰灯火通明的村、岛屿夜景、Logo Ending。
音乐：高潮后归于安静的希望。

## 五、镜头组（R2 · 15 张）

### Scene Group A：荒（3 张）
- A01 荒废的岛（开场全景）
- A02 荒芜农田（细节）
- A03 冷清小镇（空街）

### Scene Group B：遇见（3 张）
- B01 两人在老屋前相遇
- B02 一起推开老屋门
- B03 站在田边准备开始

### Scene Group C：一起努力（3 张）
- C01 一起修老屋
- C02 一起种田
- C03 一起看第一株幼苗

### Scene Group D：村子醒来（3 张）
- D01 花田
- D02 小镇恢复人气
- D03 黄昏全村亮灯

### Scene Group E：复兴之光（3 张）
- E01 夜晚两人俯瞰复兴的村
- E02 岛屿夜景（高空）
- E03 Logo Ending

## 六、角色连续性要求（最高优先级之一，R2 双人锚点）

### 双人镜头固定描述（所有双人镜头复用同一句，保证跨图一致）：

```
1boy 1girl, a tired young man in his late twenties with short dark hair and thin black-rimmed glasses wearing a light rolled-up shirt, and a warm girl with soft orange-gold medium-length hair and a small hair clip wearing a light short jacket
```

- 男主：疲惫的返乡青年，深棕短发、**细黑框眼镜**（标志性）、浅色挽袖衬衫 + 牛仔裤；温和内敛
- 女主：温暖橙金发少女、小发夹、浅色短外套；阳光、温柔、行动派
- 不使用角色名与游戏道具（工牌/智能手表/工具包/扳手/格纹标识），保持"电影里普通年轻人"的通用连续形象
- 禁止：热血 / 英雄 / 乙游男主 / 红夹克金发 / 16-20 岁少年感

### 本轮未出场角色（后续扩充再启用）
- 老人（花白头发胡须，树下旧笔记）／ 村民群像（摊贩、邻居）／ 青年旅人（旅行夹克 + 背包）

## 七、场景连续性要求

- B03 → C01 → C02 → C03：同一老屋与农田，时间连续（清晨），天气连续（晴朗），光照连续（晨光渐亮）
- D01 → D02 → D03：同一村子，从白天 → 午后 → 黄昏，色彩从生命色过渡到暖色高峰
- D03 → E01 → E02：同一村子，黄昏 → 夜晚，灯光从"刚点亮"到"灯火通明"
- E02 → E03：同一岛屿夜空，镜头从高空拉远到静帧

## 八、镜头提示词结构

每个镜头按以下格式输出（R2 含 18 字段）：镜头编号 / 镜头名称 / 叙事目的 / 前一镜头 / 后一镜头 / 人物 / 动作 / 环境 / 时间 / 天气 / 镜头语言 / 构图 / 光线 / 色彩 / 情绪 / AI生成Prompt / Negative Prompt / 连续性备注

## 九、视觉递进（R2）

- A 荒：冷青灰、空旷、压缩、静默
- B 遇见：第一束暖光，画面开始有"人"的温度
- C 一起努力：晨光明亮，绿色逐渐增加，协作感
- D 村子醒来：色彩丰富，人气恢复，暖色达到高峰
- E 复兴之光：夜晚灯火（暖金）与蓝紫星空并存

即使没有台词，观众也能通过视觉知道：**这个被遗忘的地方正在被两个人重新建设起来。**

## 十、视觉风格

整体：**高质量二次元动画电影感 / 日系游戏 MV 氛围**。关键词：anime cinematic / emotional storytelling / atmospheric / soft natural lighting / detailed background / nostalgic / subtle film grain / painterly anime background / cinematic composition / emotional character acting / warm light / flowing atmosphere。不直接模仿具体商业作品。

- **正向 Prompt 统一前缀**：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling,
```

- **负向 Prompt（全部镜头复用）**：

```
lowres, bad anatomy, bad hands, missing fingers, extra digits, watermark, text, logo, signature, username, realistic photo, 3d, nsfw, blurry, jpeg artifacts, worst quality, low quality, deformed, extra limbs, screenshot, ui, hud, game interface
```

## 十一、15 镜头完整分镜（R2）

---

### 【A01】荒废的岛

- 镜头名称：荒废的岛（开场全景）
- 叙事目的：建立"被时间遗忘的地方"——故事的起点
- 前一镜头：无（片头黑场淡入）
- 后一镜头：A02 荒芜农田
- 人物：无
- 动作：空镜，岛屿静默
- 环境：海中的小岛，岸边破败老屋，空荡荒芜的农田
- 时间：黄昏
- 天气：多云、微凉
- 镜头语言：缓慢推进的大远景，像音乐的第一个音符
- 构图：三分法，岛居中偏下，天空占上
- 光线：阴云下的柔和灰光
- 色彩：冷青灰，压抑但安静
- 情绪：怀旧、孤独、被遗忘的平静
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, a forgotten small island seen from the sea at dusk, an abandoned old farmhouse with weathered grey wood on the shore, empty overgrown fields, a calm grey sea, the island forgotten by time, quiet melancholy, cold blue-grey palette, like the first slow piano notes before a story begins, wide establishing shot, atmospheric haze, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：全片色温基准最低点；B04 时代的岛是远景，这里首次给全景

---

### 【A02】荒芜农田

- 镜头名称：荒芜农田
- 叙事目的：细节证明"这里曾经有人生活"——记忆的痕迹
- 前一镜头：A01 荒废的岛
- 后一镜头：A03 冷清小镇
- 人物：无
- 动作：空镜，风过草尖
- 环境：杂草丛生的田垄、断木栅栏、插在土里的旧锈农具
- 时间：清晨/灰白天
- 天气：阴、无风、微光
- 镜头语言：贴近地面的细节镜头
- 构图：低机位，锈农具为前景
- 光线：柔和的灰白漫射光
- 色彩：土灰、枯黄、铁锈色
- 情绪：寂静、被遗忘的往昔
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, a desolate farm field overgrown with wild grass and withered weeds, broken wooden fence and an old rusty hand tool left in the soil, traces that someone once lived here, soft grey morning light, cold muted colors, the memory of life that has faded, intimate detail shot, nostalgic quiet sorrow, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 A01 同岛同日段；此处细节为 C02 一起种田提供"修复对象"

---

### 【A03】冷清小镇

- 镜头名称：冷清小镇
- 叙事目的：村子"睡着"的状态——复兴的对象
- 前一镜头：A02 荒芜农田
- 后一镜头：B01 两人在老屋前相遇
- 人物：无
- 动作：空镜，落叶被风卷过
- 环境：旧街道、斑驳招牌、紧闭的店门、老房子
- 时间：下午
- 天气：阴天、凉风
- 镜头语言：沿街道的纵深空镜
- 构图：街道中轴线对称，纵深消失点
- 光线：灰蓝的漫射光
- 色彩：冷灰蓝、旧木色
- 情绪：孤独、安静的等待
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, a quiet empty village street with old houses and faded shop signs, doors closed, fallen leaves drifting in the wind, no people around, cold grey-blue afternoon, the village asleep and forgotten, lonely peaceful atmosphere, wide shot down the empty street, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 D02 同一街道（白天），形成"空街 → 人气"呼应

---

### 【B01】两人在老屋前相遇

- 镜头名称：两人在老屋前相遇
- 叙事目的：故事从"一个人"变成"两个人"——命运交汇
- 前一镜头：A03 冷清小镇
- 后一镜头：B02 一起推开老屋门
- 人物：男主 + 女主
- 动作：男主站在老屋门前，女主从旧路走来，视线交汇
- 环境：破败老屋前院，旧石阶
- 时间：清晨
- 天气：多云转晴，第一束阳光
- 镜头语言：中全景，双人同框
- 构图：男左女右，老屋为背景
- 光线：云隙暖阳突破冷调
- 色彩：冷背景中第一次出现暖黄
- 情绪：好奇、温暖的开始
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, 1boy 1girl, a tired young man in his late twenties with short dark hair and thin black-rimmed glasses, and a warm girl with soft orange-gold medium-length hair and a small hair clip, meeting for the first time in front of an old abandoned farmhouse, he standing by the weathered door, she walking up the old path, a first shaft of warm sunlight breaking through the clouds, the beginning of something, gentle hopeful mood, wide cinematic composition, warm light against cool shadow, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：双人锚点第一次完整出现，此后所有双人镜头复用相同人物描述；老屋与 A01 同栋

---

### 【B02】一起推开老屋门

- 镜头名称：一起推开老屋门
- 叙事目的：共同决定开始——"我们来做"的瞬间
- 前一镜头：B01 两人在老屋前相遇
- 后一镜头：B03 站在田边准备开始
- 人物：男主 + 女主
- 动作：两人并肩推门，晨光涌入
- 环境：老屋内部，昏暗积尘，旧木家具
- 时间：清晨
- 天气：晴朗
- 镜头语言：从屋内向外拍，门开光入
- 构图：门框为画框，两人剪影在光中
- 光线：门缝倾泻的金色晨光，尘埃浮动
- 色彩：暖金与冷暗对比
- 情绪：希望、开启、并肩
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, 1boy 1girl, the young man and the warm girl pushing open the old wooden door of the farmhouse together, shoulder to shoulder, a flood of golden morning light pouring into the dim dusty room, dust motes drifting like floating memories, old wooden furniture awakening, the first piano note of a new beginning, warm light against cool shadow, hopeful and tender, two people starting a shared story, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：屋内陈设与 A01 老屋一致；与 R1 C01（单人推门）同场景但改为双人

---

### 【B03】站在田边准备开始

- 镜头名称：站在田边准备开始
- 叙事目的：向土地宣告开始——决心
- 前一镜头：B02 一起推开老屋门
- 后一镜头：C01 一起修老屋
- 人物：男主 + 女主
- 动作：两人并肩站在田边，挽起袖子，看向土地
- 环境：荒芜农田边缘，老屋在远处
- 时间：清晨
- 天气：晴朗
- 镜头语言：背面中全景，双人背影
- 构图：两人居中，田垄延伸向远方
- 光线：柔和的晨光侧照
- 色彩：土色 + 第一抹新绿
- 情绪：安静决心、共同希望
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, 1boy 1girl, the young man and the warm girl standing side by side at the edge of an overgrown field, rolling up their sleeves, looking at the waiting earth together, soft morning light, quiet determination and shared hope, the melody beginning to unfold, medium-wide shot from behind, warm earthy tones, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 A02 同一块田（此时已翻整一半）；B 组色温全面转暖

---

### 【C01】一起修老屋

- 镜头名称：一起修老屋
- 叙事目的：复兴的第一件实事——把"家"修好
- 前一镜头：B03 站在田边准备开始
- 后一镜头：C02 一起种田
- 人物：男主 + 女主
- 动作：男主扶木板，女主递锤子/工具，协作
- 环境：老屋外墙，木梯、木板、工具
- 时间：上午
- 天气：晴朗
- 镜头语言：近景动作镜头，带生活感
- 构图：双人斜线构图，木屋为背景
- 光线：明亮晨光，木屑在光中飞舞
- 色彩：暖木色 + 新木色
- 情绪：温暖协作、踏实
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, 1boy 1girl, the young man holding a wooden board against the old wall of the farmhouse while the warm girl hands him a hammer, repairing the old house together, bright morning sunlight, sawdust floating in the light, warm teamwork, gentle laughter implied, close action shot, earthy warm tones with fresh wood color, the feeling of life being mended, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：老屋外墙与 B01/B02 同栋（木板修补处可见）；两人装束同 B 组

---

### 【C02】一起种田

- 镜头名称：一起种田
- 叙事目的：复兴的核心动作——把生命种进土地
- 前一镜头：C01 一起修老屋
- 后一镜头：C03 一起看第一株幼苗
- 人物：男主 + 女主
- 动作：男主蹲着放种入土，女主跪在旁浇水
- 环境：翻整过的田垄，远处老屋
- 时间：上午
- 天气：晴朗
- 镜头语言：侧面中景，双人并排
- 构图：双人对称于田垄，绿苗在前景
- 光线：明亮阳光，土壤湿润反光
- 色彩：深褐土壤 + 鲜绿
- 情绪：安静专注、共同创造
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, 1boy 1girl, the young man crouching pressing seeds into dark rich soil while the warm girl kneels beside him gently watering, side by side on the field row, morning light on the earth, tiny green sprouts appearing between their hands, shared quiet work, deep connection between people and land, warm sunlight and fresh green, medium shot, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 A02 同一块田（已翻整播种）；绿意开始出现——生命色的起点

---

### 【C03】一起看第一株幼苗

- 镜头名称：一起看第一株幼苗
- 叙事目的：付出得到回应的瞬间——第一次心动
- 前一镜头：C02 一起种田
- 后一镜头：D01 花田
- 人物：男主 + 女主
- 动作：两人蹲在一起低头看幼苗，微笑
- 环境：田垄中一株小苗，金色逆光
- 时间：清晨/傍晚（逆光）
- 天气：晴朗
- 镜头语言：过肩近景
- 构图：两人肩头为前景，幼苗在光中
- 光线：金色逆光勾勒幼苗
- 色彩：金色光 + 新绿
- 情绪：温柔、欣慰、像弦乐渐强
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, 1boy 1girl, the young man and the warm girl crouching together looking down at the first tiny green seedling, gentle tender smiles, golden morning backlight glowing around the young plant, the first reward of their shared effort, warm hopeful emotion like rising strings, close-up over their shoulders, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：幼苗延续 C02；这是"生命绽放"的第一次呈现，情绪节点

---

### 【D01】花田

- 镜头名称：花田
- 叙事目的：村子周围开始有生命——复兴扩展
- 前一镜头：C03 一起看第一株幼苗
- 后一镜头：D02 小镇恢复人气
- 人物：无（远景可有人影）
- 动作：空镜，花海随风起伏
- 环境：村周花田盛开向海，村舍屋顶隐现
- 时间：白天
- 天气：晴朗、微风
- 镜头语言：开阔全景
- 构图：花田引导线通向海与村
- 光线：明亮柔和日光
- 色彩：粉白黄生命色大爆发
- 情绪：欣喜、生命绽放、弦乐齐奏
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, a vast flower field blooming around the village toward the sea, pink white and yellow wildflowers swaying like rising strings, bright gentle daylight, the island beginning to breathe again, the village roofs visible among the flowers, vibrant life colors, wide open composition, joyful yet tender, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 A01 同岛（村周视角）；色彩从 C 组的新绿扩展到生命色

---

### 【D02】小镇恢复人气

- 镜头名称：小镇恢复人气
- 叙事目的：村子醒来的直接证据——街道有人了
- 前一镜头：D01 花田
- 后一镜头：D03 黄昏全村亮灯
- 人物：村民群像（远景）、男女主可出现在人群中
- 动作：摊贩摆摊、灯笼点亮、村民交谈
- 环境：与 A03 同一条街道（已修复招牌、挂灯笼、摆摊位）
- 时间：午后
- 天气：晴朗
- 镜头语言：中远景街道镜头
- 构图：街道纵深，人流为点缀
- 光线：温暖午后阳光
- 色彩：暖色 + 鲜艳招牌色
- 情绪：热闹但不喧嚣、温柔的生机
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, a small village street alive again at golden afternoon, repaired shop signs with fresh paint, warm lanterns being lit, a few villagers talking by the stalls, baskets of fresh produce, gentle lively atmosphere without noise, the village slowly coming back to life, warm colorful palette, medium-wide shot, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 A03 同一条街道（白天同一机位方向）——"空街 → 人气"的直接呼应

---

### 【D03】黄昏全村亮灯

- 镜头名称：黄昏全村亮灯
- 叙事目的：复兴的高潮——村子活过来了
- 前一镜头：D02 小镇恢复人气
- 后一镜头：E01 夜晚两人俯瞰
- 人物：无（远观）
- 动作：空镜，灯火逐一亮起
- 环境：从山坡俯瞰全村，屋顶、街道、田、海
- 时间：黄昏
- 天气：晴朗、微云
- 镜头语言：广阔抒情全景，缓慢升起
- 构图：村落铺展，天际线为黄金
- 光线：金色黄昏 + 初亮的暖灯
- 色彩：橙粉紫天空 + 万家灯火——全片暖色峰值
- 情绪：温暖高潮、「村子醒过来了」
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, the whole village seen from a hillside at dusk, golden hour flooding over the rooftops, warm lights turning on one by one in every window, the music reaching its blooming climax, the forgotten village alive again and growing brighter, orange pink and soft purple sky, long soft shadows, expansive emotional wide shot, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：山坡机位与 E01 相同——D03 无人，E01 有两人，形成"成果等待见证"

---

### 【E01】夜晚两人俯瞰

- 镜头名称：夜晚两人俯瞰复兴的村
- 叙事目的：两人看自己的成果——复兴的见证
- 前一镜头：D03 黄昏全村亮灯
- 后一镜头：E02 岛屿夜景
- 人物：男主 + 女主
- 动作：两人并肩站山坡，俯瞰灯火通明的村，夜风
- 环境：山坡高地，下方全村灯火
- 时间：夜晚
- 天气：晴朗、微风
- 镜头语言：背面中全景，双人背影剪影
- 构图：两人在前下方，村灯如星海
- 光线：暖灯从下方映照 + 月光
- 色彩：深蓝夜 + 暖金灯海
- 情绪：欣慰、平静的骄傲、共同归属
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, 1boy 1girl, the young man and the warm girl standing side by side on a quiet hilltop at night, seen from behind, overlooking the revived village glowing with warm lights below them, night wind in their clothes, quiet pride and shared hope, the reward of their effort, deep blue night with warm golden lights below, emotional wide composition, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 D03 同机位（此时已入夜）；双人背影与 B03 呼应——从"开始"到"见证"

---

### 【E02】岛屿夜景

- 镜头名称：岛屿夜景（高空）
- 叙事目的：复兴成果的全局——岛在夜晚活着
- 前一镜头：E01 夜晚两人俯瞰
- 后一镜头：E03 Logo Ending
- 人物：无
- 动作：空镜，镜头缓慢拉远
- 环境：整个岛，村灯如星座，海环岛
- 时间：夜晚
- 天气：晴朗
- 镜头语言：高空大远景，逐渐拉远
- 构图：岛屿居中，海与月光铺展
- 光线：月光 + 万家暖灯
- 色彩：靛蓝海 + 暖金灯海
- 情绪：安静的圆满、归属
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, the entire small island seen from very high above at night, the revived village glowing like a constellation of warm lights across the land, dark sea reflecting moonlight around the island, alive and peaceful, the camera slowly pulling away, deep blue and indigo with warm golden lights, quiet emotional resolution, wide aerial composition, detailed painterly background, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 A01 同一座岛——「荒废的灰岛」→「灯火通明的岛」首尾呼应

---

### 【E03】Logo Ending

- 镜头名称：Logo Ending
- 叙事目的：收束——两个人站在星空下，故事未完
- 前一镜头：E02 岛屿夜景
- 后一镜头：片尾 Logo（后期合成）
- 人物：男主 + 女主（剪影）
- 动作：两人小剪影站在高处仰望星空
- 环境：夜空银河，下方岛影与村灯
- 时间：深夜
- 天气：晴朗无云
- 镜头语言：静帧，长时间停留
- 构图：上方大面积留黑（放《归星物语》标题）
- 光线：星光 + 微弱村灯
- 色彩：深蓝紫 + 星光
- 情绪：宁静、希望、余韵
- AI生成Prompt：

```
yourname style, masterpiece, best quality, score_9, score_8, highres, absurdres, anime cinematic opening theme music video still, emotional storytelling, 1boy 1girl, two small silhouettes of a young man and a girl standing on a high point under a vast starry night sky with a gentle milky way, the dark island horizon and glowing village lights below, large area of clean dark sky in the upper part of the frame reserved for the title, quiet vast atmosphere, deep blue purple palette, serene closure, detailed starfield, subtle film grain
```

- Negative Prompt：见第十节统一负向
- 连续性备注：与 E01 双人剪影呼应；上方留空由后期加标题

---

## 十二、第一轮 AI 生成任务清单（R2）

> 提示词文件放 `tmp/`（UTF-8，R2 用 `mv2_p*.txt` 新文件，不覆盖 R1 的 `mv_p*.txt`），负向共用 `tmp/comfy_neg.txt`。
> **输出用新前缀 `mv2_*`，绝不覆盖 `mv_*.png`**；输出目录 `public/assets/images/promo/`。
> 每张固定 seed：A 组 3001-3003，B 组 3101-3103，C 组 3201-3203，D 组 3301-3303，E 组 3401-3403。

| # | 镜头 | 输出文件名 | 推荐画幅 | 推荐时长 | seed | 角色连续性要点 | 场景连续性要点 |
|---|---|---|---|---|---|---|---|
| 1 | A01 荒废的岛 | mv2_A01_forgotten_island | 1216×832 | 4s | 3001 | 空镜 | 全片冷调基准，与 E02 首尾呼应 |
| 2 | A02 荒芜农田 | mv2_A02_dead_field | 1216×832 | 3.5s | 3002 | 空镜 | 与 C02 同一块田 |
| 3 | A03 冷清小镇 | mv2_A03_empty_street | 1216×832 | 3.5s | 3003 | 空镜 | 与 D02 同街道 |
| 4 | B01 两人在老屋前相遇 | mv2_B01_first_meeting | 1216×832 | 4s | 3101 | 双人锚点首现：男主黑框眼镜/挽袖衬衫 + 女主橙金发/短外套 | 老屋与 A01 同栋 |
| 5 | B02 一起推开老屋门 | mv2_B02_open_door | 1216×832 | 4s | 3102 | 双人同锚点 | 屋内与 B01 同屋 |
| 6 | B03 站在田边准备开始 | mv2_B03_field_side | 1216×832 | 3.5s | 3103 | 双人背影（B 组装束） | 与 A02 同一块田 |
| 7 | C01 一起修老屋 | mv2_C01_repair_house | 1216×832 | 4s | 3201 | 双人同锚点，装束同 B 组 | 老屋外墙与 B01 同栋 |
| 8 | C02 一起种田 | mv2_C02_farming_together | 1216×832 | 4s | 3202 | 双人同锚点 | 与 A02 同一块田（已播种） |
| 9 | C03 一起看第一株幼苗 | mv2_C03_first_seedling | 1216×832 | 4s | 3203 | 双人同锚点，过肩近景 | 幼苗延续 C02 |
| 10 | D01 花田 | mv2_D01_flowerfield | 1216×832 | 4s | 3301 | 空镜 | 与 A01 同岛（村周视角） |
| 11 | D02 小镇恢复人气 | mv2_D02_village_alive | 1216×832 | 4s | 3302 | 村民群像远景 | 与 A03 同街道（白天） |
| 12 | D03 黄昏全村亮灯 | mv2_D03_village_dusk | 1216×832 | 5s | 3303 | 空镜 | 山坡机位与 E01 相同 |
| 13 | E01 夜晚两人俯瞰 | mv2_E01_hilltop_view | 1216×832 | 5s | 3401 | 双人背影（与 B03 呼应） | 与 D03 同机位（已入夜） |
| 14 | E02 岛屿夜景 | mv2_E02_island_night | 1216×832 | 6s | 3402 | 空镜 | 与 A01 同岛（夜景） |
| 15 | E03 Logo Ending | mv2_E03_logo_ending | 1216×832 | 6s（含 Logo 停留） | 3403 | 双人剪影 | 与 E01 剪影呼应，上方留空 |

**提示词来源**：正文每个镜头的「AI生成Prompt」+ 第十节统一前缀/负向。固定 seed 便于复现与重跑。

### R3 对照版任务清单（按 v0.1 原始规格，个人归乡叙事）

> 提示词文件 `tmp/mv3_p01~p15.txt`（完整 prompt），负向共用 `tmp/comfy_neg.txt`；输出 `public/assets/images/promo/mv3_*.png`；1216×832；seed A 组 4001-4003 / B 组 4101-4103 / C 组 4201-4203 / D 组 4301-4303 / E 组 4401-4403。

| # | 镜头（v0.1 编号） | 输出文件名 | 推荐时长 | seed | 角色连续性要点 | 场景连续性要点 |
|---|---|---|---|---|---|---|
| 1 | A01 深夜办公室 | mv3_A01_office_wide | 3.5s | 4001 | 空镜/背影，男主锚点首现 | 城市段冷调基准 |
| 2 | A02 独自面对电脑 | mv3_A02_office_close | 4s | 4002 | 男主近景（黑框眼镜/素色衬衫） | 与 A01 同夜同时段 |
| 3 | A05 火车站 | mv3_A05_station | 3.5s | 4003 | 男主装束同 A02 | 站台暖灯=全片首个暖色 |
| 4 | B01 火车驶入小站 | mv3_B01_train | 4s | 4101 | 空镜 | 黄昏海岸，暖色起点 |
| 5 | B04 第一次看见归星岛 | mv3_B04_first_sight | 5s | 4102 | 男主背影 | 与 B01 同黄昏，海边→远岛 |
| 6 | B05 老屋远景 | mv3_B05_homestead | 4s | 4103 | 男主远景小身影 | 与 B04 时间连续，黄昏入暮 |
| 7 | C01 推开老屋门 | mv3_C01_open_door | 4s | 4201 | 男主转海岛段装束（浅色挽袖） | 次日清晨，晨光直射，旧屋积尘 |
| 8 | C05 播种 | mv3_C05_planting | 3.5s | 4202 | 男主手部近景 | 与 C01 同日，农田 |
| 9 | C07 第一株植物 | mv3_C07_seedling | 4s | 4203 | 空镜 | 生命绽放首现，金色逆光 |
| 10 | D01 花田 | mv3_D01_flowerfield | 4s | 4301 | 空镜 | 生命色扩展，与 C07 过渡 |
| 11 | D04 夏雅 | mv3_D04_xiaya | 4s | 4302 | 温暖橙金发少女锚点（去工具道具） | 午后花径，世界回应中的人 |
| 12 | D07 黄昏岛屿 | mv3_D07_island_dusk | 5s | 4303 | 空镜 | 全片暖色峰值，岛屿苏醒高潮 |
| 13 | E05 仰望星空 | mv3_E05_stargaze | 6s | 4401 | 男主背影，装束同 C/D | 蓝紫夜，星之碎片意象 |
| 14 | E06 岛屿夜景 | mv3_E06_island_night | 6s | 4402 | 空镜 | 高空拉远，与 A01 首尾呼应 |
| 15 | E07 Logo Ending | mv3_E07_logo | 6s（含 Logo 停留） | 4403 | 单人剪影 | 上方留空放标题 |

### R4 任务清单（复兴主题：两人努力 → 镇子与岛越来越好）

> 提示词文件 `tmp/mv4_p01~p15.txt`（完整 prompt），负向共用 `tmp/comfy_neg.txt`；输出 `public/assets/images/promo/mv4_*.png`；1216×832；seed A 组 5001-5003 / B 组 5101-5103 / C 组 5201-5203 / D 组 5301-5303 / E 组 5401-5403。

| # | 镜头 | 输出文件名 | 推荐时长 | seed | 角色要点 | 变化递进要点（同地点跨幕） |
|---|---|---|---|---|---|---|
| 1 | A01 荒废的岛（海面全景） | mv4_A01_island_waste | 4s | 5001 | 无人物 | 全片基准：冷灰荒废，与 E02 首尾呼应 |
| 2 | A02 荒废的老屋与农田 | mv4_A02_house_waste | 4s | 5002 | 无人物 | 老屋破败/农田荒草，与 C01/D01 对照 |
| 3 | A03 冷清的小镇（空街） | mv4_A03_town_empty | 3.5s | 5003 | 无人物 | 空街冷灰，与 D02 人气对照 |
| 4 | B01 老屋前相遇 | mv4_B01_first_meet | 4s | 5101 | 男主（黑框眼镜）+ 夏雅（橙金发）同框首现 | 第一束暖光破冷色 |
| 5 | B02 一起望向老屋（背影） | mv4_B02_look_house | 3.5s | 5102 | 双人同向背影 | 与 A02 同视角，开始决定 |
| 6 | B03 田边规划（触土/种子） | mv4_B03_field_plan | 3.5s | 5103 | 双人（男主触土/夏雅提种子篮） | 与 A02 农田同场景 |
| 7 | C01 一起修老屋 | mv4_C01_repair_house | 4s | 5201 | 双人协作（修屋顶/递木板） | 老屋开始修复，暖金上升 |
| 8 | C02 一起耕田播种 | mv4_C02_plow_sow | 4s | 5202 | 双人协作（锄地/撒种） | 农田翻新，第一抹绿 |
| 9 | C03 一起照料幼苗（双手浇水） | mv4_C03_water_sprouts | 3.5s | 5203 | 双人手部特写 | 幼苗出土=共同成果初现 |
| 10 | D01 农田绿意与花田 | mv4_D01_field_flower | 4s | 5301 | 夏雅在花径 | 老屋新屋顶+农田绿，生命色扩散 |
| 11 | D02 小镇恢复人气 | mv4_D02_town_alive | 4s | 5302 | 双人+镇民群像 | 空街→热闹，镇子醒来 |
| 12 | D03 黄昏全镇亮灯 | mv4_D03_dusk_lights | 5s | 5303 | 无人物 | 暖色峰值，岛真正活了 |
| 13 | E01 两人俯瞰繁荣的岛（背影） | mv4_E01_hillside_view | 5s | 5401 | 双人并肩背影 | 与 B02 姿态呼应，成果尽收眼底 |
| 14 | E02 夜晚岛屿灯火通明 | mv4_E02_island_night | 6s | 5402 | 无人物 | 与 A01 同一岛，荒废→繁荣 |
| 15 | E03 Logo Ending | mv4_E03_logo | 6s（含 Logo 停留） | 5403 | 无人物 | 繁荣岛屿夜景，上方留空放标题 |

### R5 任务清单（岛屿复苏篇·音乐高潮，制作人提供 Scene prompt）

> 提示词文件 `tmp/mv5_p01~p05.txt`（制作人原文 + 管线前缀 + 角色锚点增强），负向共用 `tmp/comfy_neg.txt`；输出 `public/assets/images/promo/mv5_*.png`；1216×832；seed 6001-6005。

| # | Scene | 输出文件名 | 推荐时长 | seed | 关键词（变化发生的瞬间） | 镜头语言 |
|---|---|---|---|---|---|---|
| 1 | S01 第一次看到变化 | mv5_S01_first_change | 5s | 6001 | first flowers blooming from the repaired land / slowly showing signs of life | 高潮开始，wide，暖光破云 |
| 2 | S02 一起修复小镇 | mv5_S02_repair_town | 5s | 6002 | 具体动作：搬木料/种花/漆木牌/修栅栏/挂灯笼 | dynamic wide，午后暖阳，镇民群像 |
| 3 | S03 镇子重新亮起来 | mv5_S03_town_lights | 5s | 6003 | lights turning on one by one / children and villagers returning | 音乐高潮，golden hour 全景 |
| 4 | S04 共同瞬间 | mv5_S04_partners_hill | 6s | 6004 | backs facing camera / not heroes, people who helped a place find life again | 黄昏山坡，钢琴+大提琴感，收束 |
| 5 | S05 群像高潮 | mv5_S05_festival_climax | 6s | 6005 | evening festival / celebration of life returning / stars above ocean | 世界回应，温暖庆典，grand but warm |

**R5 连续性铁律**（制作人拍板）：不出现光柱/神迹/魔法/星球爆炸；核心 = 林澈 + 夏雅 + 镇民共同创造，让归星岛想起自己曾经活着。

## 十三、执行纪律

本任务：**不修改游戏代码、不新增游戏系统、不生成大量无关图片**。先完成：分镜 → Prompt → 第一轮 15 张 Concept Art（R2 复兴主题版），然后停止，等待制作人查看第一轮效果后，再决定是否继续 / 哪些镜头重做 / 画风保留 / 角色表现调整 / 是否开始正式 MV 制作。

## 十四、后续扩充候选镜头（确认后再启用）

- A 组补充：灰海、灯塔、锈船
- B 组补充：两人搬行李、第一次对话（窗边）
- C 组补充：一起做饭、一起洗衣晾晒、一起夜谈
- D 组补充：市集全景、老人出现、孩子们在街角玩
- E 组补充：观星夜、星之碎片、全村篝火
- 角色补充：老人（爷爷）、村民群像、青年旅人（阿风）
