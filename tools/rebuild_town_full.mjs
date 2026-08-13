/**
 * 青禾镇 50×35 完整重排施工脚本（2026-08-13 制作人拍板：瓦片布局填满，整个地图做好）
 *
 * 布局规划（纵向空间叙事 + 横向功能分区）：
 *
 *  x0-5         x10-19        x20-31        x32-39        x40-49
 * y0-3   河岸树    老街屋A    老街屋B      老街屋C      果林
 * y4-7   河/桥    集市区(西)   广场     集市区(东)    果林
 * y8-11  河       民居        竖路         民居          田地
 * y12-19 河/岸    民居        中央横路      商店+民居     田地
 * y20-27 河       民居        竖路         民居+井       田地
 * y28-31 河/桥    空地        老屋(宅基地)  空地          田地
 * y32-34 河岸     (预留)      (南出口)     (预留)
 *
 * 关键：内容平移后的现有结构（四民居+竖路+横路+商店+需求板+NPC 站位）全部保留，
 * 在此基础上把四周空白真正排满：老街、果林、田地、河岸装饰、空地围合。
 */
import { readFileSync, writeFileSync } from 'fs';

const SRC = 'public/assets/maps/town.json';
const d = JSON.parse(readFileSync(SRC, 'utf-8'));
const W = d.width, H = d.height;
const g = d.layers[0].data; // Ground
const w = d.layers[1].data; // Walls

const setG = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y * W + x] = v; };
const setW = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) w[y * W + x] = v; };
const getW = (x, y) => (x >= 0 && x < W && y >= 0 && y < H) ? w[y * W + x] : -1;

// 工具：矩形铺 Ground/Walls（skip 保护：不覆盖既有非草地瓦片，除非 force）
function fillG(x0, x1, y0, y1, v, opts = {}) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (opts.force || g[y * W + x] === 1) setG(x, y, v);
  }
}
function fillW(x0, x1, y0, y1, v, opts = {}) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (opts.force || w[y * W + x] === 0) setW(x, y, v);
  }
}

// ============ 一、西区：河 + 岸线 + 树（x0-5 已有水，补岸线/桥/树） ============
// 河 x0-4 已铺水；补 x5 岸线（草地）与河岸树
for (let y = 6; y <= 28; y++) {
  setW(0, y, 4); setW(1, y, 4); setW(2, y, 4); setW(3, y, 4); setW(4, y, 4);
}
// 河岸树（x5 岸上、x6 岸内点缀）
const riverside = [[5, 9], [5, 16], [5, 24], [6, 12], [6, 20], [7, 7], [7, 26]];
for (const [x, y] of riverside) if (getW(x, y) === 0 && g[y * W + x] === 1) setW(x, y, 16);

// ============ 二、北区：老街成排屋（三栋，屋顶连排）+ 广场 ============
// 老街屋 A（x11-16, y2-5）—— 已建，保留
// 老街屋 B 西移对齐（x18-23, y2-5）：位于广场西侧
fillG(18, 23, 2, 5, 6);
for (let x = 18; x <= 23; x++) { setW(x, 2, 9); setW(x, 3, 9); setW(x, 4, 10); setW(x, 5, 10); }
setW(20, 5, 11); setW(22, 2, 0); // 门 + 屋顶缺角（破败）
// 老街屋 C（x33-38, y2-5）：广场东侧（原 B 位置改 C）
fillG(33, 38, 2, 5, 6);
for (let x = 33; x <= 38; x++) { setW(x, 2, 9); setW(x, 3, 9); setW(x, 4, 10); setW(x, 5, 10); }
setW(35, 5, 11); setW(37, 2, 0);
// 广场（x20-31, y2-7 已有，扩展 x18-33）
fillG(18, 33, 2, 7, 6, { force: false });

// ============ 三、东区：果林 + 田地（x40-49） ============
// 果林（y2-11）：树阵 + 草地
fillG(40, 49, 2, 11, 1);
const orchard = [];
for (let y = 3; y <= 10; y += 2) for (let x = 41; x <= 48; x += 3) orchard.push([x, y]);
for (const [x, y] of orchard) if (getW(x, y) === 0) setW(x, y, 16);
// 田地（y12-31）：gid2 荒地做田垄 + 少量作物点缀（gid8 矮树/作物）
fillG(40, 49, 12, 31, 2);
const crops = [[41, 14], [44, 14], [47, 14], [42, 17], [45, 17], [48, 17], [41, 20], [44, 20], [47, 20], [42, 23], [45, 23], [48, 23], [41, 26], [44, 26], [47, 26], [42, 29], [45, 29]];
for (const [x, y] of crops) if (getW(x, y) === 0) setW(x, y, 8);

// ============ 四、南区：老屋宅基地 + 空地围合（y28-34） ============
// 老屋宅基地（x22-27, y29-33 已有残垣）——保留，清掉内部误置
for (let y = 29; y <= 33; y++) for (let x = 22; x <= 27; x++) {
  if (getW(x, y) === 10 && !(y === 29 && (x === 24 || x === 25))) setW(x, y, 0);
}
// 重建残垣：北墙（y29 x22-27，留门位 x24-25）+ 西墙残 + 东墙残
for (let x = 22; x <= 27; x++) if (x < 24 || x > 25) setW(x, 29, 10);
setW(22, 30, 10); setW(22, 31, 10); setW(22, 32, 10);
setW(27, 30, 10); setW(27, 31, 10); setW(27, 32, 10);
// 宅基地地面
fillG(22, 27, 29, 33, 6, { force: true });
// 南侧空地：树围合（x12-18, x30-38 空地，点缀树）
const southTrees = [[12, 30], [14, 32], [16, 30], [18, 33], [30, 30], [32, 32], [34, 30], [36, 33], [38, 31]];
for (const [x, y] of southTrees) if (getW(x, y) === 0 && g[y * W + x] === 1) setW(x, y, 16);

// ============ 五、道路网完善 ============
// 北区横向老街路（y1：连接老街屋与广场）
fillG(10, 39, 1, 1, 7);
// 东区横向路（y17-18 已通到 x44，补 y12 果园/田地分界路）
fillG(40, 49, 12, 12, 7);
// 南区横向路（y28：宅基地前）——已由竖路连接，补一条东西向
fillG(12, 38, 28, 28, 7);

writeFileSync(SRC, JSON.stringify(d));
console.log('完整重排施工完成');
console.log('验证: 水', w.filter(v => v === 4).length, '屋顶', w.filter(v => v === 9).length, '墙', w.filter(v => v === 10).length, '树', w.filter(v => v === 16).length, '作物', w.filter(v => v === 8).length);
