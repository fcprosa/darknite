const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Isto é o MAIS importante: diz ao Metro para preferir builds "browser"
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

// Fallback: se ainda assim tentar puxar "ws", nós “enganamos” o import
config.resolver.extraNodeModules = {
  ws: path.resolve(__dirname, "shims/ws.js"),
};

module.exports = config;
