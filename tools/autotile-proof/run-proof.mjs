#!/usr/bin/env node
/**
 * Autotile-Studio 最小可运行验证（B2：无头浏览器执行核心算法）
 *
 * 流程：esbuild 把 tools/autotile-proof/entry.ts（引用了临时克隆的算法库）
 * 打包成单个 iife JS → puppeteer-core 打开空白页注入 → 调用 __ATAutotileProof
 * 生成 16 / 47 图集 → dataURL 回传 Node 落盘 PNG → 打印摘要并校验 PNG 头。
 */
import { build } from "esbuild"
import puppeteer from "puppeteer-core"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE)
const ENTRY = path.join(HERE, "entry.ts")
const OUT_JS = path.join(HERE, "atlas.iife.js")
const OUT_DIR = "C:/Users/Gdy/AppData/Local/Temp/autotile-proof/out"

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // 1) 打包算法入口
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: OUT_JS,
    logLevel: "warning",
    alias: { nanoid: path.join(HERE, "nanoid-shim.ts") },
  })
  console.log("✓ esbuild 打包完成:", OUT_JS)

  // 2) 无头浏览器执行
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
  })
  const page = await browser.newPage()
  page.on("console", (m) => console.log("[page]", m.text()))
  await page.goto("about:blank")
  await page.addScriptTag({ path: OUT_JS })

  const results = await page.evaluate(() => {
    const p = globalThis.__ATAutotileProof
    const r = {}
    for (const key of ["gen16", "gen47"]) {
      const out = p[key]()
      r[key] = {
        type: out.type,
        tileSize: out.tileSize,
        count: out.count,
        dataUrl: out.atlas,
      }
    }
    return r
  })

  await browser.close()

  // 3) 校验 + 落盘
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const summary = []
  for (const [key, res] of Object.entries(results)) {
    const b64 = res.dataUrl.replace(/^data:image\/png;base64,/, "")
    const buf = Buffer.from(b64, "base64")
    const pngOk = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    const w = (buf.readUInt32BE(16))
    const h = (buf.readUInt32BE(20))
    const fname = `atlas-${key}-tile${res.tileSize}.png`
    fs.writeFileSync(path.join(OUT_DIR, fname), buf)
    summary.push({ key, type: res.type, tileSize: res.tileSize, count: res.count, pngOk, w, h, fname })
  }

  console.log("\n========== 结果摘要 ==========")
  for (const s of summary) {
    console.log(`  ${s.fname}: PNG=${s.pngOk ? "OK" : "NO"}  ${s.w}x${s.h}  tiles=${s.count}  ${s.type}`)
  }
  console.log("输出目录:", OUT_DIR)
}

main().catch((e) => {
  console.error("出错:", e.message)
  process.exit(1)
})