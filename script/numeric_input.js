import * as Utils from './utils.js';
export var numeric_input = {
  element: document.createElement('input'),
  endOfWriting: null,
  replace(button) {
    button.replaceWith(numeric_input.element);
    numeric_input.element.focus();
  },
  swapBackAndSetContent(button) {
    button.textContent = numeric_input.element.value || '\u00A0';
    numeric_input.element.replaceWith(button);
  },
};

numeric_input.element.type = 'text';
numeric_input.element.className = 'std-min txt-center tiny-input';
Utils.setWidthInPixels(numeric_input.element, 0);

numeric_input.element.addEventListener('input', () => {
  numeric_input.element.value = Utils.digitise(numeric_input.element.value);
  const width = Utils.measureText(window.getComputedStyle(numeric_input.element), numeric_input.element.value)+2;
  Utils.setWidthInPixels(numeric_input.element, width);
});

function end() {
  numeric_input.endOfWriting();
  numeric_input.endOfWriting = null;
  numeric_input.element.value = '';
}
numeric_input.element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    end();
  }
});
numeric_input.element.addEventListener('blur', () => {
  end();
});

