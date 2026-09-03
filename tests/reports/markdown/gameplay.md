# 测试报告: gameplay

| 字段 | 值 |
|---|---|
| 时间 | 2026-09-03T05:04:31.082Z |
| Commit | 6c94595 |
| 分支 | main |
| 耗时 | 9.5s |
| 结果 | **PASS** (7/7) |

## 检查项

| # | 结果 | 名称 | 详情 | 耗时 |
|---|---|---|---|---|
| 1 | PASS | 进入农场场景 | scene=farm | 7.4s |
| 2 | PASS | 锄地: empty → tilled | state=tilled | 7.8s |
| 3 | PASS | 播种: tilled → seeded | state=seeded | 8.0s |
| 4 | PASS | 浇水: seeded → watered | state=watered | 8.2s |
| 5 | PASS | 推进天数后状态变化 | state=planted | 8.8s |
| 6 | PASS | 收获: 回到 empty | state=empty | 9.1s |
| 7 | PASS | 农田状态已存档 | save exists | 9.1s |
