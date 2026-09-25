$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$BgColor = [System.Drawing.ColorTranslator]::FromHtml("#4F46E5")
$White = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

function New-RoundedRectPath {
    param(
        [System.Drawing.RectangleF]$Rect,
        [float]$Radius
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $Radius * 2
    if ($d -gt $Rect.Width) { $d = $Rect.Width }
    if ($d -gt $Rect.Height) { $d = $Rect.Height }
    $r = $d / 2
    $path.AddArc($Rect.X, $Rect.Y, $d, $d, 180, 90)
    $path.AddArc($Rect.Right - $d, $Rect.Y, $d, $d, 270, 90)
    $path.AddArc($Rect.Right - $d, $Rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($Rect.X, $Rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-EduSphereIcon {
    param(
        [int]$Size,
        [string]$OutPath,
        [switch]$Maskable
    )
    $s = $Size / 512.0
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $bgBrush = New-Object System.Drawing.SolidBrush($BgColor)
    $whiteBrush = New-Object System.Drawing.SolidBrush($White)

    if ($Maskable) {
        $g.Clear($BgColor)
    } else {
        $path = New-RoundedRectPath -Rect (New-Object System.Drawing.RectangleF(0, 0, $Size, $Size)) -Radius (112 * $s)
        $g.FillPath($bgBrush, $path)
        $path.Dispose()
    }

    $diamond = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF -ArgumentList ([float](256 * $s), [float](120 * $s))),
        (New-Object System.Drawing.PointF -ArgumentList ([float](400 * $s), [float](210 * $s))),
        (New-Object System.Drawing.PointF -ArgumentList ([float](256 * $s), [float](300 * $s))),
        (New-Object System.Drawing.PointF -ArgumentList ([float](112 * $s), [float](210 * $s)))
    )
    $g.FillPolygon($whiteBrush, $diamond)

    $button = New-Object System.Drawing.RectangleF([float](236 * $s), [float](190 * $s), [float](40 * $s), [float](40 * $s))
    $buttonPath = New-RoundedRectPath -Rect $button -Radius ([float](10 * $s))
    $g.FillPath($bgBrush, $buttonPath)
    $buttonPath.Dispose()

    $cap = New-Object System.Drawing.RectangleF([float](176 * $s), [float](300 * $s), [float](160 * $s), [float](54 * $s))
    $capPath = New-RoundedRectPath -Rect $cap -Radius ([float](18 * $s))
    $g.FillPath($whiteBrush, $capPath)
    $capPath.Dispose()

    $pen = New-Object System.Drawing.Pen($White, ([float](10 * $s)))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($pen, [float](256 * $s), [float](210 * $s), [float](396 * $s), [float](322 * $s))
    $pen.Dispose()

    $tassel = New-Object System.Drawing.SolidBrush($White)
    $tasselRect = New-Object System.Drawing.RectangleF([float](388 * $s), [float](314 * $s), [float](24 * $s), [float](24 * $s))
    $g.FillEllipse($tassel, $tasselRect)

    $tassel.Dispose()
    $whiteBrush.Dispose()
    $bgBrush.Dispose()
    $g.Dispose()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$outRoot = Join-Path $PSScriptRoot "..\public\icons"

if (-not (Test-Path $outRoot)) {
    New-Item -ItemType Directory -Path $outRoot | Out-Null
}

New-EduSphereIcon -Size 192 -OutPath (Join-Path $outRoot "icon-192.png")
New-EduSphereIcon -Size 512 -OutPath (Join-Path $outRoot "icon-512.png")
New-EduSphereIcon -Size 192 -Maskable -OutPath (Join-Path $outRoot "maskable-192.png")
New-EduSphereIcon -Size 512 -Maskable -OutPath (Join-Path $outRoot "maskable-512.png")
New-EduSphereIcon -Size 180 -Maskable -OutPath (Join-Path $outRoot "apple-touch-icon.png")

Write-Output "Icons generated in $outRoot"