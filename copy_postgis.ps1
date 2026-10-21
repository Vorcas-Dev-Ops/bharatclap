$src = 'e:\vorcas\sumanth\bharatclap\postgis-extracted\postgis-bundle-pg18-3.6.2x64'
$dst = 'C:\Program Files\PostgreSQL\18'
robocopy "$src\bin" "$dst\bin" /E /XO /NP
robocopy "$src\lib" "$dst\lib" /E /XO /NP
robocopy "$src\share" "$dst\share" /E /XO /NP
if (Test-Path "$src\gdal-data") {
    robocopy "$src\gdal-data" "$dst\gdal-data" /E /XO /NP
}
"PostGIS files copied successfully at $(Get-Date)" | Out-File 'e:\vorcas\sumanth\bharatclap\postgis_copied.txt'
