/** Interactive dev launcher selector for DeepSeek Harness. */
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { pnpmCommand } from './release/process.ts'

interface LaunchOption {
  readonly key: string
  readonly title: string
  readonly desc: string
  readonly command: string
  readonly args: readonly string[]
}

const OPTIONS: readonly LaunchOption[] = [
  {
    key: '1',
    title: '🖥️  Desktop 开发模式 (dev:desktop)',
    desc: '自动增量编译前端与主进程，拉起桌面端 (推荐日常改代码)',
    command: 'pnpm',
    args: ['run', 'dev:desktop'],
  },
  {
    key: '2',
    title: '⚡ Desktop 快速启动 (start:desktop)',
    desc: '跳过一切构建环节，秒开现有桌面端 (代码未变时推荐)',
    command: 'pnpm',
    args: ['run', 'start:desktop'],
  },
  {
    key: '3',
    title: '🌐 Web 开发模式 (dev:web)',
    desc: '启动 Web 页面，并常驻 3 个 watcher 监听前端源码实时热更新',
    command: 'pnpm',
    args: ['run', 'dev:web'],
  },
  {
    key: '4',
    title: '⚡ Web 快速启动 (start:web)',
    desc: '轻量单进程启动 Web 服务，无后台编译监听器，极省 CPU/内存',
    command: 'pnpm',
    args: ['run', 'start:web'],
  },
  {
    key: '5',
    title: '🔨 构建客户端产物 (build:artifacts)',
    desc: '重新编译并打包 packages/*/*/lib/client.js 与 Web 产物',
    command: 'pnpm',
    args: ['run', 'build:artifacts'],
  },
  {
    key: '6',
    title: '📦 完整官方构建 (build:official)',
    desc: '官方 official 生产 profile 完整构建，生成用于发布的标准产物',
    command: 'pnpm',
    args: ['run', 'build:official'],
  },
]

async function selectOption(): Promise<LaunchOption | null> {
  // If an argument was directly provided (e.g. `pnpm dev 2` or `pnpm dev web`), match directly.
  const arg = process.argv[2]?.trim().toLowerCase()
  if (arg !== undefined && arg !== '') {
    const matched = OPTIONS.find(opt => opt.key === arg)
      ?? OPTIONS.find(opt => opt.args.some(a => a.toLowerCase().includes(arg)))
    if (matched !== undefined) return matched
    if (arg === '0' || arg === 'exit' || arg === 'q') return null
  }

  const rl = createInterface({ input, output })
  try {
    console.log('\n' + '='.repeat(60))
    console.log('   🚀 DeepSeek Harness 启动菜单')
    console.log('='.repeat(60))
    for (const opt of OPTIONS) {
      console.log(`  [${opt.key}] ${opt.title}`)
      console.log(`      └─ ${opt.desc}`)
    }
    console.log('  [0] 🚪 退出')
    console.log('='.repeat(60))

    const answer = (await rl.question('  请输入选项编号 [默认 1]: ')).trim()
    const defaultOption = OPTIONS[0]
    if (defaultOption === undefined) return null
    if (answer === '' || answer === '1') return defaultOption
    if (answer === '0' || answer.toLowerCase() === 'q' || answer.toLowerCase() === 'exit') return null

    const chosen = OPTIONS.find(opt => opt.key === answer)
    if (chosen !== undefined) return chosen

    console.log(`\n⚠️  未知选项 "${answer}"，默认以 [1] Desktop 开发模式启动。\n`)
    return defaultOption
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  const chosen = await selectOption()
  if (chosen === null) {
    console.log('\n已取消启动。\n')
    return
  }

  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  console.log(`\n▶ 正在执行: ${chosen.command} ${chosen.args.join(' ')} (DSH_HOME=${dshHome})\n`)
  const [cmd, ...prefix] = chosen.command === 'pnpm' ? pnpmCommand() : [chosen.command]
  const child = spawn(cmd, [...prefix, ...chosen.args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DSH_HOME: dshHome,
      DSH_DESKTOP_OPEN_DEVTOOLS: process.env.DSH_DESKTOP_OPEN_DEVTOOLS ?? '0',
    },
  })

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else if (code !== null) process.exit(code)
  })
}

await main()
