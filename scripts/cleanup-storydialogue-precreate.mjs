/**
 * P7c-b 清理v2：只移除紧跟在 playStory 调用之前的前置创建
 * 更保守：只处理紧挨着（5行内）有 this.playStory( 调用的前置创建
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_PATH = path.join(__dirname, '..', 'src', 'scenes', 'MapScene.ts');

let content = fs.readFileSync(FILE_PATH, 'utf8');
const lines = content.split('\n');

let removedCount = 0;
const skipReasons = [];

// 从后往前处理（避免行号偏移）
for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // 只处理明确的前置创建模式
  if (!trimmed.includes('if (!this.storyDialogue)') || 
      !trimmed.includes('new StoryDialogue()')) {
    continue;
  }
  
  // 不删除 playStory 方法内部的创建（检查上下文）
  // 向前搜索 15 行，看是否在 playStory 方法体内
  let inPlayStoryMethod = false;
  for (let j = Math.max(0, i - 30); j < i; j++) {
    if (lines[j].includes('public playStory(') || lines[j].includes('private playStory(')) {
      inPlayStoryMethod = true;
      break;
    }
  }
  if (inPlayStoryMethod) {
    skipReasons.push({ line: i + 1, reason: 'in_playStory_method' });
    continue;
  }
  
  // 向后搜索 10 行，看是否有 this.playStory( 调用
  let hasPlayStoryAfter = false;
  for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
    if (lines[j].includes('this.playStory(')) {
      hasPlayStoryAfter = true;
      break;
    }
  }
  
  if (hasPlayStoryAfter) {
    // 移除
    lines[i] = '';
    removedCount++;
  } else {
    skipReasons.push({ line: i + 1, reason: 'no_playStory_after' });
  }
}

fs.writeFileSync(FILE_PATH, lines.join('\n'), 'utf8');

console.log(`\n=== 清理结果 v2 ===`);
console.log(`移除前置创建: ${removedCount} 处`);
console.log(`跳过: ${skipReasons.length} 处`);

if (skipReasons.length > 0 && skipReasons.length <= 20) {
  console.log(`\n跳过原因:`);
  for (const s of skipReasons) {
    console.log(`  L${s.line}: ${s.reason}`);
  }
}