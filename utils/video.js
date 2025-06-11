export function videojson({
  id, title, thumbnail, url, duration, views, source, orientation
}) {
  return {
    id,
    title,
    thumbnail: { src: thumbnail },
    url,
    duration: duration || null,
    views: views || null,
    source,
    orientation: orientation || null,
  };
}