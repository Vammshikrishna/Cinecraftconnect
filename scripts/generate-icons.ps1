Add-Type -AssemblyName System.Drawing

$srcPath = "e:\Cinecraftconnect\apps\mobile\src\assets\logo.jpg"
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

$sizes = @(
    @{ Dir = "mipmap-mdpi"; Size = 48 },
    @{ Dir = "mipmap-hdpi"; Size = 72 },
    @{ Dir = "mipmap-xhdpi"; Size = 96 },
    @{ Dir = "mipmap-xxhdpi"; Size = 144 },
    @{ Dir = "mipmap-xxxhdpi"; Size = 192 }
)

foreach ($item in $sizes) {
    $dirName = $item.Dir
    $size = $item.Size
    $targetDir = "e:\Cinecraftconnect\apps\mobile\android\app\src\main\res\" + $dirName

    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    # 1. Standard ic_launcher.png (Rounded rectangle)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = [int]($size * 0.2)
    $path.AddArc(0, 0, $radius * 2, $radius * 2, 180, 90)
    $path.AddArc($size - $radius * 2, 0, $radius * 2, $radius * 2, 270, 90)
    $path.AddArc($size - $radius * 2, $size - $radius * 2, $radius * 2, $radius * 2, 0, 90)
    $path.AddArc(0, $size - $radius * 2, $radius * 2, $radius * 2, 90, 90)
    $path.CloseFigure()
    $g.SetClip($path)
    $g.DrawImage($srcImg, 0, 0, $size, $size)
    $g.Dispose()

    $outPath = Join-Path $targetDir "ic_launcher.png"
    if (Test-Path $outPath) { Remove-Item $outPath -Force }
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    # 2. Circular ic_launcher_round.png
    $bmpRound = New-Object System.Drawing.Bitmap($size, $size)
    $gRound = [System.Drawing.Graphics]::FromImage($bmpRound)
    $gRound.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gRound.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gRound.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gRound.Clear([System.Drawing.Color]::Transparent)

    $pathRound = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pathRound.AddEllipse(0, 0, $size, $size)
    $gRound.SetClip($pathRound)
    $gRound.DrawImage($srcImg, 0, 0, $size, $size)
    $gRound.Dispose()

    $outRoundPath = Join-Path $targetDir "ic_launcher_round.png"
    if (Test-Path $outRoundPath) { Remove-Item $outRoundPath -Force }
    $bmpRound.Save($outRoundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpRound.Dispose()

    Write-Host "Generated $dirName icons (${size}x${size})"
}

$srcImg.Dispose()
Write-Host "All Android CineCraft Connect launcher icons generated successfully!"
