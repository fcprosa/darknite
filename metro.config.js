const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// This is the MOST important: tells Metro to prefer "browser" builds
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

// Fallback: if it still tries to pull "ws", we "trick" the import
config.resolver.extraNodeModules = {
  ws: path.resolve(__dirname, "shims/ws.js"),
};

module.exports = config;
