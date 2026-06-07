#!/usr/bin/env node
/**
 * Build client + server, copy dist into the running hermes-webui container, and restart.
 * Use while Docker Compose is up for fast local iteration without a full image rebuild.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skipBuild = process.argv.includes('--skip-build')
const container = process.env.WEBUI_CONTAINER_NAME || 'hermes-webui'
const workerContainer = process.env.PRESALES_WORKER_CONTAINER_NAME || 'hermes-presales-worker'
const port = process.env.PORT || '6060'
const healthUrl = `http://127.0.0.1:${port}/health`

function run(cmd, args) {
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })
}

function containerRunning(name) {
  try {
    const out = execFileSync('docker', ['inspect', '-f', '{{.State.Running}}', name], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return out === 'true'
  } catch {
    return false
  }
}

function requireDist() {
  for (const file of ['dist/client/index.html', 'dist/server/index.js']) {
    if (!existsSync(resolve(root, file))) {
      console.error(`Missing ${file}. Run npm run build first.`)
      process.exit(1)
    }
  }
}

async function waitForHealth(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs
  process.stdout.write(`Waiting for ${healthUrl}`)
  while (Date.now() < deadline) {
    try {
      execFileSync('curl', ['-fsS', healthUrl], { stdio: 'ignore' })
      process.stdout.write('\n')
      return
    } catch {
      process.stdout.write('.')
      await delay(2000)
    }
  }
  process.stdout.write('\n')
  console.error(`Timed out waiting for ${healthUrl}`)
  process.exit(1)
}

if (!skipBuild) {
  run('npm', ['run', 'build'])
}

requireDist()

if (!containerRunning(container)) {
  console.error(`Container "${container}" is not running. Start with: npm run docker:up`)
  process.exit(1)
}

console.log(`Copying dist into ${container}...`)
run('docker', ['cp', 'dist/client/.', `${container}:/app/dist/client/`])
run('docker', ['cp', 'dist/server/index.js', `${container}:/app/dist/server/index.js`])

const workerBundle = resolve(root, 'dist/server/workers/presales-knowledge-worker.js')
if (existsSync(workerBundle) && containerRunning(workerContainer)) {
  console.log(`Restarting ${workerContainer} (bind-mounted worker bundle)...`)
  try {
    run('docker', ['compose', 'up', '-d', 'presales-worker'])
  } catch {
    console.warn('Warning: presales-worker restart failed; run: docker compose up -d presales-worker')
  }
}

console.log('Restarting hermes-webui...')
run('docker', ['compose', 'restart', 'hermes-webui'])

await waitForHealth()
console.log('Hot deploy complete.')
