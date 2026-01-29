require("dotenv").config();

module.exports = {
  expo: {
    name: "DarkNite",
    slug: "darknite",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#050013"
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.darknite.app",
      buildNumber: "1",
      usesAppleSignIn: true,
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
      },
    },
    scheme: "darknite",
    plugins: [
      "expo-apple-authentication",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#A855F7",
        }
      ],
      [
        "@sentry/react-native/expo",
        {
          url: "https://sentry.io/",
          project: "react-native",
          organization: "darknite"
        }
      ]
    ],
    android: {
      package: "com.darknite.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#050013"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      sentryDsn: process.env.SENTRY_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN,
      eas: {
        projectId: process.env.EAS_PROJECT_ID
      }
    }
  }
};
