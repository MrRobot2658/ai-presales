import { afterEach, describe, expect, it, vi } from 'vitest'

const readFileSyncMock = vi.fn()
const existsSyncMock = vi.fn()

vi.mock('fs', async importOriginal => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
  }
})

vi.mock('../../packages/server/src/services/hermes/hermes-path', () => ({
  detectHermesHome: () => 'C:/Users/test/.hermes',
  getHermesBin: () => 'hermes'
}))

describe('GatewayManager diagnostics', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('includes read-only diagnostics when a profile is stopped', async () => {
    const yamlText = [
      'platforms:',
      '  api_server:',
      '    extra:',
      '      host: 127.0.0.1',
      '      port: 8643',
    ].join('\n')

    existsSyncMock.mockImplementation((input: unknown) => {
      const text = String(input)
      return text.endsWith('config.yaml')
    })
    readFileSyncMock.mockImplementation((input: unknown) => {
      const text = String(input)
      if (text.endsWith('config.yaml')) {
        return yamlText
      }
      return ''
    })

    const { GatewayManager } = await import('../../packages/server/src/services/hermes/gateway-manager')
    const manager = new GatewayManager('default')
    const status = await manager.detectStatus('default')

    expect(status.running).toBe(false)
    expect(status.diagnostics?.config_exists).toBe(true)
    expect(status.diagnostics?.pid_file_exists).toBe(false)
    expect(status.diagnostics?.reason).toBe('missing pid file')
    expect(status.diagnostics?.health_url).toContain('/health')
  })

  it('prefers GATEWAY_HOST over profile config and registers remote gateways via health check', async () => {
    process.env.GATEWAY_HOST = 'hermes-agent'
    const yamlText = [
      'platforms:',
      '  api_server:',
      '    extra:',
      '      host: 127.0.0.1',
      '      port: 8642',
    ].join('\n')

    existsSyncMock.mockImplementation((input: unknown) => {
      const text = String(input)
      return text.endsWith('config.yaml')
    })
    readFileSyncMock.mockImplementation((input: unknown) => {
      const text = String(input)
      if (text.endsWith('config.yaml')) {
        return yamlText
      }
      return ''
    })

    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const { GatewayManager } = await import('../../packages/server/src/services/hermes/gateway-manager')
    const manager = new GatewayManager('default')
    const status = await manager.detectStatus('default')

    expect(status.host).toBe('hermes-agent')
    expect(status.url).toBe('http://hermes-agent:8642')
    expect(status.running).toBe(true)
    expect(status.diagnostics?.reason).toBe('remote gateway health check passed')
    expect(fetchMock).toHaveBeenCalledWith('http://hermes-agent:8642/health', expect.any(Object))

    delete process.env.GATEWAY_HOST
    vi.unstubAllGlobals()
  })
})
