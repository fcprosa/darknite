# TestFlight Setup Guide

## Prerequisites

1. **Apple Developer Account** ($99/year) - https://developer.apple.com
2. **Expo Account** (free) - https://expo.dev
3. **EAS CLI** installed: `npm install -g eas-cli`

---

## Step 1: Get Your Apple Credentials

### Apple ID
Your Apple ID email used for Apple Developer account.

### Apple Team ID
1. Go to https://developer.apple.com/account
2. Click "Membership" in the sidebar
3. Copy your **Team ID** (10-character string like "ABC123XYZ0")

### App Store Connect App ID
1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - Platform: iOS
   - Name: DarkNite
   - Primary Language: English (U.S.)
   - Bundle ID: com.darknite.app
   - SKU: darknite-ios-1
4. After creating, the App ID is in the URL or App Information page (numeric ID like "1234567890")

---

## Step 2: Update eas.json

Replace the placeholder values in `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your.email@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABC123XYZ0"
    }
  }
}
```

---

## Step 3: Configure Supabase for Apple Sign-In

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Apple" provider
3. Add your Apple credentials:
   - **Service ID**: com.darknite.app (your bundle ID)
   - **Secret Key**: Generate in Apple Developer Portal (see below)

### Generate Apple Secret Key:
1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Click "+" to create a new key
3. Name it "DarkNite Sign In"
4. Check "Sign in with Apple" and configure for your App ID
5. Download the .p8 key file (you can only download once!)
6. Note the Key ID

---

## Step 4: Setup Push Notifications (APNs)

### Create APNs Key:
1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Click "+" to create a new key
3. Name it "DarkNite Push Notifications"
4. Check "Apple Push Notifications service (APNs)"
5. Download the .p8 key file
6. Note the Key ID

### Add to Expo:
```bash
eas credentials
# Select iOS → production → Push Notifications
# Upload your .p8 key file
```

---

## Step 5: Add Environment Variables

Create/update `.env` file:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SENTRY_DSN=your-sentry-dsn
EAS_PROJECT_ID=your-eas-project-id
```

Get your EAS Project ID:
```bash
eas init
# This will create/link your project and show the ID
```

---

## Step 6: Build & Submit

```bash
# Login to Expo
eas login

# Configure credentials (interactive)
eas credentials

# Build for TestFlight
eas build --platform ios --profile production

# Submit to TestFlight (after build completes)
eas submit --platform ios --profile production
```

---

## Step 7: TestFlight Setup

1. Go to App Store Connect → Your App → TestFlight
2. Once the build processes, click on it
3. Add test information and compliance answers
4. Add internal testers (your team)
5. Optionally add external testers (requires Apple review)

---

## Checklist

- [ ] Apple Developer Account active
- [ ] App created in App Store Connect
- [ ] Bundle ID registered (com.darknite.app)
- [ ] Apple Sign-In configured in Supabase
- [ ] APNs key created and uploaded to Expo
- [ ] eas.json credentials filled in
- [ ] Environment variables set
- [ ] Privacy Policy hosted at public URL
- [ ] Build submitted to TestFlight
