/** Game files (catalogue, audio) live next to index.html; paths are relative to the game folder. */
const ROOT = new URL('../', import.meta.url);

export async function resource(path) {
  const key = String(path).replace(/^\.?\//, '');
  const response = await fetch(new URL(key, ROOT));
  if (!response.ok) throw new Error('The asset could not be loaded: ' + key);
  return response;
}
export async function resourceJSON(path) {
  return (await resource(path)).json();
}
export async function resourceBuffer(path) {
  return (await resource(path)).arrayBuffer();
}
