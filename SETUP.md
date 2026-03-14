# Payment Tracker - Setup Guide

## Step 1: Supabase Setup (Free)

1. Go to https://supabase.com and create a free account
2. Click "New Project" → Give it a name → Set a database password
3. Wait for the project to be created
4. Go to **SQL Editor** → Click "New Query" → Paste the contents of `supabase-schema.sql` → Click "Run"
5. Go to **Settings** → **API** → Copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)
6. Open `lib/supabase.js` and replace:
   - `YOUR_PROJECT_ID` with your Project URL
   - `YOUR_ANON_KEY` with your anon key

## Step 2: Run the App

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm start

# Run on web
npm run web

# Run on Android (with Expo Go app installed)
npm run android
```

## Step 3: Deploy Web (Free on Vercel)

1. Push code to GitHub
2. Go to https://vercel.com → Import your repo
3. Set framework to "Other"
4. Build command: `npx expo export -p web`
5. Output directory: `dist`
6. Deploy! You get a free .vercel.app URL

## Step 4: Build Android APK (Free)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build APK (free tier: 30 builds/month)
eas build -p android --profile preview
```

The APK will be available for download from your Expo dashboard.
Host it on your website for users to download directly.

## Step 5: Gmail Import Setup (Optional, Free)

1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add the credentials to your app's Settings

## Step 6: SMS Import (Android Only)

SMS import requires a custom development build (not Expo Go):

```bash
npx expo prebuild
npm install react-native-get-sms-android
eas build -p android --profile preview
```

## CSV Format

Your CSV files should have these columns:
```
date,amount,type,category,description
2024-01-15,500,expense,food,Lunch at restaurant
2024-01-16,50000,income,salary,January salary
```

## Tech Stack

- React Native + Expo (cross-platform)
- Expo Router (file-based routing)
- Supabase (database + auth)
- React Native Paper (UI components)
- React Native Chart Kit (charts)
- PapaParse (CSV parsing)
