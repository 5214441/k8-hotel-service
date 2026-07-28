@echo off
chcp 65001 >nul
set "URL=https://5214441.github.io/k8-hotel-service/admin.html"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" (
  echo 未找到 Microsoft Edge，请先确认 Edge 已安装。
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ws=New-Object -ComObject WScript.Shell;" ^
 "$desktop=[Environment]::GetFolderPath('Desktop');" ^
 "$startup=[Environment]::GetFolderPath('Startup');" ^
 "$target='%EDGE%';$args='--app=%URL% --start-maximized';" ^
 "$s=$ws.CreateShortcut((Join-Path $desktop 'K8前台工单台.lnk'));$s.TargetPath=$target;$s.Arguments=$args;$s.WorkingDirectory=Split-Path $target;$s.Save();" ^
 "$s2=$ws.CreateShortcut((Join-Path $startup 'K8前台工单台.lnk'));$s2.TargetPath=$target;$s2.Arguments=$args;$s2.WorkingDirectory=Split-Path $target;$s2.Save();"
echo.
echo 已创建桌面快捷方式，并设置为 Windows 登录后自动启动。
echo 首次打开后，请点击“开启声音提醒”和“开启桌面通知”。
pause
