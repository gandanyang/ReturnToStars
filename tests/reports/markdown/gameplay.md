# 测试报告: gameplay

| 字段 | 值 |
|---|---|
| 时间 | 2026-08-14T05:29:56.227Z |
| Commit | 2cf8dd5 |
| 分支 | main |
| 耗时 | 9.8s |
| 结果 | **PASS** (7/7) |

## 检查项

| # | 结果 | 名称 | 详情 | 耗时 |
|---|---|---|---|---|
| 1 | PASS | 进入农场场景 | scene=farm | 7.7s |
| 2 | PASS | 锄地: empty → tilled | state=tilled | 8.1s |
| 3 | PASS | 播种: tilled → seeded | state=seeded | 8.3s |
| 4 | PASS | 浇水: seeded → watered | state=watered | 8.6s |
| 5 | PASS | 推进天数后状态变化 | state=planted | 9.1s |
| 6 | PASS | 收获: 回到 empty | state=empty | 9.4s |
| 7 | PASS | 农田状态已存档 | save exists | 9.4s |
