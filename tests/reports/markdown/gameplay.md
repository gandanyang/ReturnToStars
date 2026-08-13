# 测试报告: gameplay

| 字段 | 值 |
|---|---|
| 时间 | 2026-08-13T14:43:27.454Z |
| Commit | 532b643 |
| 分支 | main |
| 耗时 | 12.1s |
| 结果 | **PASS** (7/7) |

## 检查项

| # | 结果 | 名称 | 详情 | 耗时 |
|---|---|---|---|---|
| 1 | PASS | 进入农场场景 | scene=farm | 9.7s |
| 2 | PASS | 锄地: empty → tilled | state=tilled | 10.2s |
| 3 | PASS | 播种: tilled → seeded | state=seeded | 10.4s |
| 4 | PASS | 浇水: seeded → watered | state=watered | 10.6s |
| 5 | PASS | 推进天数后状态变化 | state=grown | 11.1s |
| 6 | PASS | 收获: 回到 empty | state=empty | 11.5s |
| 7 | PASS | 农田状态已存档 | save exists | 11.5s |
