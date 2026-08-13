/**
 * _phase2-tile-audit.mjs — 施工辅助工具（非探针）：审计 town.json 各舞台块瓦片现状
 * 用法：node tests/probes/_phase2-tile-audit.mjs
 */
import { readFileSync } from 'fs';

const MAP = 'public/assets/maps/town.json';
const m = JSON.parse(readFileSync(MAP, 'utf-8'));
const W = m.width, H = m.height;
const ground = m.layers.find((l) => l.name === 'Ground').data;
const walls = m.layers.find((l) => l.name === 'Walls').data;
const idx = (c, r) => r * W + c;
const gidName = {
  1: '草地', 2: '荒地', 3: '石墙', 4: '水', 5: '深木', 6: '石板/木埂', 7: '路',
  8: '树丛/作物', 9: '屋顶', 10: '墙面', 11: '门', 12: '窗', 13: '井/石', 14: '栅栏', 15: '装饰', 16: '树',
};

const blocks = {
  S1_镇门: [22, 27, 26, 29],
  S2_老街: [30, 39, 2, 7],
  S3_广场: [20, 29, 8, 27],
  S4_旧宅: [22, 27, 29, 33],
  S5_农田: [40, 49, 12, 31],
  S6_河堤: [0, 4, 6, 28],
  S7_集市: [18, 33, 2, 7],
  S8_果林: [40, 49, 2, 11],
};

for (const [name, [x0, x1, y0, y1]] of Object.entries(blocks)) {
  console.log(`\n===== ${name} (x${x0}-${x1}, y${y0}-${y1}) =====`);
  const gStat = {}, wStat = {};
  for (let r = y0; r <= y1; r++) {
    for (let c = x0; c <= x1; c++) {
      const g = ground[idx(c, r)], w = walls[idx(c, r)];
      gStat[g] = (gStat[g] || 0) + 1;
      if (w) wStat[w] = (wStat[w] || 0) + 1;
    }
  }
  const fmt = (s) => Object.entries(s).map(([k, v]) => `${gidName[k] || '空'}(gid${k})×${v}`).join('  ');
  console.log('Ground:', fmt(gStat) || '（全空）');
  console.log('Walls :', fmt(wStat) || '（全空）');
  // 详细坐标清单（仅 Walls 非零 + Ground 特殊瓦片）
  const detail = [];
  for (let r = y0; r <= y1; r++) {
    for (let c = x0; c <= x1; c++) {
      const w = walls[idx(c, r)];
      if (w && ![8, 16].includes(w)) detail.push(`(x${c},y${r})${gidName[w]}[${w}]`);
    }
  }
  if (detail.length) console.log('  关键 Walls:', detail.join(' '));
}
