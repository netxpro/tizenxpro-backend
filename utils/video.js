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

export function formatViews(views) {
  if (typeof views === "string") views = parseInt(views.replace(/[^\d]/g, ""));
  if (isNaN(views)) return "0";
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1).replace('.', ',') + "M views";
  if (views >= 1_000) return (views / 1_000).toFixed(1).replace('.', ',') + "K views";
  return views.toString() + " views";
}