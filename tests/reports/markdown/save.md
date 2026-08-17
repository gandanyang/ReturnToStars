# 测试报告: save

| 字段 | 值 |
|---|---|
| 时间 | 2026-08-17T16:18:47.478Z |
| Commit | aac2c53 |
| 分支 | main |
| 耗时 | 10.6s |
| 结果 | **PASS** (10/10) |

## 检查项

| # | 结果 | 名称 | 详情 | 耗时 |
|---|---|---|---|---|
| 1 | PASS | 清档后从标题开始 | scene=title | 5.7s |
| 2 | PASS | 进入车站场景 | scene=station | 7.7s |
| 3 | PASS | 存档写入 localStorage | day=2 | 8.5s |
| 4 | PASS | 存档 storyStep=done | step=done | 8.5s |
| 5 | PASS | 存档有 inventory | has items | 8.5s |
| 6 | PASS | 存档有 radish_seed | count=10 | 8.5s |
| 7 | PASS | 刷新后存档仍在 | day=2 | 10.1s |
| 8 | PASS | 刷新后 storyStep 一致 | before=done after=done | 10.1s |
| 9 | PASS | 刷新后 day 一致 | before=2 after=2 | 10.1s |
| 10 | PASS | 刷新后 inventory 一致 | seeds: before=10 after=10 | 10.1s |
