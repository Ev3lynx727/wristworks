import { Wristworks } from './src/index.js'

const ww = new Wristworks({ configPath: './wristworks.yaml' })
const out = await ww.run()

console.log('Locations with currency:')
let enriched = 0
for (const loc of out.locations) {
  const cur = loc.currency
  if (cur) {
    console.log(`  ${loc.label.padEnd(12)} ${loc.datetime.slice(11, 16)} ${loc.countryCode} -> ${cur.code} ${cur.rate.toFixed(4)}`)
    enriched++
  } else {
    console.log(`  ${loc.label.padEnd(12)} ${loc.datetime.slice(11, 16)} ${loc.countryCode} -> no currency`)
  }
}
console.log(`\nEnriched ${enriched}/${out.locations.length} locations with currency rates`)
