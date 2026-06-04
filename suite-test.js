import { ask } from './src/core/agent.js'

const queries = [
  ['Timezone comparison', 'what time is it in London and Moscow?'],
  ['Currency conversion', '100 USD to JPY'],
  ['Server geolocation', 'where is x.com hosted?'],
  ['Timezone math', 'if its 9am in new york what time in jakarta?'],
  ['Offset diff', 'how many hours ahead is singapore from london?'],
]

let passed = 0
let failed = 0

for (const [label, prompt] of queries) {
  process.stdout.write(`  ${label}... `)
  try {
    const result = await ask(prompt)
    if (result.answer && result.steps.length > 0) {
      console.log(`OK  (${result.steps.length} tool(s), model=${result.model})`)
      passed++
    } else {
      console.log(`WARN  (no tools used)`)
      failed++
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`FAIL  ${msg}`)
    failed++
  }
}

console.log(`\n  Results: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
