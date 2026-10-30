@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
"%JAVA_HOME%\bin\java.exe" -jar "%LOCALAPPDATA%\Android\Sdk\build-tools\36.0.0\lib\apksigner.jar" verify --print-certs "%~dp0app\build\outputs\apk\release\app-release.apk"
