/** Serializable item operations. Item IDs are stable strings, never display indexes. */
export function addItem(state, id) {
  if (!state.inventory.includes(id)) state.inventory.push(id);
}
export function removeItem(state, id) {
  state.inventory = state.inventory.filter((item) => item !== id);
}
export function itemUses(definition, state, target, condition = () => true) {
  return (definition.items || []).flatMap((item) =>
    state.inventory.includes(item.id)
      ? (item.uses || []).filter((use) => use.target === target).map((use, index) => ({
          ...use, id: use.id || String(index), item: item.id,
          label: use.label || `Use ${item.name || item.id}`,
          disabled: !condition(use.when),
        }))
      : [],
  );
}
