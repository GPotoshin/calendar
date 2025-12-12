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
