@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title 立项裁判 一键安装

set "REPO_ZIP=https://github.com/zxc9802/sabc-judge/archive/refs/heads/main.zip"
set "NODE_VER=22.23.2"
set "APP_DIR=%USERPROFILE%\sabc-judge"
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

net session >nul 2>&1
if errorlevel 1 (
  echo 需要管理员权限来安装 Node.js，即将弹出授权窗口。
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -WorkingDirectory '%SCRIPT_DIR%'"
  exit /b
)

cd /d "%SCRIPT_DIR%"
echo 立项裁判 一键安装
echo ----------------

call :refresh_path
where node >nul 2>&1
if errorlevel 1 (
  call :install_node
) else (
  echo.
  echo ==^> 已检测到 Node.js
  node -v
)

if exist "%SCRIPT_DIR%\package.json" (
  findstr /C:"\"name\": \"sabc-judge\"" "%SCRIPT_DIR%\package.json" >nul
  if not errorlevel 1 (
    set "APP_DIR=%SCRIPT_DIR%"
    echo.
    echo ==^> 使用当前文件夹的项目：!APP_DIR!
    goto :have_project
  )
)

if exist "%APP_DIR%\package.json" (
  echo.
  echo ==^> 使用已下载的项目：%APP_DIR%
  goto :have_project
)

call :download_project

:have_project
cd /d "%APP_DIR%"
if not exist "data\uploads" mkdir "data\uploads"
if not exist "data\kb" mkdir "data\kb"
if not exist ".env.local" copy /Y ".env.example" ".env.local" >nul

findstr /C:"LLM_API_KEY=sk-your-key" ".env.local" >nul
if not errorlevel 1 (
  echo.
  echo 请输入 OpenLux API Key，直接回车可稍后自己改 .env.local
  set /p "KEY=API Key: "
  if not "!KEY!"=="" (
    powershell -NoProfile -Command "(Get-Content -LiteralPath '.env.local') -replace 'LLM_API_KEY=.*','LLM_API_KEY=!KEY!' | Set-Content -LiteralPath '.env.local'"
  )
)

echo.
echo ==^> 正在安装项目依赖（第一次会比较久）
call :refresh_path
call npm install
if errorlevel 1 (
  echo ==^> 官方 npm 源失败，改用国内镜像重试
  call npm install --registry=https://registry.npmmirror.com
  if errorlevel 1 goto :fail
)

where python >nul 2>&1
if not errorlevel 1 (
  echo ==^> 尝试安装知识库加速组件
  python -m pip install --user numpy faiss-cpu >nul 2>&1
)

echo.
echo ==^> 正在启动，浏览器稍后会打开 http://localhost:3000
echo 关闭这个窗口就会停止服务。
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3000"
call npm run dev
goto :end

:install_node
echo.
echo ==^> 正在安装 Node.js
where winget >nul 2>&1
if not errorlevel 1 (
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  call :refresh_path
  where node >nul 2>&1
  if not errorlevel 1 goto :eof
)

set "MSI=%TEMP%\sabc-node.msi"
set "ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"
set "URL1=https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-%ARCH%.msi"
set "URL2=https://npmmirror.com/mirrors/node/v%NODE_VER%/node-v%NODE_VER%-%ARCH%.msi"

powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%URL1%' -OutFile '%MSI%' -UseBasicParsing } catch { Invoke-WebRequest -Uri '%URL2%' -OutFile '%MSI%' -UseBasicParsing }"
if not exist "%MSI%" (
  echo 下载 Node.js 安装包失败。
  goto :fail
)
msiexec /i "%MSI%" /qn /norestart
del /q "%MSI%" >nul 2>&1
call :refresh_path
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 安装后仍找不到 node 命令，请重新打开这个脚本再试一次。
  goto :fail
)
echo Node.js 已安装：
node -v
goto :eof

:download_project
echo.
echo ==^> 正在下载立项裁判源码
set "ZIP=%TEMP%\sabc-judge.zip"
set "EXTRACT=%TEMP%\sabc-judge-extract"
if exist "%ZIP%" del /q "%ZIP%"
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%"
mkdir "%EXTRACT%"
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%REPO_ZIP%' -OutFile '%ZIP%' -UseBasicParsing"
if not exist "%ZIP%" (
  echo 下载源码失败。请检查网络，或把整个项目文件夹拷到这台电脑后再双击。
  goto :fail
)
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%EXTRACT%' -Force"
for /d %%D in ("%EXTRACT%\sabc-judge-*") do (
  if exist "%%D\package.json" (
    if exist "%APP_DIR%" rmdir /s /q "%APP_DIR%"
    move "%%D" "%APP_DIR%" >nul
  )
)
if not exist "%APP_DIR%\package.json" (
  echo 解压后的源码不完整。
  goto :fail
)
echo 源码已放到 %APP_DIR%
goto :eof

:refresh_path
set "PATH=C:\Program Files\nodejs;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%PATH%"
goto :eof

:fail
echo.
echo 安装失败。请把上面的报错截图发回来。
pause
exit /b 1

:end
echo.
pause
endlocal
