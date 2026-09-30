/** Immutable document history. Runtime bodies never become the authoring source. */
export class History {
  capacity;
  entries;
  cursor = 0;
  constructor(initial, capacity = 80) {
    this.capacity = capacity;
    this.entries = [structuredClone(initial)];
  }
  get current() {
    return structuredClone(this.entries[this.cursor]);
  }
  get canUndo() {
    return this.cursor > 0;
  }
  get canRedo() {
    return this.cursor < this.entries.length - 1;
  }
  commit(value) {
    if (JSON.stringify(value) === JSON.stringify(this.entries[this.cursor])) return false;
    this.entries.splice(this.cursor + 1);
    this.entries.push(structuredClone(value));
    if (this.entries.length > this.capacity) this.entries.shift();
    this.cursor = this.entries.length - 1;
    return true;
  }
  undo() {
    if (this.canUndo) this.cursor--;
    return this.current;
  }
  redo() {
    if (this.canRedo) this.cursor++;
    return this.current;
  }
}
