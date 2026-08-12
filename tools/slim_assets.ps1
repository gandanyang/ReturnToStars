# One-time bundle slim script (2026-08-12)
# 1. Voice ogg: 160kbps stereo -> 64kbps mono (prefer voice_normalized_src wav source)
# 2. BGM ogg: 128-160kbps -> 96kbps stereo
# 3. Large jpg: recompress (mjpeg q:v 5)
$FF = 'C:\ffmpeg-6.0-essentials_build\bin\ffmpeg.exe'
$ROOT = 'G:\ReturnToStars'
$log = New-Object System.Collections.Generic.List[string]

# ---------- 1. Voice ----------
$oggRoot = "$ROOT\public\audio\voice_normalized"
$srcRoot = "$ROOT\art_source\audio\voice_normalized_src"
$totalBefore = 0; $totalAfter = 0; $fail = 0
Get-ChildItem -Recurse $oggRoot -Filter *.ogg | ForEach-Object {
    $ogg = $_
    $rel = $ogg.FullName.Substring($oggRoot.Length + 1).Replace('.ogg', '.wav')
    $wavSrc = Join-Path $srcRoot $rel
    $srcFile = if (Test-Path $wavSrc) { $wavSrc } else { $ogg.FullName }
    $tmp = $ogg.FullName + '.slim.tmp.ogg'
    & $FF -y -hide_banner -loglevel error -i $srcFile -c:a libvorbis -b:a 64k -ac 1 -ar 44100 $tmp 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $tmp)) {
        $before = $ogg.Length
        $totalBefore += $before
        Remove-Item $ogg.FullName -Force
        Move-Item $tmp $ogg.FullName
        $after = (Get-Item $ogg.FullName).Length
        $totalAfter += $after
        $log.Add("[voice] $rel  $([math]::Round($before/1KB))KB -> $([math]::Round($after/1KB))KB")
    } else {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        $fail++
        $log.Add("[voice] FAIL $rel")
    }
}
$log.Add("[voice] total $([math]::Round($totalBefore/1MB,2))MB -> $([math]::Round($totalAfter/1MB,2))MB  (fail=$fail)")

# ---------- 2. BGM ----------
$musicDir = "$ROOT\public\assets\audio\music"
$mb = 0; $ma = 0; $mfail = 0
Get-ChildItem $musicDir -Filter *.ogg | ForEach-Object {
    $f = $_
    $tmp = $f.FullName + '.slim.tmp.ogg'
    & $FF -y -hide_banner -loglevel error -i $f.FullName -c:a libvorbis -b:a 96k -ac 2 -ar 44100 $tmp 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $tmp)) {
        $before = $f.Length; $mb += $before
        Remove-Item $f.FullName -Force
        Move-Item $tmp $f.FullName
        $after = (Get-Item $f.FullName).Length; $ma += $after
        $log.Add("[bgm] $($f.Name)  $([math]::Round($before/1MB,2))MB -> $([math]::Round($after/1MB,2))MB")
    } else {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        $mfail++
        $log.Add("[bgm] FAIL $($f.Name)")
    }
}
$log.Add("[bgm] total $([math]::Round($mb/1MB,2))MB -> $([math]::Round($ma/1MB,2))MB  (fail=$mfail)")

# ---------- 3. Large jpg ----------
$jpgs = @(
    "$ROOT\public\assets\images\story\shard2_huai_tree_v1.jpg",
    "$ROOT\public\assets\images\story\stargaze_niulang_v1.jpg",
    "$ROOT\public\assets\images\title_bg.jpg",
    "$ROOT\public\assets\images\story\xiya_lamp_v1.jpg"
)
$jb = 0; $ja = 0; $jfail = 0
foreach ($j in $jpgs) {
    if (-not (Test-Path $j)) { $log.Add("[jpg] MISS $j"); continue }
    $tmp = $j + '.slim.tmp.jpg'
    & $FF -y -hide_banner -loglevel error -i $j -c:v mjpeg -q:v 5 $tmp 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $tmp)) {
        $before = (Get-Item $j).Length; $jb += $before
        Remove-Item $j -Force
        Move-Item $tmp $j
        $after = (Get-Item $j).Length; $ja += $after
        $log.Add("[jpg] $(Split-Path $j -Leaf)  $([math]::Round($before/1KB))KB -> $([math]::Round($after/1KB))KB")
    } else {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        $jfail++
        $log.Add("[jpg] FAIL $j")
    }
}
$log.Add("[jpg] total $([math]::Round($jb/1MB,2))MB -> $([math]::Round($ja/1MB,2))MB  (fail=$jfail)")

$log | ForEach-Object { Write-Output $_ }
