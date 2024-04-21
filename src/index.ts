import { run } from './main.js'

// Running in GitHub Actions
if (typeof process.env['GITHUB_WORKSPACE'] === 'string') {
  run(true)
}

export { run }
