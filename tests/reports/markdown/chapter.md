# 测试报告: chapter

| 字段 | 值 |
|---|---|
| 时间 | 2026-08-12T18:17:12.662Z |
| Commit | 532b643 |
| 分支 | main |
| 耗时 | 22.5s |
| 结果 | **PASS** (11/11) |

## 检查项

| # | 结果 | 名称 | 详情 | 耗时 |
|---|---|---|---|---|
| 1 | PASS | 新游戏从标题开始 | scene=title | 3.1s |
| 2 | PASS | 初始章节 = 0 | chapter=0 | 3.1s |
| 3 | PASS | 进入车站场景 | scene=station | 5.1s |
| 4 | PASS | 初始 storyStep = station_intro | step=station_intro | 5.1s |
| 5 | PASS | 教程全部步骤推进成功 | - | 5.1s |
| 6 | PASS | 教程完成 (storyStep=done) | - | 5.1s |
| 7 | PASS | questState 可设为 completed | state=completed | 5.1s |
| 8 | PASS | 观星完成标记生效 | - | 5.1s |
| 9 | PASS | 存档中有章节状态 | - | 8.2s |
| 10 | PASS | 存档 storyStep = observatory_complete | step=observatory_complete | 8.2s |
| 11 | PASS | 刷新后 storyStep 保持 | step=observatory_complete | 12.2s |
