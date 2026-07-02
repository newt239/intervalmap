// pnpm monorepo 対応の Metro 設定。ワークスペースを watch しリンクを解決する。
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// disableHierarchicalLookup は使わない。pnpm は推移的依存を .pnpm 内へ隔離するため階層探索が必須

module.exports = config;
