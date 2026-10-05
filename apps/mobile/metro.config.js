const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = {
  maxWorkers: 2,
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    disableHierarchicalLookup: true,
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'event-target-shim/index' || moduleName === 'event-target-shim') {
        return {
          filePath: path.resolve(monorepoRoot, 'node_modules/event-target-shim/dist/event-target-shim.js'),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
    extraNodeModules: new Proxy(
      {
        react: path.resolve(monorepoRoot, 'node_modules/react'),
        'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
        'event-target-shim': path.resolve(monorepoRoot, 'node_modules/event-target-shim'),
        '@react-native-async-storage/async-storage': path.resolve(monorepoRoot, 'node_modules/@react-native-async-storage/async-storage'),
        'react-native-safe-area-context': path.resolve(monorepoRoot, 'node_modules/react-native-safe-area-context'),
        'react-native-screens': path.resolve(monorepoRoot, 'node_modules/react-native-screens'),
        '@react-navigation/native': path.resolve(monorepoRoot, 'node_modules/@react-navigation/native'),
      },
      {
        get: (target, name) => {
          if (target[name]) {
            return target[name];
          }
          return path.join(projectRoot, 'node_modules', name);
        },
      }
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
