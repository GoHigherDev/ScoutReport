import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = new URL('../', import.meta.url)

export function predictionsNetwork(record) {
  if (record?.chainId !== 88882 ||
      !Object.hasOwn(record.contracts ?? {}, 'ScoutReportPredictions')) {
    throw new Error('A Spicy predictions deployment record is required')
  }
  const entry = record.contracts.ScoutReportPredictions
  if (entry === null) return null
  if (!/^0x[0-9a-fA-F]{40}$/.test(entry?.address ?? '') ||
      /^0x0{40}$/i.test(entry.address) ||
      !Number.isSafeInteger(entry.deployBlock) || entry.deployBlock <= 0) {
    throw new Error('Invalid predictions address or deployment block')
  }
  return { address: entry.address, startBlock: entry.deployBlock }
}

export function testnetManifest(template, entry) {
  return template
    .replace('network: chiliz', 'network: chiliz-testnet')
    .replace('abi: ScoutReportPredictions',
      `abi: ScoutReportPredictions\n      address: "${entry.address}"\n      startBlock: ${entry.startBlock}`)
}

export function generate(directory = root) {
  const record = JSON.parse(readFileSync(new URL('../contracts/deployments/88882.json', directory)))
  const entry = predictionsNetwork(record)
  writeFileSync(new URL('predictions/networks.json', directory), JSON.stringify({
    chiliz: {},
    'chiliz-testnet': entry ? { ScoutReportPredictions: entry } : {},
  }, null, 2) + '\n')
  const output = new URL('predictions/subgraph.testnet.yaml', directory)
  if (entry) {
    writeFileSync(output, testnetManifest(
      readFileSync(new URL('predictions/subgraph.yaml', directory), 'utf8'), entry))
  } else {
    rmSync(output, { force: true })
    console.log('Skipping predictions chiliz-testnet manifest: ScoutReportPredictions is not deployed in deployments/88882.json.')
  }
  return entry
}

function graph(args, cwd = root) {
  const result = spawnSync('graph', args, {
    cwd: fileURLToPath(cwd), stdio: 'inherit',
  })
  if (result.error || result.status !== 0) throw new Error('Predictions Graph command failed')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] ?? 'generate'
  if (!['generate', 'codegen', 'build', 'test'].includes(mode)) {
    throw new Error('Usage: predictions.mjs [generate|codegen|build|test]')
  }
  const entry = generate()
  if (mode !== 'generate') {
    graph(['codegen', 'predictions/subgraph.yaml', '--output-dir', 'predictions/generated'])
  }
  if (mode === 'build' && entry) {
    graph(['build', 'predictions/subgraph.testnet.yaml', '--output-dir', 'build/predictions-testnet'])
  }
  if (mode === 'test') graph(['test', '--version', '0.6.0'], new URL('predictions/', root))
}
