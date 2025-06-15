export function videoArrJson({ quality, url, source }) {
  return {
    quality: String(quality),
    url: url || null,
    source: source || null,
  };
}

export function subtitlesArrJson({ lang, label, url }) {
  return {
    lang: lang || null,
    label: label || null,
    url: url || null,
  };
}
