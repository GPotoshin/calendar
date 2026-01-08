import * as Utils from './utils.js';
export var numInput = {
  elm: document.createElement('input'),
  endOfWriting: null,
};

numInput.elm.type = 'text';
numInput.elm.className = 'with-width std-min txt-center tiny-input';
numInput.elm.style.setProperty('--width', 0+'px');

numInput.elm.addEventListener('input', () => {
  numInput.elm.value = numInput.elm.value.replace(/\D/g, '');
  const w = Utils.measureText(window.getComputedStyle(numInput.elm), numInput.elm.value)+2;
  Utils.setWidthPx(numInput, w);
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
