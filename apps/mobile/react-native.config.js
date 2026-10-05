const path = require('path');

module.exports = {
  dependencies: {
    'react-native-svg': {
      root: path.resolve(__dirname, '../../node_modules/react-native-svg'),
      platforms: {
        android: {
          sourceDir: path.resolve(__dirname, '../../node_modules/react-native-svg/android'),
        },
      },
    },
  },
};
