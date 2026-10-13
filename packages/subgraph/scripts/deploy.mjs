import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function deploy(network, env = process.env, spawn = spawnSync) {
  if (network !== 'chiliz') {
    throw new Error(
      'Only chiliz is hosted on Goldsky; Spicy deployment is documented only',
    )
  }
  const { SUBGRAPH_NAME: name, VERSION: version, GOLDSKY_API_KEY: key } = env
  for (const value of [name, version]) {
    if (!value || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value)) {
      throw new Error(
        'Set SUBGRAPH_NAME and VERSION to valid deployment identifiers',
      )
    }
  }
  if (!key) throw new Error('GOLDSKY_API_KEY is required')

  for (const args of [
    ['login', '--token', key],
    ['subgraph', 'deploy', `${name}/${version}`, '--path', './build'],
  ]) {
    const result = spawn('goldsky', args, { stdio: 'ignore' })
    if (result.error || result.status !== 0) {
      throw new Error('Goldsky command failed; inspect the provider privately')
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  deploy(process.argv[2])
}
