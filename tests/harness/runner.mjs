/**
 * 测试运行器 — 扫描指定分类目录，串行执行测试文件，收集报告。
 *
 * 用法：
 *   node tests/harness/runner.mjs smoke        # 运行 smoke 分类
 *   node tests/harness/runner.mjs save         # 运行 save 分类
 *   node tests/harness/runner.mjs gameplay     # 运行 gameplay 分类
 *   node tests/harness/runner.mjs all          # 运行全部
 */

import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createReport } from './report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = join(__dirname, '..');

const SUITES = ['smoke', 'save', 'gameplay', 'event', 'chapter'];

async function runSuite(suiteName) {
  const suiteDir = join(TESTS_ROOT, suiteName);
  let files = [];
  try {
    files = readdirSync(suiteDir).filter(f => f.startsWith('test-') && f.endsWith('.mjs'));
  } catch {
    console.log(`\n[${suiteName}] 无测试文件，跳过`);
    return { suite: suiteName, results: [], allPassed: true };
  }

  if (files.length === 0) {
    console.log(`\n[${suiteName}] 无测试文件，跳过`);
    return { suite: suiteName, results: [], allPassed: true };
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  测试套件: ${suiteName} (${files.length} 个测试)`);
  console.log(`${'='.repeat(60)}\n`);

  const suiteReport = createReport(suiteName);
  const testResults = [];

  for (const file of files) {
    const testName = file.replace('.mjs', '');
    console.log(`--- ${testName} ---`);

    const testPath = join(suiteDir, file);
    const mod = await import(`file://${testPath}`);

    let passed = 0, failed = 0;
    try {
      const result = await mod.default({ suiteReport });
      if (result) {
        passed = result.passed ?? 0;
        failed = result.failed ?? 0;
      }
    } catch (err) {
      suiteReport.check(testName, false, `异常: ${err.message}`);
      failed = 1;
    }

    testResults.push({ name: testName, passed, failed });
    console.log('');
  }

  const summary = await suiteReport.finalize();
  return { suite: suiteName, results: testResults, allPassed: summary.allPassed, summary };
}

async function main() {
  const target = process.argv[2] || 'all';
  const suites = target === 'all' ? SUITES : [target];

  if (!SUITES.includes(target) && target !== 'all') {
    console.error(`未知分类: ${target}\n可用: ${SUITES.join(', ')}, all`);
    process.exit(1);
  }

  console.log(`\n归星物语 — 功能回归测试 v2.0`);
  console.log(`目标: ${target}\n`);

  const allResults = [];
  let totalPassed = 0, totalFailed = 0;

  for (const suite of suites) {
    const result = await runSuite(suite);
    allResults.push(result);
    if (result.summary) {
      totalPassed += result.summary.passed;
      totalFailed += result.summary.failed;
    }
  }

  // 总结
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  总结: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
