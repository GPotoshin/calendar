import { zones_identifier } from './global.js';
import * as Utilities from './utilities.js';

function fuzzyMatch(pattern, text) {
  pattern = pattern.toLowerCase();
  text = text.toLowerCase();
  let pattern_index = 0;
  let text_index = 0;
  let score = 0;
  let consecutiveMatches = 0;
  const matches = [];
  while (pattern_index < pattern.length && text_index < text.length) {
    if (pattern[pattern_index] === text[text_index]) {
      matches.push(text_index);
      if (pattern_index > 0 && matches[pattern_index - 1] === text_index - 1) {
        consecutiveMatches++;
        score += 5 + consecutiveMatches;
      } else {
        consecutiveMatches = 0;
        score += 1;
      }
      if (text_index === 0 || text[text_index - 1] === ' ') {
        score += 10;
      }
      if (text[text_index] === text[text_index].toUpperCase() && text[text_index] !== ' ') {
        score += 5;
      }
      pattern_index++;
    }
    text_index++;
  }
  if (pattern_index !== pattern.length) {
    return null;
  }
  score -= (text.length - pattern.length) * 0.5;
  return score;
}

export function updateList(input, container, getText) {
  const query = input.value;
  if (!query) {
    container.innerHTML = '';
    for (const button of container._button_list) {
      container.append(button);
    }
    return;
  }
  const scored = [];
  for (const button of container._button_list) {
    const score = fuzzyMatch(query, getText(button));
    if (score !== null) {
      scored.push({ button: button, score: score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  container.innerHTML = '';
  for (const item of scored) {
    container.append(item.button);
  }
}

export function createButton(name = '') {
  let button = document.createElement('button');
  button.className = 'hover search-list-button togglable deletable';
  button.textContent = name;
  return button;
}

export function createTemplate(name, identifier) {
  let menu = document.createElement('div');

  menu.className = 'm-box v-container align-items-center';
  menu.innerHTML = `
    <h4 class="js-set txt-center">Personnel</h4>
    <div class="h-container">
      <div class="searching-field h-container disp-flex grow"><div class="arrow">></div><input class="grow" type="text" placeholder="Trouver"></input></div>
    </div>
    <div class="h-container grow">
    <div class="js-set text-box v-container scrollable-box scroll bordered grow half-wide extendable"></div>
    </div>
    `;
  const objList = menu.querySelectorAll('.js-set');
  const searchInput = menu.querySelector('input');
  objList[0].textContent = name;
  Utilities.setWidthInPixels(menu.children[1], 200);
  Utilities.setWidthInPixels(menu.children[2], 200);
  menu._container = objList[1];
  menu._container._identifier = identifier;

  menu._container._button_list = [];
  searchInput.addEventListener('input', () => {
    updateList(searchInput, menu._container, button => { return button.textContent; } );
  });

  return menu;
}

export function create(name, identifier, meta_data) {
  let menu = createTemplate(name, identifier);

  for (const [identifier, index] of meta_data.map) {
    const name = meta_data.array[index];
    const button = createButton(); 
    button._data_idenetifier = identifier;
    Utilities.setNameAndIdentifier(button, name, identifier);
    menu._container.appendChild(button);
    menu._container._button_list.push(button);
  }

  return menu;
}
