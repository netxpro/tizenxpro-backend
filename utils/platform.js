export function platformjson({
  id,
  label,
  comment,
  settings = null
}) {
  return {
    id,
    label,
    comment,
    settings
  };
}