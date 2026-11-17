/** Built Desktop Host acceptance; run after the repository build, without provider credentials. */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopHostProcess } from '../src/host-process.ts'
import { connectDesktopWelcome, type DesktopWelcomeBackend } from '../src/welcome-backend.ts'
import { builtHost, prepareDesktopHome } from './harness.ts'

afterEach(() => { vi.unstubAllEnvs() })

describe.skipIf(!existsSync(builtHost))('built Desktop welcome flow', () => {
  it('persists explicit API keys across Host restarts', async () => {
    vi.stubEnv('DSH_CLIENT_VERSION', '1.2.3')
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-welcome-'))
    let host: DesktopHostProcess | undefined
    try {
      const { home, project, paths } = await prepareDesktopHome(root)
      const nodeBin = join(root, 'runtime/primary-runtime/dependencies/node/bin')
      mkdirSync(nodeBin, { recursive: true })
      cpSync(process.execPath, join(nodeBin, process.platform === 'win32' ? 'node.exe' : 'node'))
      writeFileSync(join(paths.profile, 'cordis.patch.yml'), '- id: webserver\n  config:\n    host: 127.0.0.1\n    port: 0\n')
      let backend: DesktopWelcomeBackend
      const restart = async (): Promise<void> => {
        await host?.stop()
        host = new DesktopHostProcess(process.execPath, project, paths.profile, undefined,
          process.env, undefined, join(root, 'runtime', 'primary-runtime'))
        const { url, authenticationCookie } = await host.start()
        backend = connectDesktopWelcome(url, authenticationCookie)
      }
      const status = async () => backend.read()
      await restart()
      expect(await status()).toMatchObject({ hasApiKey: false })
      await backend!.save('sk-synthetic-key')
      expect(await status()).toMatchObject({ hasApiKey: true })
      const keyPath = join(home, 'storage/settings.json')
      const saved = JSON.parse(readFileSync(keyPath, 'utf8')) as { credentials: Record<string, string>; locale?: { preference: string } }
      expect(saved.credentials['llm-deepseek-api-key']).toBe('sk-synthetic-key')
      saved.locale = { preference: 'zh' }
      writeFileSync(keyPath, JSON.stringify(saved))
      expect(await status()).toMatchObject({ hasApiKey: true, localePreference: 'zh' })
      await restart()
      expect(await status()).toMatchObject({ hasApiKey: true })
      // A handle left open after acknowledged teardown must not fail the update handoff.
      vi.stubEnv('NODE_OPTIONS', `--import=data:text/javascript,${encodeURIComponent(
        "process.on('message', message => { if (message?.type === 'shutdown') setInterval(() => {}, 1000) })")}`)
      await restart()
      await host!.stop(true)
    } finally {
      await host?.stop()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
