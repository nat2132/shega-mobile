const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Include the shared package (outside the project root) so Metro watches and
// bundles it.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Resolve the local @shega/shared package so Metro can bundle it even when the
// npm symlink is missing or when the package lives outside the project root.
config.resolver.extraNodeModules = {
  '@shega/shared': path.resolve(workspaceRoot, 'shega-shared'),
};

module.exports = config;
