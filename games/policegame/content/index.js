import pier17 from './pier17/harbor-watch.js';
import nightSignal from './night-signal/definition.js';
import deadLetter from './dead-letter/definition.js';
export const cases = [pier17, nightSignal, deadLetter];
export const getCase = id => cases.find(c => c.id === id);
