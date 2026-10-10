@echo off
rem ---------------------------------------------------------------------------
rem dsh-kaomoji - 一键发布到 npm（Windows）
rem
rem   双击运行：用 package.json 里的当前版本号发布
rem   终端运行：publish.cmd patch   先递增版本号（patch/minor/major）再发布
rem
rem   环境变量 PLUGIN_PUBLISH_DRY=1 时只做 npm publish --dry-run（演练，不真发布）
rem ---------------------------------------------------------------------------
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "RC=0"

rem 双击运行时才在结束时 pause（被其他脚本调用时不打断）
set "DO_PAUSE="
echo %cmdcmdline% | find /i "%~nx0" >nul && set "DO_PAUSE=1"

set "BUMP=%~1"
set "DRY="
if "%PLUGIN_PUBLISH_DRY%"=="1" set "DRY=--dry-run"

echo [1/4] 运行测试...
call npm test
if errorlevel 1 (
  echo.
  echo 测试失败，已停止发布。
  set "RC=1"
  goto :end
)

echo.
echo [2/4] 检查 npm 登录状态...
call npm whoami --registry=https://registry.npmjs.org/ >nul 2>nul
if errorlevel 1 (
  echo   未登录 npm，无法发布。请先执行：
  echo     npm login --registry https://registry.npmjs.org
  set "RC=1"
  goto :end
)

echo.
if not "%BUMP%"=="" (
  echo [3/4] 递增版本号：npm version %BUMP% --no-git-tag-version
  call npm version %BUMP% --no-git-tag-version
  if errorlevel 1 (
    echo   版本号更新失败。
    set "RC=1"
    goto :end
  )
) else (
  for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "CURVER=%%v"
  echo [3/4] 发布当前版本：dsh-kaomoji %CURVER%
)

echo.
echo [4/4] npm publish %DRY% --registry=https://registry.npmjs.org/
call npm publish %DRY% --registry=https://registry.npmjs.org/
if errorlevel 1 (
  echo.
  echo 发布失败：如果提示版本已存在，用  publish.cmd patch  先递增版本号再发。
  set "RC=1"
  goto :end
)

echo.
if defined DRY (
  echo 演练完成（dry-run，未真正发布）✅
) else (
  echo 发布完成 ✅
  echo 提示：若刚才递增过版本号，记得把 package.json 的改动 commit + push 回 GitHub。
)

:end
if defined DO_PAUSE pause
endlocal & exit /b %RC%