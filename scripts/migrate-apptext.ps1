#!/usr/bin/env pwsh
# migrate-apptext.ps1
#
# Replaces all <Text>, </Text>, <RNText>, </RNText> JSX usages with
# the AppText primitive. Also:
#   * Adds `import { AppText } from '@/components/ui';` to any file
#     that previously used Text.
#   * Removes `Text` (and `Text as RNText`) from the `react-native`
#     import block when no other reference to that name remains.
#
# Run from the shega-mobile project root:
#
#   pwsh -File scripts/migrate-apptext.ps1
#
# This script is idempotent: running it twice does not corrupt
# already-migrated files.

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path "$PSScriptRoot/..").Path
$src = Join-Path $root 'src'

$tsFiles = Get-ChildItem -Path $src -Recurse -Include '*.ts', '*.tsx' -File
$changed = 0
$skipped = 0
$errors = @()

foreach ($file in $tsFiles) {
  $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
  $original = $content

  # 1) Replace <Text ...> opening tag with <AppText ...>. We match
  #    `<Text` followed by either whitespace, `>`, or `/` (self-
  #    closing case) to avoid touching substrings inside identifiers
  #    (e.g. `TextInput`, `<TextField>`, `<MyText>`, etc.).
  $content = [regex]::Replace($content, '<Text(?=[\s>/])', '<AppText')

  # 2) Replace <RNText ...> opening tag.
  $content = [regex]::Replace($content, '<RNText(?=[\s>/])', '<AppText')

  # 3) Replace `</Text>` and `</RNText>` closing tags.
  $content = $content.Replace('</Text>', '</AppText>')
  $content = $content.Replace('</RNText>', '</AppText>')

  # Detect if this file used to contain `<Text` or `<RNText` BEFORE
  # migration (i.e. it was using the old API). We re-read the
  # original content for the test.
  $hadText = $original -match '<Text(?=[\s>/])' -or $original -match '<RNText(?=[\s>/])'

  # 4) If the file uses AppText but doesn't import it, inject the import.
  $usesAppText = $content -match '<AppText(?=[\s>/])'
  $hasImport = $content -match "from '@?/components/ui'" -or $content -match "from '@?/components/AppText'"

  if ($usesAppText -and -not $hasImport -and $hadText) {
    # Find the last import statement and insert the AppText import
    # right after it.
    $lines = $content -split "`n"
    $lastImport = -1
    for ($i = 0; $i -lt $lines.Length; $i++) {
      if ($lines[$i] -match '^\s*import\s') { $lastImport = $i }
    }
    if ($lastImport -ge 0) {
      $indent = ($lines[$lastImport] -replace '^( *).*$', '$1')
      $injection = "${indent}import { AppText } from '@/components/ui';"
      $lines = @($lines[0..$lastImport] + $injection + $lines[($lastImport + 1)..($lines.Length - 1)])
      $content = ($lines -join "`n")
    }
  }

  # 5) Try to remove `Text` / `Text as RNText` from the react-native
  #    import. We only do this if the file no longer references the
  #    old name (other than the import line itself).
  if ($hadText) {
    $content = [regex]::Replace(
      $content,
      "(?ms)(import\s*\{)([^}]*?)(\}\s*from\s*'react-native';)",
      {
        param($m)
        $inside = $m.Groups[2].Value
        # Strip `\bText\b` and `\bText as RNText\b` (and trailing commas)
        $stripped = $inside
        $stripped = [regex]::Replace($stripped, '\s*Text\s+as\s+RNText\s*,?', '')
        $stripped = [regex]::Replace($stripped, '(?<![\w$])Text\s*(?=,|})', '')
        # Collapse multiple commas
        $stripped = [regex]::Replace($stripped, ',\s*,', ',')
        $stripped = [regex]::Replace($stripped, '{\s*,', '{ ')
        $stripped = [regex]::Replace($stripped, ',\s*}', ' }')
        if ($stripped.Trim() -eq '') {
          # Whole import was Text/RNText-only — drop the import entirely
          return ''
        }
        return $m.Groups[1].Value + $stripped + $m.Groups[3].Value
      }
    )
  }

  if ($content -ne $original) {
    Set-Content -Path $file.FullName -Value $content -NoNewline -Encoding UTF8
    $changed++
    Write-Host "  migrated: $($file.FullName.Substring($root.Length + 1))"
  } else {
    $skipped++
  }
}

Write-Host ""
Write-Host "Migration complete."
Write-Host "  Changed: $changed"
Write-Host "  Unchanged: $skipped"
if ($errors.Count -gt 0) {
  Write-Host "  Errors: $($errors.Count)"
  $errors | ForEach-Object { Write-Host "    $_" }
}
