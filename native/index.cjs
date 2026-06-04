const { createRequire } = require('node:module')
const { existsSync } = require('node:fs')
const path = require('node:path')
const require_ = createRequire(__filename)

const triples = [
  `${process.platform}-${process.arch}-gnu`,
  `${process.platform}-${process.arch}-musl`,
  `${process.platform}-${process.arch}-msvc`,
]

let binding
for (const triple of triples) {
  const p = path.join(__dirname, `wristworks-core.${triple}.node`)
  if (existsSync(p)) {
    binding = require_(p)
    break
  }
}

if (!binding) {
  throw new Error(
    `wristworks-core: no native binding found for ${process.platform}-${process.arch}. ` +
    'Try: npx napi build --manifest-path native/Cargo.toml --platform --release'
  )
}

module.exports = binding
