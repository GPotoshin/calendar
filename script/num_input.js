import * as Utils from './utils.js';
export var numInput = {
  elm: document.createElement('input'),
  endOfWriting: null,
};

numInput.elm.type = 'text';
numInput.elm.className = 'std-min txt-center tiny-input';
Utils.setWidthPx(numInput.elm, 0);

numInput.elm.addEventListener('input', () => {
  numInput.elm.value = Utils.digitise(numInput.elm.value);
  const w = Utils.measureText(window.getComputedStyle(numInput.elm), numInput.elm.value)+2;
  Utils.setWidthPx(numInput.elm, w);
});

function end() {
  numInput.endOfWriting();
  numInput.endOfWriting = null;
  numInput.elm.value = '';
}
numInput.elm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    end();
  }
});
numInput.elm.addEventListener('blur', () => {
  end();
});
