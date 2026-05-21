require("dotenv").config();

module.exports = {
  expo: {
    name: "DarkNite",
    slug: "darknite",
    version: "1.0.2",
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
      config: {
        googleMapsApiKey:
          process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "DarkNite uses your location to show venues near you.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    scheme: "darknite",
    plugins: [
      "expo-apple-authentication",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "DarkNite uses your location to show venues near you."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#A855F7"
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
      config: {
        googleMaps: {
          apiKey:
            process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY,
        },
      },
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
      googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY,
      sentryDsn: process.env.SENTRY_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN,
      eas: {
        projectId: process.env.EAS_PROJECT_ID
      }
    }
  }
};