@echo off
xcopy birdquizz %temp%\birdquizz\ /S
cd /D %TEMP%\birdquizz
start C:\kzip.exe C:\birdquizz-1.0.xpi "*.*" /r
pause
cd ..
cd ..
echo Deleting temp folder
rmdir %TEMP%\birdquizz /S /Q