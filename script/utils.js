// Here we have functions shared between most modules

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
  e.style.setProperty('width', Number(w)+'px');
}

export function setBgColor(e, c) {
  e.style.setProperty('background-color', c);
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

export function setNameAndId(b, name, id) {
  b._dataId = id;
  let span = document.createElement('span');
  span.textContent = name;
  b.appendChild(span);
  span = document.createElement('span');
  span.classList = 'color-grey';
  span.textContent = '#'+id;
  b.appendChild(span);
}
