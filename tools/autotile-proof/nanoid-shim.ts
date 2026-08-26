// nanoid shim —— 仅用于让 asset-factory 的 nanoid(8)（资产 id）可打包；
// 本验证只取 tiles，id 无关紧要。
export function nanoid(size = 8): string {
  return Math.random().toString(36).slice(2, 2 + size)
}