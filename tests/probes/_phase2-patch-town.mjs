/**
 * _phase2-patch-town.mjs — 施工辅助工具（非探针）：按拍板基线 §六 补 Phase 2 衰败态瓦片
 * 仅修改 town.json 两层 data（长度不变 = 零 GID 漂移），不动尺寸/层数/tileset 引用。
 * 规则：
 *   Ground 木埂：仅允许 荒地(gid2)→木埂(gid6)，其它非目标格跳过（不覆盖）
 *   Walls 装饰：仅允许 0→gid8/gid16，其它非 0 跳过（不覆盖）
 * 用法：node tests/probes/_phase2-patch-town.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const MAP = 'public/assets/maps/town.json';
const m = JSON.parse(readFileSync(MAP, 'utf-8'));
const W = m.width, H = m.height;
const g = m.layers.find((l) => l.name === 'Ground').data;
const w = m.layers.find((l) => l.name === 'Walls').data;
const idx = (c, r) => r * W + c;
if (g.length !== W * H || w.length !== W * H) throw new Error(`data length mismatch G=${g.length} W=${w.length} expect=${W * H}`);

// ---- Ground：S5 农田木埂（gid6 横线，避开路 y12/y17/y18）----
const groundPatch = [];
for (const r of [14, 16, 20, 23, 26, 29]) {
  for (let c = 41; c <= 48; c++) groundPatch.push({ c, r, gid: 6 });
}

// ---- Walls：零散作物(gid8) + 树(gid16) ----
const s5Crops = [[42,13],[47,15],[43,19],[46,21],[41,24],[48,25],[44,27],[45,30]]; // S5 零散作物
const s6Grass = [[5,8],[5,11],[5,14],[5,20],[5,23],[5,26]];                        // S6 岸线草丛（首批）
// S6 岸线补密（2026-08-13 第二轮）：x5 列沿岸 + x6 列点缀，避开路 y17-18 与已有格
const s6Grass2 = [[5,6],[5,7],[5,9],[5,12],[5,13],[5,15],[5,19],[5,21],[5,24],[5,25],[5,28],
                  [6,9],[6,13],[6,19],[6,24]];
const s4Weeds = [[23,30],[26,30],[26,31],[23,32],[26,32]];                         // S4 院内荒草
const s4Weeds2 = [[23,33],[26,33]];                                                // S4 院门口墙根乱草（截图可见）
const s2Weeds = [[38,2],[37,6],[39,6],[38,7]];                                     // S2 路边杂草
const s8Trees = [[41,3],[44,3],[47,3],[40,6],[43,6],[46,6],[49,6],[42,9],[45,9],[48,9],[44,11]]; // S8 果林树阵
const s6Trees = [[6,10],[7,16],[6,22],[7,27]];                                     // S6 稀疏树
const s6Trees2 = [[6,28]];                                                         // S6 岸线转角树

const wallPatch = [];
for (const [c, r] of [...s5Crops, ...s6Grass, ...s6Grass2, ...s4Weeds, ...s4Weeds2, ...s2Weeds]) wallPatch.push({ c, r, gid: 8 });
for (const [c, r] of [...s8Trees, ...s6Trees, ...s6Trees2]) wallPatch.push({ c, r, gid: 16 });

let skipped = 0;
for (const { c, r, gid } of groundPatch) {
  const cur = g[idx(c, r)];
  if (cur !== 2) { console.log('skip Ground', c, r, 'cur=' + cur); skipped++; continue; }
  g[idx(c, r)] = gid;
}
for (const { c, r, gid } of wallPatch) {
  const cur = w[idx(c, r)];
  if (cur !== 0) { console.log('skip Walls', c, r, 'cur=' + cur); skipped++; continue; }
  w[idx(c, r)] = gid;
}

// ---- 校验：Ground 无 gid=0、长度不变 ----
const zeros = [];
g.forEach((v, i) => { if (v === 0) zeros.push(i); });
if (zeros.length) throw new Error('Ground gid=0 at ' + zeros.slice(0, 5).join(','));
if (g.length !== W * H || w.length !== W * H) throw new Error('length changed!');

writeFileSync(MAP, JSON.stringify(m));
console.log('patched ok. ground=' + groundPatch.length + ' walls=' + wallPatch.length + ' skipped=' + skipped);
