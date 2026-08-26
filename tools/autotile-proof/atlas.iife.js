"use strict";
(() => {
  // tools/autotile-proof/nanoid-shim.ts
  function nanoid(size = 8) {
    return Math.random().toString(36).slice(2, 2 + size);
  }

  // C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/tile-mapping.ts
  var MASK16_LIST = Array.from({ length: 16 }, (_, i) => i);
  function encodeBlob47(raw) {
    const { n, e, s, w } = raw;
    const ne = raw.ne && n && e;
    const se = raw.se && s && e;
    const sw = raw.sw && s && w;
    const nw = raw.nw && n && w;
    let mask = 0;
    if (n) mask |= 1;
    if (ne) mask |= 2;
    if (e) mask |= 4;
    if (se) mask |= 8;
    if (s) mask |= 16;
    if (sw) mask |= 32;
    if (w) mask |= 64;
    if (nw) mask |= 128;
    return mask;
  }
  function generateBlob47() {
    const entries = [];
    for (let m = 0; m < 256; m++) {
      const n = !!(m & 1);
      const ne = !!(m & 2);
      const e = !!(m & 4);
      const se = !!(m & 8);
      const s = !!(m & 16);
      const sw = !!(m & 32);
      const w = !!(m & 64);
      const nw = !!(m & 128);
      if (ne && !(n && e)) continue;
      if (se && !(s && e)) continue;
      if (sw && !(s && w)) continue;
      if (nw && !(n && w)) continue;
      entries.push({ mask: m, bits: { n, e, s, w, ne, se, sw, nw }, index: entries.length });
    }
    return entries;
  }
  var BLOB47 = generateBlob47();
  var BLOB47_BY_MASK = new Map(BLOB47.map((e) => [e.mask, e]));
  var BLOB_STANDARD_COLUMNS = 11;
  var BLOB_STANDARD_ORDER = [
    28,
    124,
    112,
    16,
    20,
    116,
    92,
    80,
    84,
    221,
    null,
    31,
    255,
    241,
    17,
    23,
    247,
    223,
    209,
    215,
    119,
    null,
    7,
    199,
    193,
    1,
    29,
    253,
    127,
    113,
    125,
    93,
    117,
    4,
    68,
    64,
    0,
    5,
    197,
    71,
    65,
    69,
    87,
    213,
    null,
    null,
    null,
    null,
    21,
    245,
    95,
    81,
    85,
    null,
    null
  ];

  // C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/prng.ts
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashSeed(...nums) {
    let h = 2166136261;
    for (const n of nums) {
      h ^= Math.floor(n);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/texture-generator.ts
  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const bigint = Number.parseInt(
      clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean,
      16
    );
    return [bigint >> 16 & 255, bigint >> 8 & 255, bigint & 255];
  }
  function lighten([r, g, b], amount) {
    return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount];
  }
  function darken([r, g, b], amount) {
    return [r * (1 - amount), g * (1 - amount), b * (1 - amount)];
  }
  function distanceToEdge(alpha, size) {
    const INF = size * size;
    const dist = new Int32Array(size * size).fill(INF);
    const idx = (x, y) => y * size + x;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = idx(x, y);
        if (alpha[i] === 0) {
          dist[i] = 0;
          continue;
        }
        let best = INF;
        if (x > 0) best = Math.min(best, dist[i - 1] + 1);
        if (y > 0) best = Math.min(best, dist[i - size] + 1);
        dist[i] = best;
      }
    }
    for (let y = size - 1; y >= 0; y--) {
      for (let x = size - 1; x >= 0; x--) {
        const i = idx(x, y);
        if (dist[i] === 0) continue;
        if (x < size - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
        if (y < size - 1) dist[i] = Math.min(dist[i], dist[i + size] + 1);
      }
    }
    return dist;
  }
  function renderTile(canvas, size, bits, params, maskKey, supportsDiagonals = true) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    const alpha = new Uint8ClampedArray(size * size).fill(255);
    const idx = (x, y) => y * size + x;
    const baseDepth = Math.max(1, Math.round(params.edgeThickness));
    const maxDepth = size;
    const amp = params.erosionStrength;
    function depthAt(offset, edgeLen, salt) {
      const stepped = offset;
      const r = mulberry32(hashSeed(params.seed, maskKey, salt, stepped))();
      const d = baseDepth + Math.round(r * amp * baseDepth * 3.2);
      return Math.max(0, Math.min(maxDepth, d));
    }
    if (!bits.n) for (let x = 0; x < size; x++) {
      const d = depthAt(x, size, 1);
      for (let y = 0; y < d; y++) alpha[idx(x, y)] = 0;
    }
    if (!bits.s) for (let x = 0; x < size; x++) {
      const d = depthAt(x, size, 2);
      for (let y = 0; y < d; y++) alpha[idx(x, size - 1 - y)] = 0;
    }
    if (!bits.w) for (let y = 0; y < size; y++) {
      const d = depthAt(y, size, 3);
      for (let x = 0; x < d; x++) alpha[idx(x, y)] = 0;
    }
    if (!bits.e) for (let y = 0; y < size; y++) {
      const d = depthAt(y, size, 4);
      for (let x = 0; x < d; x++) alpha[idx(size - 1 - x, y)] = 0;
    }
    function carveCorner(cx, cy, signX, signY, salt) {
      const baseRadius = baseDepth * 1.7;
      const span = Math.ceil(baseRadius) + 3;
      for (let y = 0; y < span; y++) {
        for (let x = 0; x < span; x++) {
          const px = cx + signX * x;
          const py = cy + signY * y;
          if (px < 0 || py < 0 || px >= size || py >= size) continue;
          const n = (mulberry32(hashSeed(params.seed, maskKey, salt, x, y))() - 0.5) * amp * baseDepth * 2.4;
          const r = baseRadius + n;
          const dist = Math.sqrt(x * x + y * y);
          if (dist < r) alpha[idx(px, py)] = 0;
        }
      }
    }
    if (supportsDiagonals) {
      if (bits.n && bits.e && !bits.ne) carveCorner(size - 1, 0, -1, 1, 10);
      if (bits.s && bits.e && !bits.se) carveCorner(size - 1, size - 1, -1, -1, 11);
      if (bits.s && bits.w && !bits.sw) carveCorner(0, size - 1, 1, -1, 12);
      if (bits.n && bits.w && !bits.nw) carveCorner(0, 0, 1, 1, 13);
    }
    colorizeAlpha(ctx, alpha, size, params);
  }
  function colorizeAlpha(ctx, alpha, size, params) {
    const img = ctx.createImageData(size, size);
    const rgb = hexToRgb(params.color);
    const hl = Math.max(0, Math.min(1, Number.isFinite(params.edgeHighlight) ? params.edgeHighlight : 0.5));
    const shadow = darken(rgb, 0.28 * hl);
    const rim = lighten(rgb, 0.4 * hl);
    const rimW = Math.max(1, Math.round(size / 14));
    const dist = hl > 0 ? distanceToEdge(alpha, size) : null;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const a = alpha[i];
        const o = i * 4;
        if (a === 0) {
          img.data[o + 3] = 0;
          continue;
        }
        let [r, g, b] = rgb;
        if (dist) {
          const d = dist[i];
          if (d <= rimW) {
            ;
            [r, g, b] = shadow;
          } else if (d <= rimW * 2) {
            ;
            [r, g, b] = rim;
          }
        }
        img.data[o] = Math.round(r);
        img.data[o + 1] = Math.round(g);
        img.data[o + 2] = Math.round(b);
        img.data[o + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/dual-grid.ts
  var DUAL_MASK_LIST = Array.from({ length: 16 }, (_, i) => i);
  function lighten2([r, g, b], amount) {
    return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount];
  }
  function darken2([r, g, b], amount) {
    return [r * (1 - amount), g * (1 - amount), b * (1 - amount)];
  }
  function renderDualTileArc(canvas, size, maskIndex, grassColor, dirtColor, erosionStrength = 0.55, edgeHighlight = 1, edgeThickness = 2, seed = 12345, diagConnect = true) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    if (maskIndex === 0) return;
    const grass = hexToRgb(grassColor);
    const hl = Math.max(0, Math.min(1, edgeHighlight));
    const rim = lighten2(grass, 0.4 * hl);
    const shadow = darken2(grass, 0.28 * hl);
    const img = ctx.createImageData(size, size);
    const R = size / 2;
    const tl = !!(maskIndex & 1);
    const tr = !!(maskIndex & 2);
    const bl = !!(maskIndex & 4);
    const br = !!(maskIndex & 8);
    const grassCount = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
    const CORNERS = [
      { on: tl, cx: 0, cy: 0 },
      { on: tr, cx: size, cy: 0 },
      { on: bl, cx: 0, cy: size },
      { on: br, cx: size, cy: size }
    ];
    const amp = Math.max(0, Math.min(1, erosionStrength));
    const edgeThick = Math.max(0.5, edgeThickness + Math.round(size / 12) * amp);
    const rimW = Math.max(1, Math.round(size / 14));
    const rng = mulberry32(hashSeed(seed, maskIndex, size));
    const isDiag = tl && br || tr && bl;
    const isAdjacent = grassCount === 2 && !isDiag;
    const ROUNDNESS = 0.48;
    function cornerDist(dx, dy) {
      const circle = Math.sqrt(dx * dx + dy * dy);
      const square = Math.max(Math.abs(dx), Math.abs(dy));
      return square * (1 - ROUNDNESS) + circle * ROUNDNESS;
    }
    function signedDist(x, y) {
      if (grassCount === 4) return R;
      if (grassCount === 1) {
        const gc = CORNERS.find((c) => c.on);
        return R - cornerDist(x - gc.cx, y - gc.cy);
      }
      if (grassCount === 2 && isAdjacent) {
        if (tl && tr) return R - y;
        if (bl && br) return y - R;
        if (tl && bl) return R - x;
        return x - R;
      }
      if (grassCount === 2 && isDiag && !diagConnect) {
        let best2 = -Infinity;
        for (const c of CORNERS) {
          if (c.on) {
            const d = R - cornerDist(x - c.cx, y - c.cy);
            if (d > best2) best2 = d;
          }
        }
        return best2;
      }
      let best = Infinity;
      for (const c of CORNERS) {
        if (c.on) continue;
        const d = cornerDist(x - c.cx, y - c.cy);
        const sd = d - R;
        if (sd < best) best = sd;
      }
      return best;
    }
    const alpha = new Uint8ClampedArray(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const baseSd = signedDist(px, py);
        let inside = baseSd > 0;
        if (Math.abs(baseSd) < edgeThick) {
          const n = (rng() - 0.5) * amp * edgeThick * 2;
          inside = baseSd + n > 0;
        }
        alpha[y * size + x] = inside ? 255 : 0;
      }
    }
    const dist = hl > 0 ? distanceToEdge(alpha, size) : null;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const o = i * 4;
        const a = alpha[i];
        if (a === 0) {
          img.data[o] = 0;
          img.data[o + 1] = 0;
          img.data[o + 2] = 0;
          img.data[o + 3] = 0;
          continue;
        }
        let [r, g, b] = grass;
        if (dist) {
          const d = dist[i];
          if (d <= rimW) {
            [r, g, b] = shadow;
          } else if (d <= rimW * 2) {
            [r, g, b] = rim;
          }
        }
        img.data[o] = Math.round(r);
        img.data[o + 1] = Math.round(g);
        img.data[o + 2] = Math.round(b);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/blob47-recipes.json
  var blob47_recipes_default = {
    version: 3,
    layout: "5x11-standard",
    recipes: {
      "0": {
        id: 0,
        mask: 0,
        category: "ISLAND",
        direction: "CENTER",
        template: "ISLAND_0",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 4,
              y: 4
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 16,
              y: 4
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: true
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: true,
            flipY: true
          }
        ]
      },
      "1": {
        id: 1,
        mask: 1,
        category: "END_POINT",
        direction: "S",
        template: "END_POINT_S",
        crop: {
          x: 8,
          y: 12
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 4,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 16
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: true
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: true,
            flipY: true
          }
        ]
      },
      "4": {
        id: 4,
        mask: 4,
        category: "END_POINT",
        direction: "W",
        template: "END_POINT_W",
        crop: {
          x: 4,
          y: 8
        },
        fragments: [
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 4
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 16
            },
            dest: {
              x: 16,
              y: 4
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: true
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          }
        ]
      },
      "5": {
        id: 5,
        mask: 5,
        category: "CORNER_END",
        direction: "SW",
        template: "CORNER_END_SW",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 4,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: true
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          }
        ]
      },
      "7": {
        id: 7,
        mask: 7,
        category: "OUTER_CORNER",
        direction: "BL",
        template: "OUTER_CORNER_BL",
        crop: {
          x: 4,
          y: 12
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: true
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          }
        ]
      },
      "16": {
        id: 16,
        mask: 5,
        category: "OUTER_CORNER",
        direction: "NE",
        template: "OUTER_CORNER_NE",
        crop: {
          x: 8,
          y: 4
        },
        fragments: [
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 16
            },
            dest: {
              x: 4,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 270,
            flipX: false,
            flipY: false
          }
        ]
      },
      "17": {
        id: 17,
        mask: 64,
        category: "MIXED",
        direction: "",
        template: "MIXED_FRAGMENT",
        crop: {
          x: 8,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 4,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 90,
            flipX: true,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 270,
            flipX: false,
            flipY: false
          }
        ]
      },
      "20": {
        id: 20,
        mask: 7,
        category: "OUTER_CORNER",
        direction: "NE",
        template: "OUTER_CORNER_NE",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 4,
              y: 4
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 4
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "21": {
        id: 21,
        mask: 21,
        category: "CROSS_T",
        direction: "W",
        template: "CROSS_T_W",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: -4
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "23": {
        id: 23,
        mask: 65,
        category: "OUTER_CORNER",
        direction: "NW",
        template: "OUTER_CORNER_NW",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 4,
              y: 4,
              w: 12,
              h: 16
            },
            dest: {
              x: 12,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "28": {
        id: 28,
        mask: 28,
        category: "OUTER_CORNER",
        direction: "NE",
        template: "OUTER_CORNER_NE",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "29": {
        id: 29,
        mask: 29,
        category: "CORNER_T",
        direction: "NW",
        template: "CORNER_T_NW",
        crop: {
          x: 4,
          y: 8
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: true
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          }
        ]
      },
      "31": {
        id: 31,
        mask: 31,
        category: "EDGE",
        direction: "LEFT",
        template: "EDGE_LEFT",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: true
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "64": {
        id: 64,
        mask: 64,
        category: "END_POINT",
        direction: "E",
        template: "END_POINT_E",
        crop: {
          x: 12,
          y: 8
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 4,
              y: 4
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 4
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: true,
            flipY: true
          }
        ]
      },
      "65": {
        id: 65,
        mask: 65,
        category: "CORNER_IN",
        direction: "SE",
        template: "CORNER_IN_SE",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 12,
              h: 12
            },
            dest: {
              x: 4,
              y: 4
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: true
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          }
        ]
      },
      "68": {
        id: 68,
        mask: 68,
        category: "PIPE",
        direction: "H",
        template: "PIPE_H",
        crop: {
          x: 4,
          y: 8
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 4
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 4
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: true,
            flipY: false
          }
        ]
      },
      "69": {
        id: 69,
        mask: 69,
        category: "EDGE_DOUBLE_IN",
        direction: "BOTTOM",
        template: "EDGE_DOUBLE_IN_B",
        crop: {
          x: 4,
          y: 8
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: -4,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 12,
              y: 16
            },
            rotation: 180,
            flipX: true,
            flipY: false
          }
        ]
      },
      "71": {
        id: 71,
        mask: 71,
        category: "EDGE_IN",
        direction: "BOTTOM_L",
        template: "EDGE_IN_BL",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: true,
            flipY: false
          }
        ]
      },
      "80": {
        id: 80,
        mask: 80,
        category: "OUTER_CORNER",
        direction: "SE",
        template: "OUTER_CORNER_SE",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 4,
              y: 4
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 12
            },
            dest: {
              x: 16,
              y: 4
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          }
        ]
      },
      "81": {
        id: 81,
        mask: 81,
        category: "EDGE_DOUBLE_IN",
        direction: "RIGHT",
        template: "EDGE_DOUBLE_IN_R",
        crop: {
          x: 8,
          y: 4
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: -4
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          }
        ]
      },
      "84": {
        id: 84,
        mask: 84,
        category: "EDGE_DOUBLE_IN",
        direction: "TOP",
        template: "EDGE_DOUBLE_IN_T",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "85": {
        id: 85,
        mask: 85,
        category: "CROSS",
        direction: "CENTER",
        template: "CROSS_85",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: -4
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: -4
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "87": {
        id: 87,
        mask: 87,
        category: "TRIPLE_IN",
        direction: "TL_TR_BR",
        template: "TRIPLE_IN_87",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: -4
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: -4
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 12,
              h: 12
            },
            dest: {
              x: 0,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "92": {
        id: 92,
        mask: 92,
        category: "EDGE_IN",
        direction: "TOP_L",
        template: "EDGE_IN_TL",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "93": {
        id: 93,
        mask: 93,
        category: "DOUBLE_DIAG_IN",
        direction: "TR_BL",
        template: "DOUBLE_DIAG_93",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 12,
              h: 12
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: -4
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "95": {
        id: 95,
        mask: 95,
        category: "DOUBLE_IN",
        direction: "TOP",
        template: "DOUBLE_IN_TOP",
        crop: {
          x: 4,
          y: 8
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 12,
              y: 4
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 12,
              y: 20
            },
            rotation: 90,
            flipX: false,
            flipY: false
          }
        ]
      },
      "112": {
        id: 112,
        mask: 4,
        category: "MIXED",
        direction: "",
        template: "MIXED_FRAGMENT",
        crop: {
          x: 12,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "113": {
        id: 113,
        mask: 113,
        category: "EDGE_IN",
        direction: "LEFT_B",
        template: "EDGE_IN_LB",
        crop: {
          x: 8,
          y: 4
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 0,
              w: 12,
              h: 16
            },
            dest: {
              x: 4,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 4,
              w: 16,
              h: 12
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: true
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          }
        ]
      },
      "116": {
        id: 116,
        mask: 116,
        category: "EDGE_IN",
        direction: "TOP_R",
        template: "EDGE_IN_TR",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "117": {
        id: 117,
        mask: 117,
        category: "TRIPLE_IN",
        direction: "TL_TR_BL",
        template: "TRIPLE_IN_117",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "119": {
        id: 119,
        mask: 119,
        category: "DOUBLE_DIAG_IN",
        direction: "TL_BR",
        template: "DOUBLE_DIAG_119",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 12,
              h: 12
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 12,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 12,
              h: 16
            },
            dest: {
              x: 0,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "124": {
        id: 124,
        mask: 1,
        category: "MIXED",
        direction: "",
        template: "MIXED_FRAGMENT",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: true,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "125": {
        id: 125,
        mask: 125,
        category: "DOUBLE_IN",
        direction: "LEFT",
        template: "DOUBLE_IN_LEFT",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "127": {
        id: 127,
        mask: 127,
        category: "SINGLE_IN",
        direction: "TL",
        template: "SINGLE_IN_TL",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "193": {
        id: 193,
        mask: 193,
        category: "OUTER_CORNER",
        direction: "BR",
        template: "OUTER_CORNER_BR",
        crop: {
          x: 12,
          y: 12
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 0,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: true,
            flipY: true
          }
        ]
      },
      "197": {
        id: 197,
        mask: 197,
        category: "EDGE_IN",
        direction: "BOTTOM_R",
        template: "EDGE_IN_BR",
        crop: {
          x: 4,
          y: 8
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: true,
            flipY: false
          }
        ]
      },
      "199": {
        id: 199,
        mask: 199,
        category: "EDGE",
        direction: "BOTTOM",
        template: "EDGE_BOTTOM",
        crop: {
          x: 4,
          y: 12
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 180,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 180,
            flipX: true,
            flipY: false
          }
        ]
      },
      "209": {
        id: 209,
        mask: 209,
        category: "EDGE_IN",
        direction: "RIGHT_T",
        template: "EDGE_IN_RT",
        crop: {
          x: 8,
          y: 4
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 12
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          }
        ]
      },
      "213": {
        id: 213,
        mask: 213,
        category: "TRIPLE_IN",
        direction: "TR_BL_BR",
        template: "TRIPLE_IN_213",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: -4
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "215": {
        id: 215,
        mask: 215,
        category: "DOUBLE_IN",
        direction: "BOTTOM",
        template: "DOUBLE_IN_BOTTOM",
        crop: {
          x: 4,
          y: 4
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: -4,
              y: 12
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 12,
              y: 12
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "221": {
        id: 221,
        mask: 221,
        category: "SINGLE_IN",
        direction: "TR",
        template: "SINGLE_IN_TR",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "223": {
        id: 223,
        mask: 223,
        category: "DOUBLE_IN",
        direction: "RIGHT",
        template: "DOUBLE_IN_RIGHT",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 12,
              h: 12
            },
            dest: {
              x: 4,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "241": {
        id: 241,
        mask: 241,
        category: "EDGE",
        direction: "RIGHT",
        template: "EDGE_RIGHT",
        crop: {
          x: 12,
          y: 4
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 90,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 4,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 90,
            flipX: false,
            flipY: false
          }
        ]
      },
      "245": {
        id: 245,
        mask: 245,
        category: "TRIPLE_IN",
        direction: "TL_BL_BR",
        template: "TRIPLE_IN_245",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "247": {
        id: 247,
        mask: 247,
        category: "SINGLE_IN",
        direction: "SW",
        template: "SINGLE_IN_SW",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      },
      "253": {
        id: 253,
        mask: 253,
        category: "SINGLE_IN",
        direction: "SE",
        template: "SINGLE_IN_SE",
        crop: {
          x: 8,
          y: 8
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 16
            },
            rotation: 0,
            flipX: false,
            flipY: false
          },
          {
            base: 3,
            source: {
              x: 4,
              y: 4,
              w: 16,
              h: 16
            },
            dest: {
              x: 16,
              y: 0
            },
            rotation: 270,
            flipX: false,
            flipY: false
          }
        ]
      },
      "255": {
        id: 255,
        mask: 255,
        category: "FULL",
        direction: "ALL",
        template: "FULL_ALL",
        crop: {
          x: 0,
          y: 0
        },
        fragments: [
          {
            base: 1,
            source: {
              x: 0,
              y: 0,
              w: 16,
              h: 16
            },
            dest: {
              x: 0,
              y: 0
            },
            rotation: 0,
            flipX: false,
            flipY: false
          }
        ]
      }
    }
  };

  // C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/quadrant-stitch.ts
  var BLOB47_RECIPES = blob47_recipes_default.recipes;
  var DUAL_GRID_16_ORDER = [
    0,
    1,
    6,
    8,
    2,
    5,
    11,
    3,
    9,
    7,
    15,
    14,
    4,
    12,
    13,
    10
  ];
  var DUAL_GRID_16_COLUMNS = 4;
  function bMaskToAMask(b) {
    let a = 0;
    if (b & 8) a |= 1;
    if (b & 4) a |= 2;
    if (b & 2) a |= 4;
    if (b & 1) a |= 8;
    return a;
  }

  // C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/asset-factory.ts
  function generateTileAsset(name, mappingType, tileSize, params) {
    const tiles = /* @__PURE__ */ new Map();
    if (mappingType === "16") {
      for (const mask of DUAL_MASK_LIST) {
        const canvas = document.createElement("canvas");
        renderDualTileArc(canvas, tileSize, bMaskToAMask(mask), params.color, "#8a6642", params.erosionStrength, params.edgeHighlight, params.edgeThickness, params.seed);
        tiles.set(mask, canvas);
      }
    } else {
      for (const entry of BLOB47) {
        const canvas = document.createElement("canvas");
        renderTile(canvas, tileSize, entry.bits, params, entry.mask, true);
        tiles.set(entry.mask, canvas);
      }
    }
    const fullMask = mappingType === "16" ? 15 : encodeBlob47({ n: true, ne: true, e: true, se: true, s: true, sw: true, w: true, nw: true });
    const thumbCanvas = tiles.get(fullMask) ?? tiles.values().next().value;
    const thumbnail = thumbCanvas.toDataURL("image/png");
    return {
      id: nanoid(8),
      name,
      kind: "autotile",
      mappingType,
      tileSize,
      params: { ...params },
      tiles,
      thumbnail,
      createdAt: Date.now()
    };
  }

  // C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/types.ts
  var DEFAULT_GEN_PARAMS = {
    color: "#6fae4a",
    erosionStrength: 0.5,
    edgeThickness: 2,
    edgeHighlight: 0.5,
    seed: 12345
  };

  // tools/autotile-proof/entry.ts
  function composeAtlas(tiles, order, columns, tileSize) {
    const valid = order.filter((m) => m !== null);
    const rows = Math.ceil(valid.length / columns);
    const c = document.createElement("canvas");
    c.width = columns * tileSize;
    c.height = rows * tileSize;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      valid.forEach((mask, idx) => {
        const t = tiles.get(mask);
        if (t) {
          ctx.drawImage(t, idx % columns * tileSize, Math.floor(idx / columns) * tileSize, tileSize, tileSize);
        }
      });
    }
    return c.toDataURL("image/png");
  }
  function gen(mappingType, tileSize) {
    const asset = generateTileAsset(mappingType, mappingType, tileSize, { ...DEFAULT_GEN_PARAMS });
    const order = mappingType === "16" ? DUAL_GRID_16_ORDER : BLOB_STANDARD_ORDER;
    const columns = mappingType === "16" ? DUAL_GRID_16_COLUMNS : BLOB_STANDARD_COLUMNS;
    return {
      type: mappingType,
      tileSize,
      count: asset.tiles.size,
      atlas: composeAtlas(asset.tiles, order, columns, tileSize)
    };
  }
  globalThis.__ATAutotileProof = {
    gen16: (tileSize = 32) => gen("16", tileSize),
    gen47: (tileSize = 16) => gen("47", tileSize),
    gen
  };
})();
