# Releasing Split

A checklist in the order that avoids rework. Items marked **you** cannot be done for you.

## 0. Before the first store release
Done already: the application id is `com.noah.split` (`android/app/build.gradle` `applicationId`,
`capacitor.config.ts` `appId`, `src-tauri/tauri.conf.json` `identifier`, `res/values/strings.xml`), the README
carries the author, and the F-Droid template is named for that id. The Android **namespace** stays
`org.example.split` on purpose — that is the Java package `MainActivity` lives in.

1. **you** Check the name "Split" is free in the Play Store and on F-Droid.
2. Use the app on a real phone and computer for a few days. Run `npm run e2e:offline` (see README).
3. Compare the PLL / OLL algorithms with your own sheet; replace any F2L algs you dislike.

**Never `rm -rf android`.** `android/app/split-release.jks` and `android/keystore.properties` are gitignored and
live inside it, so deleting the folder deletes the signing key — and with it every possibility of updating an
installed copy. Capacitor's template is not worth regenerating for that.

## 1. Version bump (every release)
- `package.json` version, `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml` version, `android/app/build.gradle` `versionName` and an **increased** `versionCode`.
- Add a `CHANGELOG.md` entry and `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (500 characters max).
- `npm run lint && npm run check && npm test && npm run version:check`, then tag: `git tag v0.5.0 && git push --tags`.

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
`npm run build:web` writes `dist-web/`; upload that folder to any static host and serve it over HTTPS, or the
service worker (offline mode) will not register.
