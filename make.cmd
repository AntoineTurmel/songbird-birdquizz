@echo off
cd birdquizz
7za.exe a -mm=Deflate -mx=9 -tzip -r -x!.svn ..\birdquizz.xpi *
pause