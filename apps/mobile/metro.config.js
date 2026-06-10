const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// ── Monorepo: watch the full workspace so Metro can resolve hoisted packages ──
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// ── Enable package exports resolution and prefer browser-compatible builds ───
// Without this, packages like `jose` resolve to their Node ESM build which
// imports Node standard library modules (util, zlib) that don't exist in RN.
config.resolver.unstable_enablePackageExports = true
config.resolver.unstable_conditionNames = ['browser', 'require', 'default']

module.exports = config
