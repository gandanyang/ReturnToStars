/**
 * 测试报告 — 收集测试结果，生成 JSON + Markdown 报告。
 *
 * 用法：
 *   const report = createReport('save');
 *   report.check('存档保持', true, 'day=2, coins=100');
 *   ...
 *   await report.finalize();
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '..', 'reports');

/** 获取当前 git commit hash（短） */
function getGitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { hash, branch };
  } catch {
    return { hash: 'unknown', branch: 'unknown' };
  }
}

/**
 * 创建测试报告实例。
 * @param {string} suiteName — 测试套件名（如 'smoke'、'save'、'gameplay'）
 * @returns {object} report 对象
 */
export function createReport(suiteName) {
  const results = [];
  const startTime = Date.now();
  const git = getGitInfo();

  return {
    suiteName,
    git,
    results,

    /** 记录一个检查项 */
    check(name, ok, detail = '') {
      results.push({ name, ok: !!ok, detail, ts: Date.now() - startTime });
      const icon = ok ? 'PASS' : 'FAIL';
      console.log(`  [${icon}] ${name}${detail ? ' — ' + detail : ''}`);
      return ok;
    },

    /** 生成并写入报告文件 */
    async finalize() {
      const duration = Date.now() - startTime;
      const passed = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok).length;
      const allPassed = failed === 0;

      const report = {
        suite: suiteName,
        timestamp: new Date().toISOString(),
        git,
        duration,
        summary: { total: results.length, passed, failed, allPassed },
        results,
      };

      mkdirSync(join(REPORTS_DIR, 'json'), { recursive: true });
      mkdirSync(join(REPORTS_DIR, 'markdown'), { recursive: true });

      // JSON 报告
      const jsonPath = join(REPORTS_DIR, 'json', `${suiteName}.json`);
      writeFileSync(jsonPath, JSON.stringify(report, null, 2));

      // Markdown 报告
      const md = generateMarkdown(report);
      const mdPath = join(REPORTS_DIR, 'markdown', `${suiteName}.md`);
      writeFileSync(mdPath, md);

      console.log(`\n  报告: ${jsonPath}`);
      console.log(`  结果: ${passed}/${results.length} passed, ${failed} failed (${(duration / 1000).toFixed(1)}s)\n`);

      return { allPassed, passed, failed, total: results.length, duration, jsonPath, mdPath };
    },
  };
}

function generateMarkdown(report) {
  const lines = [
    `# 测试报告: ${report.suite}`,
    '',
    `| 字段 | 值 |`,
    `|---|---|`,
    `| 时间 | ${report.timestamp} |`,
    `| Commit | ${report.git.hash} |`,
    `| 分支 | ${report.git.branch} |`,
    `| 耗时 | ${(report.duration / 1000).toFixed(1)}s |`,
    `| 结果 | **${report.summary.allPassed ? 'PASS' : 'FAIL'}** (${report.summary.passed}/${report.summary.total}) |`,
    '',
    `## 检查项`,
    '',
    `| # | 结果 | 名称 | 详情 | 耗时 |`,
    `|---|---|---|---|---|`,
  ];

  report.results.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail || '-'} | ${(r.ts / 1000).toFixed(1)}s |`);
  });

  return lines.join('\n') + '\n';
}
