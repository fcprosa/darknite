# Sentry Integration Guide

This guide walks you through integrating Sentry error tracking into DarkNite.

## Step 1: Create a Sentry Account

1. Go to [sentry.io](https://sentry.io) and sign up for a free account
2. Create a new project:
   - Select **React Native** as the platform
   - Choose your organization
   - Give it a name (e.g., "DarkNite")

## Step 2: Get Your DSN

1. After creating the project, Sentry will show you a **DSN** (Data Source Name)
   - It looks like: `https://xxxxxxxxxxxxx@xxxxx.ingest.sentry.io/xxxxxx`
2. Copy this DSN - you'll need it in the next step

## Step 3: Install Sentry Package

Run this command in your project root:

```bash
npm install @sentry/react-native
```

For Expo projects, you may need to use `sentry-expo` instead:

```bash
npx expo install sentry-expo
```

**Note:** This guide uses `@sentry/react-native`. If you're using `sentry-expo`, the setup is slightly different (see Expo docs).

## Step 4: Add DSN to Environment Variables

Add your Sentry DSN to your `.env` file:

```env
# Add this line to your .env file
SENTRY_DSN=https://xxxxxxxxxxxxx@xxxxx.ingest.sentry.io/xxxxxx
```

## Step 5: Code is Already Set Up!

The Sentry integration code is already in place. When you install the package and add the DSN, it will automatically start working.

**What's already configured:**
- ✅ Sentry initialization in `utils/sentry.js`
- ✅ Logger integration in `utils/logger.js`
- ✅ Environment variable support in `app.config.js`

## Step 6: Update Logger to Use Sentry

The logger has been updated to automatically send errors to Sentry when configured.

## Step 7: Test Sentry Integration

1. Add a test error button to trigger an error
2. Check your Sentry dashboard to see if errors appear
3. Verify error details are captured correctly

## Verification

After setup, you should:
- See errors appear in your Sentry dashboard
- Get email notifications (if configured) when errors occur
- See error stack traces, user context, and breadcrumbs

## Troubleshooting

**Errors not appearing in Sentry?**
- Check that `SENTRY_DSN` is set in your `.env` file
- Verify the DSN is correct (no typos)
- Check that Sentry is initialized before any errors occur
- Look for Sentry errors in console logs

**Development vs Production:**
- Sentry is configured to track errors in production only by default
- You can enable it in development by setting `NODE_ENV` or modifying the logger config
