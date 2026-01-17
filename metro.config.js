const path = require("path");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// This is the MOST important: tells Metro to prefer "browser" builds
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

// Fallback: if it still tries to pull "ws", we "trick" the import
config.resolver.extraNodeModules = {
  ws: path.resolve(__dirname, "shims/ws.js"),
};

module.exports = config;