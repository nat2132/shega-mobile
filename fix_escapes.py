import re

with open(r'C:\Users\Natol\Desktop\Projects\shega-mobile\src\context\SettingsContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all lines with potential escaping issues
# Look for lines with '' or '' patterns (wrong escaping)
fixes = 0

# Fix double-escaped quotes: \\' -> \'
# In the file, this would appear as backslash-backslash-quote
old = "\\\\'"
new = "\\'"
if old in content:
    content = content.replace(old, new)
    fixes += content.count(new)

# Fix unescaped single quotes within string values
# Find lines like: 'key': 'value'text' 
om_start = content.index('om: {')
ti_start = content.index('ti: {')
om_region = content[om_start:ti_start]

# Check for unmatched quotes
lines = om_region.split('\n')
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith("//"):
        continue
    # Count single quotes
    count = stripped.count("'")
    if count % 2 != 0:
        abs_line = i + 1
        print(f"WARN: Odd quote count at line ~{abs_line}: {stripped[:80]}")

with open(r'C:\Users\Natol\Desktop\Projects\shega-mobile\src\context\SettingsContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Fixed {fixes} escaping issues")
print("Done")
