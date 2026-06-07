#!/usr/bin/env pwsh
# fix-migration-imports.ps1
#
# Repairs files where the AppText migration script injected the
# `import { AppText } from '@/components/ui';` line in the middle of
# a multi-line import block. The pattern looks like:
#
#   import {
#   import { AppText } from '@/components/ui';
#     FontSizeVariant,
#     ...
#   } from '@/constants/typography';
#
# We strip the injected line, then re-insert it after the last
# complete import block.

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path "$PSScriptRoot/..").Path
$src = Join-Path $root 'src'

$tsFiles = Get-ChildItem -Path $src -Recurse -Include '*.ts', '*.tsx' -File
$changed = 0

foreach ($file in $tsFiles) {
  $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
  $original = $content

  # 1) Strip the incorrectly-placed injection.
  $content = [regex]::Replace(
    $content,
    "(?ms)^(\s*)import \{[^}]*?\}\s*from\s*'@?/components/ui';\s*\n",
    '',
  )

  # 2) Find the LAST closing brace + 'from ...;' of an import block.
  #    We re-add the AppText import immediately after that block.
  $matches = [regex]::Matches($content, "(?ms)^\s*import\s*\{[^}]*\}\s*from\s*['""][^'""]+['""]\s*;\s*\n")

  if ($matches.Count -gt 0 -and $content -match '<AppText(?=[\s>/])') {
    $lastMatch = $matches[$matches.Count - 1]
    $insertAt = $lastMatch.Index + $lastMatch.Length
    # Get the leading whitespace of the *first* import in the file so
    # our new line is indented consistently.
    $firstMatch = $matches[0]
    $firstLineStart = $firstMatch.Index
    # Find the column where the first import statement begins.
    $lineStart = $content.LastIndexOf("`n", $firstLineStart) + 1
    $indent = ($content.Substring($lineStart, $firstLineStart - $lineStart))
    $injection = "${indent}import { AppText } from '@/components/ui';`n"
    $content = $content.Substring(0, $insertAt) + $injection + $content.Substring($insertAt)
  }

  if ($content -ne $original) {
    Set-Content -Path $file.FullName -Value $content -NoNewline -Encoding UTF8
    $changed++
    Write-Host "  fixed: $($file.FullName.Substring($root.Length + 1))"
  }
}

Write-Host ""
Write-Host "Import fix complete. Files updated: $changed"
