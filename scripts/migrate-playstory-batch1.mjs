/**
 * P7c-b 批次1：简单文本替换 storyDialogue.play → playStory
 * 不分析括号，直接替换所有匹配
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_PATH = path.join(__dirname, '..', 'src', 'scenes', 'MapScene.ts');

let content = fs.readFileSync(FILE_PATH, 'utf8');

// 统计替换前数量
const beforeCount = (content.match(/this\.storyDialogue\.play\(/g) || []).length;
console.log(`替换前: ${beforeCount} 处 storyDialogue.play`);

// 替换：this.storyDialogue.play( → this.playStory(
content = content.replace(/this\.storyDialogue\.play\(/g, 'this.playStory(');

// 统计替换后数量（排除注释中的引用）
const afterCount = (content.match(/this\.storyDialogue\.play\(/g) || []).length;
console.log(`替换后: ${afterCount} 处 storyDialogue.play`);
console.log(`已替换: ${beforeCount - afterCount} 处`);

// 保存
fs.writeFileSync(FILE_PATH, content, 'utf8');

console.log('\n完成。接下来需手动移除前置 storyDialogue 创建代码。');