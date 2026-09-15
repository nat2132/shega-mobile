const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Include the shared package (outside the project root) so Metro watches and
// bundles it. Watch only the package directory itself and not the whole parent
// folder — crawling the entire workspace delays Metro's file-map build, which
// causes asset requests to hit an uninitialized DependencyGraph and crash.
const shegaSharedPath = path.resolve(workspaceRoot, 'shega-shared');
config.watchFolders = [shegaSharedPath];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Resolve the local @shega/shared package so Metro can bundle it even when the
// npm symlink is missing or when the package lives outside the project root.
config.resolver.extraNodeModules = {
  '@shega/shared': shegaSharedPath,
};

// lib0 (a yjs dependency) tries to pull in isomorphic-webcrypto on the
// react-native platform, but that package is not installed.  Redirect the
// import to a lightweight shim that delegates to expo-crypto.
const shimPath = path.resolve(projectRoot, 'src', 'shims', 'webcrypto-shim.ts');
// yjs ships both an ESM (dist/yjs.mjs) and a CJS (dist/yjs.cjs) build and
// publishes them under the "exports" "import"/"require" conditions.  Metro
// loads BOTH into one bundle when a package imports yjs as ESM while another
// uses require(), producing two yjs instances ("Yjs was already imported").
// Force every yjs request to a single canonical file so constructor checks
// keep working.
const yjsPath = path.resolve(projectRoot, 'node_modules', 'yjs', 'dist', 'yjs.cjs');
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'isomorphic-webcrypto/src/react-native') {
    return { type: 'sourceFile', filePath: shimPath };
  }
  if (moduleName === 'yjs') {
    return { type: 'sourceFile', filePath: yjsPath };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
