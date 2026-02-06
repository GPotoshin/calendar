import * as Utils from './utils.js';
export var numeric_input = {
  elm: document.createElement('input'),
  endOfWriting: null,
  replace(b) {
    b.replaceWith(numeric_input.elm);
    numeric_input.elm.focus();
  },
  swapBackAndSetContent(b) {
    b.textContent = numeric_input.elm.value || '\u00A0';
    numeric_input.elm.replaceWith(b);
  },
};

numeric_input.elm.type = 'text';
numeric_input.elm.className = 'std-min txt-center tiny-input';
Utils.setWidthPx(numeric_input.elm, 0);

numeric_input.elm.addEventListener('input', () => {
  numeric_input.elm.value = Utils.digitise(numeric_input.elm.value);
  const w = Utils.measureText(window.getComputedStyle(numeric_input.elm), numeric_input.elm.value)+2;
  Utils.setWidthPx(numeric_input.elm, w);
});

function end() {
  numeric_input.endOfWriting();
  numeric_input.endOfWriting = null;
  numeric_input.elm.value = '';
}
numeric_input.elm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    end();
  }
});
numeric_input.elm.addEventListener('blur', () => {
  end();
});

