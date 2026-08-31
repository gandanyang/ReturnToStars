# 测试报告: event

| 字段 | 值 |
|---|---|
| 时间 | 2026-08-29T02:14:31.101Z |
| Commit | d74b21f |
| 分支 | main |
| 耗时 | 11.3s |
| 结果 | **PASS** (10/10) |

## 检查项

| # | 结果 | 名称 | 详情 | 耗时 |
|---|---|---|---|---|
| 1 | PASS | triggerOnce 首次执行回调 | - | 3.5s |
| 2 | PASS | hasTriggered 返回 true | - | 3.5s |
| 3 | PASS | 重复调用不执行 | - | 3.5s |
| 4 | PASS | markTriggered 标记成功 | - | 3.5s |
| 5 | PASS | 未触发事件返回 false | - | 3.5s |
| 6 | PASS | 存档已写入 | day=2 | 6.6s |
| 7 | PASS | 事件状态包含 test_event_a | keys=3 | 6.6s |
| 8 | PASS | 刷新后 test_event_a 仍已触发 | - | 10.9s |
| 9 | PASS | 刷新后 test_event_b 仍已触发 | - | 10.9s |
| 10 | PASS | 刷新后 test_event_never 仍未触发 | - | 10.9s |
