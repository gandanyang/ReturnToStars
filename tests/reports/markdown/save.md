# 测试报告: save

| 字段 | 值 |
|---|---|
| 时间 | 2026-08-29T02:15:46.860Z |
| Commit | d74b21f |
| 分支 | main |
| 耗时 | 8.6s |
| 结果 | **PASS** (10/10) |

## 检查项

| # | 结果 | 名称 | 详情 | 耗时 |
|---|---|---|---|---|
| 1 | PASS | 清档后从标题开始 | scene=title | 3.6s |
| 2 | PASS | 进入车站场景 | scene=station | 5.6s |
| 3 | PASS | 存档写入 localStorage | day=2 | 6.4s |
| 4 | PASS | 存档 storyStep=done | step=done | 6.4s |
| 5 | PASS | 存档有 inventory | has items | 6.4s |
| 6 | PASS | 存档有 radish_seed | count=10 | 6.4s |
| 7 | PASS | 刷新后存档仍在 | day=2 | 8.1s |
| 8 | PASS | 刷新后 storyStep 一致 | before=done after=done | 8.1s |
| 9 | PASS | 刷新后 day 一致 | before=2 after=2 | 8.1s |
| 10 | PASS | 刷新后 inventory 一致 | seeds: before=10 after=10 | 8.1s |
