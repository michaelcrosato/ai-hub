import { GRAPHICS_CONTROLS, formatSetting } from '../engine/settings.js';

/** Keep the panel and renderer on the same settings schema. */
export function mountGraphicsPanel(container, getValues, onChange, signal, getContext = () => ({})) {
  const entries = new Map(); let group = null, section;
  for (const control of GRAPHICS_CONTROLS) {
    if (control.group !== group) {
      group = control.group;
      section = document.createElement('details'); section.className = 'graphics-group';
      section.open = group === 'Image' || group === 'Light';
      const summary = document.createElement('summary'); summary.textContent = group;
      section.append(summary); container.append(section);
    }
    const label = document.createElement('label'), text = document.createElement('span'), output = document.createElement('output');
    const input = document.createElement('input'); input.type = 'range'; input.id = `graphics-${control.key}`;
    input.dataset.graphics = control.key; label.htmlFor = input.id; label.className = 'range-label';
    text.textContent = control.label; output.htmlFor = input.id; output.id = `${input.id}-value`;
    label.append(text, output);
    input.min = control.values ? 0 : control.min; input.max = control.values ? control.values.length - 1 : control.max;
    input.step = control.values ? 1 : control.step;
    input.addEventListener('input', () => {
      const value = control.values ? control.values[Number(input.value)] : Number(input.value);
      onChange(control.key, value);
    }, { signal });
    section.append(label, input); entries.set(control.key, { control, input, output });
  }
  function sync() {
    const values = getValues(), context = getContext();
    for (const [key, { control, input, output }] of entries) {
      const index = control.values ? Math.max(0, control.values.indexOf(values[key])) : values[key];
      input.value = index;
      const text = formatSetting(control, values[key], context); output.textContent = text; input.setAttribute('aria-valuetext', text);
    }
  }
  sync(); return { sync };
}
