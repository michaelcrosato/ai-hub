/** No player reference is allowed here. The brain only knows supplied evidence. */
export class EnemyBrain {
  constructor() {
    this.state = 'roam';
    this.target = null;
    this.memory = null;
    this.stateTime = 0;
    this.unseenTime = 0;
    this.witnessLocker = null;
  }
  update(dt, input) {
    this.stateTime += dt;
    if (input.sight) {
      this.target = copy(input.sight);
      this.memory = copy(input.sight);
      this.unseenTime = 0;
      if (this.state !== 'chase') this.change('chase');
      return;
    }
    this.unseenTime += dt;
    if (input.sound && (this.state !== 'chase' || this.unseenTime > 1.5)) {
      this.target = copy(input.sound);
      this.memory = copy(input.sound);
      if (this.state !== 'investigate') this.change('investigate');
    }
    if (this.state === 'chase' && this.unseenTime > 3.5) {
      this.target = this.memory ? copy(this.memory) : null;
      this.change('investigate');
    } else if (this.state === 'investigate' && input.reached) {
      this.change('search');
      this.target = null;
    } else if (this.state === 'search' && this.stateTime > 13) {
      this.change('roam');
      this.target = null;
      this.witnessLocker = null;
    }
  }
  setTarget(target) {
    this.target = copy(target);
  }
  change(state) {
    this.state = state;
    this.stateTime = 0;
  }
}

function copy(value) {
  return { node: value.node, position: [...value.position] };
}
