export function categoryjson({
  id, name, image, description, url, source
}) {
  return {
    id,
    name,
    image: image || null,
    description: description || null,
    url: url || null,
    source,
  };
}