import { clone } from "./state.mjs";
import { test } from "./conditions.mjs";

export const PHOTO_LIMIT = 12;
export const PHOTO_BYTES = 180000;

export function validPhoto(photo) {
  return (
    !!photo &&
    typeof photo.data === "string" &&
    photo.data.length <= PHOTO_BYTES &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(
      photo.data,
    ) &&
    Number.isInteger(photo.width) &&
    photo.width > 0 &&
    photo.width <= 480 &&
    Number.isInteger(photo.height) &&
    photo.height > 0 &&
    photo.height <= 480
  );
}

export function evidenceEntry(state, id) {
  return (state.evidence[id] ||= {
    observed: false,
    holder: "scene",
    history: [],
    photos: [],
  });
}

export function handleEvidence(
  state,
  definition,
  id,
  operation,
  payload = {},
  context = {},
) {
  const spec = definition.evidence[id];
  if (!spec) throw new Error(`Unknown exhibit: ${id}`);
  if (operation !== "transfer" && !test(spec.requires, state, context))
    throw new Error(
      spec.blocked || "Establish the prerequisites for this evidence first.",
    );
  const item = evidenceEntry(state, id);
  const entry = {
    handler: payload.handler || "player",
    scene: state.scene,
    time: state.seconds,
    operation,
  };
  if (operation === "record") {
    item.observed = true;
    item.holder = "notebook";
    const facts = spec.facts || { seen: `${id}:seen`, bag: `${id}:bag` };
    state.facts[facts.seen] = true;
    state.facts[facts.bag] = true;
  } else if (operation === "inspect") item.observed = true;
  else if (operation === "photo") {
    const image = payload.photo;
    if (!validPhoto(image))
      throw new Error(
        "The camera did not produce a usable image. Photograph the exhibit again.",
      );
    if (item.holder !== "scene")
      throw new Error("Photograph the exhibit before moving it.");
    const photos = Object.values(state.evidence).flatMap((e) => e.photos || []);
    if (photos.length >= PHOTO_LIMIT)
      throw new Error(
        `The field album holds ${PHOTO_LIMIT} photographs. The album limit has been reached for this case.`,
      );
    item.photos.push({
      id: `${id}:${item.photos.length}`,
      ...clone(image),
      target: id,
      scene: state.scene,
      camera: clone(payload.camera || { x: state.player.x, y: state.player.y }),
      time: state.seconds,
      storage: "session",
    });
    item.legacyPhoto = false;
  } else if (operation === "bag") {
    item.holder = payload.holder || "player";
    state.inventory[id] = {
      holder: item.holder,
      count: 1,
      kind: spec.kind || "physical",
    };
  } else if (operation === "transfer") {
    if (!payload.holder) throw new Error("A destination holder is required.");
    item.holder = payload.holder;
    state.inventory[id] = { ...state.inventory[id], holder: payload.holder };
  } else throw new Error(`Unknown evidence operation: ${operation}`);
  item.history.push(entry);
}

/** Must be called on the world canvas before collection; HUD/DOM are intentionally excluded. */
export function captureWorldPhoto(canvas, meta = {}) {
  try {
    const thumbnail = canvas.ownerDocument.createElement("canvas");
    thumbnail.width = 320;
    thumbnail.height = Math.max(
      1,
      Math.round((320 * canvas.height) / canvas.width),
    );
    if (thumbnail.height > 480) {
      thumbnail.height = 480;
      thumbnail.width = Math.round((480 * canvas.width) / canvas.height);
    }
    thumbnail
      .getContext("2d")
      .drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
    return {
      ...meta,
      width: thumbnail.width,
      height: thumbnail.height,
      data: thumbnail.toDataURL("image/jpeg", 0.65),
    };
  } catch {
    return null;
  }
}
