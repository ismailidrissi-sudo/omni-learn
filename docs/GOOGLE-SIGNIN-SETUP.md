# Google Sign-In Setup

This guide explains how to configure Google Sign-In for the Omnilearn web app, Android app, and iOS app.

## 1. Create Google Cloud Project & OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **Google+ API** (or **Google Identity Services**)
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth client ID**
6. Configure the **OAuth consent screen** if prompted (External user type for public apps)

### Create OAuth Client IDs

You need **three** OAuth 2.0 Client IDs:

| Type | Use case |
|------|----------|
| **Web application** | Next.js frontend, backend token verification |
| **Android** | Expo/React Native Android app |
| **iOS** | Expo/React Native iOS app |

#### Web Client
- Application type: **Web application**
- Authorized JavaScript origins: `http://localhost:3000`, `https://omnilearn.space` (production)
- Copy the **Client ID** (e.g. `123456789-xxx.apps.googleusercontent.com`)

#### Android Client
- Application type: **Android**
- Package name: `host.exp.Exponent` (Expo) or your custom package
- SHA-1: Get from `keytool -list -v -keystore ~/.android/debug.keystore` or EAS Build

#### iOS Client
- Application type: **iOS**
- Bundle ID: Your app bundle ID
- Copy the **iOS URL scheme** (e.g. `com.googleusercontent.apps.123456789-xxx`)

## 2. Web App Configuration

### Frontend (Next.js)

1. Copy `frontend/.env.example` to `frontend/.env.local`
2. Set:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:4000
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

### Backend (NestJS)

1. Add to `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

The backend uses this to verify Google ID tokens at `POST /auth/google`.

## 3. Mobile App Configuration (Expo)

> **Note:** `@react-native-google-signin/google-signin` requires an **Expo Development Build** (not Expo Go) because it uses native code.

### Environment

1. Copy `mobile/.env.example` to `mobile/.env`
2. Set:
   ```
   EXPO_PUBLIC_API_URL=http://localhost:4000
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

Use the **same Web client ID** as the frontend—the backend verifies tokens with it.

### app.json Plugin

Update `mobile/app.json` with your iOS URL scheme from the iOS OAuth client:

```json
"plugins": [
  [
    "@react-native-google-signin/google-signin",
    {
      "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID_PREFIX"
    }
  ]
]
```

### Build Native App

```bash
cd mobile
npx expo prebuild --clean
npx expo run:android
npx expo run:ios
```

## 4. Flow Summary

1. **Web:** User clicks "Sign in with Google" → Google account picker opens → User selects account → ID token sent to `POST /auth/google` → Backend verifies, creates/updates user, returns JWT → Stored in localStorage, redirect to `/learn`
2. **Mobile:** User taps "Sign in with Google" → Native Google Sign-In UI (account picker) → ID token sent to `POST /auth/google` → Same flow as web

## 5. Troubleshooting

- **"Google Sign-In not configured"**: Set `GOOGLE_CLIENT_ID` in backend `.env`
- **"redirect_uri_mismatch"**: Add your app's redirect URI to the Google Cloud OAuth client
- **Expo Go**: Google Sign-In does not work in Expo Go; use a development build
- **CORS errors**: Backend has `enableCors({ origin: true })`; ensure backend is running
