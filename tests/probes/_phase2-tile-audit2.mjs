/**
 * _phase2-tile-audit2.mjs — 施工辅助工具（非探针）：输出补瓦片落点细节
 * 用法：node tests/probes/_phase2-tile-audit2.mjs
 */
import { readFileSync } from 'fs';

const MAP = 'public/assets/maps/town.json';
const m = JSON.parse(readFileSync(MAP, 'utf-8'));
const W = m.width, H = m.height;
const ground = m.layers.find((l) => l.name === 'Ground').data;
const walls = m.layers.find((l) => l.name === 'Walls').data;
const idx = (c, r) => r * W + c;
const name = { 1: 'G草', 2: 'G荒', 6: 'G板', 7: 'G路', 4: 'W水', 8: 'W丛', 9: 'W顶', 10: 'W墙', 11: 'W门', 12: 'W窗', 13: 'W井', 14: 'W栏', 15: 'W饰', 16: 'W树' };

console.log('===== S5 农田区域 (x40-49,y12-31) 非荒地坐标 =====');
for (let r = 12; r <= 31; r++) {
  const row = [];
  for (let c = 40; c <= 49; c++) {
    const g = ground[idx(c, r)], w = walls[idx(c, r)];
    if (g !== 2 || w) row.push(`(${c},${r})${name[g] || 'G?'}${w ? '+' + (name[w] || 'W?') : ''}`);
  }
  if (row.length) console.log('  y' + r + ':', row.join(' '));
}

console.log('\n===== S8 果林区域 (x40-49,y2-11) 非草地坐标 =====');
for (let r = 2; r <= 11; r++) {
  const row = [];
  for (let c = 40; c <= 49; c++) {
    const g = ground[idx(c, r)], w = walls[idx(c, r)];
    if (g !== 1 || w) row.push(`(${c},${r})${name[g] || 'G?'}${w ? '+' + (name[w] || 'W?') : ''}`);
  }
  if (row.length) console.log('  y' + r + ':', row.join(' '));
}

console.log('\n===== S6 河堤岸线 (x5-7, y6-28) =====');
for (let r = 6; r <= 28; r++) {
  const row = [];
  for (let c = 5; c <= 7; c++) {
    const g = ground[idx(c, r)], w = walls[idx(c, r)];
    row.push(`(${c},${r})${name[g] || 'G?'}${w ? '+' + (name[w] || 'W?') : ''}`);
  }
  console.log('  y' + r + ':', row.join(' '));
}

console.log('\n===== S6 左上角入口区 (x0-6, y0-5) =====');
for (let r = 0; r <= 5; r++) {
  const row = [];
  for (let c = 0; c <= 6; c++) {
    const g = ground[idx(c, r)], w = walls[idx(c, r)];
    row.push(`(${c},${r})${name[g] || 'G?'}${w ? '+' + (name[w] || 'W?') : ''}`);
  }
  console.log('  y' + r + ':', row.join(' '));
}

console.log('\n===== S2 老街地面细节 (x30-39,y2-7) + 上侧 (y0-1) =====');
for (let r = 0; r <= 7; r++) {
  const row = [];
  for (let c = 30; c <= 39; c++) {
    const g = ground[idx(c, r)], w = walls[idx(c, r)];
    row.push(`(${c},${r})${name[g] || 'G?'}${w ? '+' + (name[w] || 'W?') : ''}`);
  }
  console.log('  y' + r + ':', row.join(' '));
}

console.log('\n===== S4 院子内部 (x22-27,y29-33) 全清单 =====');
for (let r = 29; r <= 33; r++) {
  const row = [];
  for (let c = 22; c <= 27; c++) {
    const g = ground[idx(c, r)], w = walls[idx(c, r)];
    row.push(`(${c},${r})${name[g] || 'G?'}${w ? '+' + (name[w] || 'W?') : ''}`);
  }
  console.log('  y' + r + ':', row.join(' '));
}

console.log('\n===== S1 镇门 (x22-27,y26-29) 全清单 =====');
for (let r = 26; r <= 29; r++) {
  const row = [];
  for (let c = 22; c <= 27; c++) {
    const g = ground[idx(c, r)], w = walls[idx(c, r)];
    row.push(`(${c},${r})${name[g] || 'G?'}${w ? '+' + (name[w] || 'W?') : ''}`);
  }
  console.log('  y' + r + ':', row.join(' '));
}
