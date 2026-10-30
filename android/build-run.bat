@echo off
rem Gradle from WSL needs the Windows JDK and the Android SDK that the Windows side already has.
setlocal
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
cd /d "%~dp0"
call gradlew.bat %*
endlocal
