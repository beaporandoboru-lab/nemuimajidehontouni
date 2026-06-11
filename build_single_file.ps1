# PowerShell script to bundle the multi-file project into a single index_single.html
# This allows double-clicking the HTML file to run it locally without CORS issues.

$projectDir = "D:\Documents\virtual-stock-trading"
$htmlPath = "$projectDir\index.html"
$cssPath = "$projectDir\src\style.css"
$jsOrder = @(
    "$projectDir\src\mockData.js",
    "$projectDir\src\store.js",
    "$projectDir\src\components\Header.js",
    "$projectDir\src\components\AdminPanel.js",
    "$projectDir\src\components\StockList.js",
    "$projectDir\src\components\StockChart.js",
    "$projectDir\src\components\TradePanel.js",
    "$projectDir\src\components\Portfolio.js",
    "$projectDir\src\main.js"
)
$outputPath = "$projectDir\index_single.html"

Write-Host "Bundling virtual stock trading site into a single file..."

# Read HTML and CSS
$html = Get-Content -Raw -Path $htmlPath -Encoding UTF8
$css = Get-Content -Raw -Path $cssPath -Encoding UTF8

# Build the concatenated JS
$jsBundle = ""
foreach ($file in $jsOrder) {
    if (Test-Path $file) {
        $content = Get-Content -Raw -Path $file -Encoding UTF8
        
        # Clean imports and exports using Regex
        # 1. Remove import lines
        $content = $content -replace "(?m)^import\s+[\s\S]*?;\r?\n", ""
        # 2. Remove export keyword before const, function, class, default
        $content = $content -replace "export\s+const\s+", "const "
        $content = $content -replace "export\s+function\s+", "function "
        $content = $content -replace "export\s+class\s+", "class "
        $content = $content -replace "export\s+default\s+\w+;\r?\n", ""
        $content = $content -replace "export\s+default\s+", ""
        
        $jsBundle += "`n// --- BUNDLED: $(Split-Path $file -Leaf) ---`n" + $content + "`n"
    } else {
        Write-Warning "File not found: $file"
    }
}

# Use .Replace() .NET string method instead of -replace operator
# This ensures that '$0' characters in CSS/JS are treated as literal text,
# preventing PowerShell from replacing them with the matched regex group!
$targetStyleTag = '  <link rel="stylesheet" href="./src/style.css">'
if ($html.Contains($targetStyleTag)) {
    $html = $html.Replace($targetStyleTag, "<style>`n$css`n</style>")
} else {
    # Fallback to regex replace if spacing differs, but escape replacement characters
    $escapedCss = $css.Replace('$', '$$')
    $html = $html -replace '<link\s+rel="stylesheet"\s+href="\.\/src\/style\.css"\s*>', "<style>`n$escapedCss`n</style>"
}

$targetScriptTag = '  <script type="module" src="./src/main.js"></script>'
if ($html.Contains($targetScriptTag)) {
    $html = $html.Replace($targetScriptTag, "<script>`n$jsBundle`n</script>")
} else {
    # Fallback with escaped characters
    $escapedJs = $jsBundle.Replace('$', '$$')
    $html = $html -replace '<script\s+type="module"\s+src="\.\/src\/main\.js"\s*><\/script>', "<script>`n$escapedJs`n</script>"
}

# Output the file
$html | Out-File -FilePath $outputPath -Encoding utf8

Write-Host "Success! Single-file build saved to: $outputPath"
