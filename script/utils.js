// Here we have functions shared between most modules

// A hack to measure text, since web is bloody bad
const measure = document.createElement('span');
measure.style.cssText = `
position: absolute;
left: -9999px;
white-space: pre;
`;

// we need this function to exist in the case we clear body
export function appendMeasure() {
  document.body.appendChild(measure);
}

export function measureText(style, text) {
  measure.style.font = style.font;
  measure.style.padding = style.padding;
  measure.textContent = text;
  measure.offsetHeight;
  
  return measure.getBoundingClientRect().width;
}

export function setWidthInPixels(element, width) {
  element.style.setProperty('width', Number(width)+'px');
}

export function setBackgroundColor(element, color) {
  element.style.setProperty('background-color', color);
}

export function digitise(string) {
  return string.replace(/\D/g, '');
}

export function createTextInput(placeholder) {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  return input;
}

export function setNameAndIdentifier(button, name, identifier) {
  button._data_identifier = identifier;
  let span = document.createElement('span');
  span.textContent = name;
  button.appendChild(span);
  span = document.createElement('span');
  span.classList = 'color-grey';
  span.textContent = '#'+identifier;
  button.appendChild(span);
}
export function throwIfNotOk(response) {
  if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
}
