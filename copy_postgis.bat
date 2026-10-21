@echo off
set "SRC=e:\vorcas\sumanth\bharatclap\postgis-extracted\postgis-bundle-pg18-3.6.2x64"
set "DST=C:\Program Files\PostgreSQL\18"

echo Copying bin...
robocopy "%SRC%\bin" "%DST%\bin" /E /XO /NP /R:1 /W:1
echo Copying lib...
robocopy "%SRC%\lib" "%DST%\lib" /E /XO /NP /R:1 /W:1
echo Copying share...
robocopy "%SRC%\share" "%DST%\share" /E /XO /NP /R:1 /W:1
if exist "%SRC%\gdal-data" (
    echo Copying gdal-data...
    robocopy "%SRC%\gdal-data" "%DST%\gdal-data" /E /XO /NP /R:1 /W:1
)

echo DONE > "e:\vorcas\sumanth\bharatclap\postgis_copied.txt"
