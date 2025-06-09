export function normalizeXhamsterVideo({ title, href, img, duration, views }, sourceSetting = "straight") {
  const id = href.split('/').filter(Boolean).pop();

  return {
    id,
    title,
    thumbnail: {
      src: img,
    },
    url: href.startsWith('http') ? href : `https://xhamster.com${href}`,
    duration: duration || null,
    views: views || null,
    source: "xhamster",
    sourceSetting,
  };
}
