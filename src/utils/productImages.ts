export function parseProductImages(imageRaw: string | null | undefined): { primary: string | null; images: string[] } {
  if (!imageRaw) return { primary: null, images: [] };
  const trimmed = imageRaw.trim();
  if (!trimmed) return { primary: null, images: [] };

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((img) => typeof img === 'string' && img.length > 0).slice(0, 5);
        return {
          primary: clean[0] ?? null,
          images: clean,
        };
      }
    } catch { /* fallthrough */ }
  } else if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const imgs = Array.isArray(parsed.images) ? parsed.images.filter((img: any) => typeof img === 'string' && img.length > 0).slice(0, 5) : [];
        const primary = typeof parsed.primary === 'string' && parsed.primary ? parsed.primary : (imgs[0] ?? null);
        if (primary && !imgs.includes(primary)) imgs.unshift(primary);
        return { primary, images: imgs.slice(0, 5) };
      }
    } catch { /* fallthrough */ }
  }

  return {
    primary: trimmed,
    images: [trimmed],
  };
}

export function serializeProductImages(images: string[], primaryIndex: number = 0): string | null {
  if (!images || images.length === 0) return null;
  const clean = images.filter((img) => typeof img === 'string' && img.trim().length > 0).slice(0, 5);
  if (clean.length === 0) return null;

  if (primaryIndex > 0 && primaryIndex < clean.length) {
    const primaryImg = clean[primaryIndex];
    clean.splice(primaryIndex, 1);
    clean.unshift(primaryImg);
  }

  if (clean.length === 1) {
    return clean[0];
  }

  return JSON.stringify(clean);
}
