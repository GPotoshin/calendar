const measure = document.createElement('span');
measure.style.cssText = `
position: absolute;
visibility: hidden;
white-space: pre;
`;
document.body.appendChild(measure);

export function measureText(style, text) {
  measure.style.font = style.font;
  measure.style.padding = style.padding;
  measure.textContent = text;
  return measure.offsetWidth;
}

export function setWidthPx(e, w) {
  e.style.setProperty('--width', Number(w)+'px');
}

export function setBgColor(e, c) {
  e.style.setProperty('--bg-color', c);
}

export function digitise(s) {
  return s.replace(/\D/g, '');
}

export function createTextInput(placeholder) {
  const i = document.createElement('input');
  i.type = 'text';
  i.placeholder = placeholder;
  return i;
}
