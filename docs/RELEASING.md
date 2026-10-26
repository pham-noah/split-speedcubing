# Releasing Split

A checklist in the order that avoids rework. Items marked **you** cannot be done for you.

## 0. Before the first release
1. **you** Fill in your name in the README licence section and the contact line in `PRIVACY.md`.
2. **you** Choose the final **application id** (reverse domain you control, for example `io.github.yourname.split`). Replace `org.example.split` in `capacitor.config.ts`, `src-tauri/tauri.conf.json`, `docs/fdroid/*.yml`, then recreate the Android project:
   ```bash
   rm -rf android && npm run build && npx cap add android
   # remove the INTERNET permission from android/app/src/main/AndroidManifest.xml, set android:allowBackup="false"
   # set versionCode / versionName in android/app/build.gradle, then:
   npm run icons
   ```
3. **you** Check the name "Split" is free in the Play Store and on F-Droid.
4. Use the app on a real phone and computer for a few days. Run `npm run e2e` against a build (see README).
5. Compare the PLL / OLL algorithms with your own sheet; replace any F2L algs you dislike.

## 1. Version bump (every release)
- `package.json` version, `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml` version, `android/app/build.gradle` `versionName` and an **increased** `versionCode`.
- Add a `CHANGELOG.md` entry and `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (500 characters max).
- `npm run check && npm test && npm run build && npm run version:check`, then tag: `git tag v0.2.0 && git push --tags`.

## 2. Android signing (once)
**you** Create an upload key and keep it (and its passwords) somewhere safe. Losing it can block updates.
```bash
keytool -genkeypair -v -keystore split-upload.jks -alias split -keyalg RSA -keysize 4096 -validity 10000
```
For GitHub Actions store these repository secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 split-upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. `release.yml` signs the APK when they are set.

Build locally instead: `npm run android:sync`, `npm run android:open`, then Build > Generate Signed Bundle / APK.

## 3. Google Play
**you** Register a developer account (a one-time fee, about $25 at last check). Follow `docs/store/play-listing.md`. Upload the signed `.aab`.

## 4. F-Droid
F-Droid builds from your public source and signs with its own key. Prepare `docs/fdroid/*.yml` (see its header) and open a merge request on fdroiddata. The `fastlane/metadata/android/en-US` folder supplies the title, descriptions, changelog and screenshots. There must be no proprietary dependency (there is none today).

## 5. Desktop
`npm run desktop:build` (needs Rust). `release.yml` builds Windows, macOS and Linux bundles on tag push. Windows and macOS show "unknown publisher" warnings until you buy a code-signing certificate; Linux needs none.

## 6. Web version
`npm run build`, then upload `dist/` to any static host. Serve over HTTPS so the service worker (offline mode) works.
