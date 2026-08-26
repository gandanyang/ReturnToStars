// Autotile-Studio 算法核心 —— 最小可运行验证入口
// 目的：在不装 Tauri/React、不碰 GUI 的前提下，直接调用其纯算法库，
// 生成 16 / 47 两套自动图块标准图集，返回 PNG dataURL 供 Node 侧落盘。
import { generateTileAsset } from "C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/asset-factory"
import { DUAL_GRID_16_ORDER, DUAL_GRID_16_COLUMNS } from "C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/quadrant-stitch"
import { BLOB_STANDARD_ORDER, BLOB_STANDARD_COLUMNS } from "C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/tile-mapping"
import { DEFAULT_GEN_PARAMS } from "C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/types"
import type { MappingType } from "C:/Users/Gdy/AppData/Local/Temp/autotile-studio/src/lib/types"

// 暴露给无头浏览器的执行入口（iife 打包后挂全局）
declare const globalThis: any

/** 按标准排版把 Map<mask, canvas> 拼成一张 PNG 图集，返回 dataURL */
function composeAtlas(
  tiles: Map<number, HTMLCanvasElement>,
  order: (number | null)[],
  columns: number,
  tileSize: number,
): string {
  const valid = order.filter((m): m is number => m !== null)
  const rows = Math.ceil(valid.length / columns)
  const c = document.createElement("canvas")
  c.width = columns * tileSize
  c.height = rows * tileSize
  const ctx = c.getContext("2d")
  if (ctx) {
    ctx.imageSmoothingEnabled = false
    valid.forEach((mask, idx) => {
      const t = tiles.get(mask)
      if (t) {
        ctx.drawImage(t, (idx % columns) * tileSize, Math.floor(idx / columns) * tileSize, tileSize, tileSize)
      }
    })
  }
  return c.toDataURL("image/png")
}

function gen(mappingType: MappingType, tileSize: number): { atlas: string; count: number; tileSize: number; type: MappingType } {
  const asset = generateTileAsset(mappingType, mappingType, tileSize, { ...DEFAULT_GEN_PARAMS })
  const order = mappingType === "16" ? (DUAL_GRID_16_ORDER as (number | null)[]) : (BLOB_STANDARD_ORDER as (number | null)[])
  const columns = mappingType === "16" ? DUAL_GRID_16_COLUMNS : BLOB_STANDARD_COLUMNS
  return {
    type: mappingType,
    tileSize,
    count: asset.tiles.size,
    atlas: composeAtlas(asset.tiles, order, columns, tileSize),
  }
}

globalThis.__ATAutotileProof = {
  gen16: (tileSize = 32) => gen("16", tileSize),
  gen47: (tileSize = 16) => gen("47", tileSize),
  gen,
}