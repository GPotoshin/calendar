import { zonesId } from './global_state.js';
import * as Utils from './utils.js';

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
      if (pattern_index > 0 && matches[patternIdx - 1] === text_index - 1) {
        consecutiveMatches++;
        score += 5 + consecutiveMatches;
      } else {
        consecutiveMatches = 0;
        score += 1;
      }
      if (text_index === 0 || text[textIdx - 1] === ' ') {
        score += 10;
      }
      if (text[text_index] === text[textIdx].toUpperCase() && text[textIdx] !== ' ') {
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

function updateList(input, container) {
  const query = input.value;
  if (!query) {
    container.innerHTML = '';
    for (const b of container._btn_list) {
      container.append(b);
    }
    return;
  }
  const scored = [];
  for (const b of container._btn_list) {
    const score = fuzzyMatch(query, b.textContent);
    if (score !== null) {
      scored.push({ btn: b, score: score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  container.innerHTML = '';
  for (const item of scored) {
    container.append(item.btn);
  }
}

export function createButton(name = '') {
  let b = document.createElement('button');
  b.className = 'hover search-list-button togglable deletable';
  b.textContent = name;
  return b;
}

export function createAndReturnListContainer(name, id) {
  let menu = document.createElement('div');

  menu.className = 'm-box v-container align-items-center';
  menu.innerHTML = `
    <h4 class="js-set txt-center">Personnel</h4>
    <div class="h-container">
      <div class="searching-field h-container disp-flex grow"><div class="arrow">></div><input class="searching-input" type="text" placeholder="Trouver"></input></div>
    </div>
    <div class="h-container grow">
    <div class="js-set text-box v-container scrollable-box scroll bordered grow half-wide extendable"></div>
    </div>
    `;
  const objList = menu.querySelectorAll('.js-set');
  const searchInput = menu.querySelector('.searching-input');
  objList[0].textContent = name;
  const container = objList[1];
  Utils.setWidthPx(menu.children[1], 200);
  Utils.setWidthPx(menu.children[2], 200);
  objList[1]._id = zonesId.EVENTSTAFF;

  searchInput.addEventListener('input', () => { updateList(searchInput, container); });
  return [menu, objList[1]];
}

export function create(name, id) {
  let [menu, ] = createAndReturnListContainer(name, id);
  return menu;
}

export function dynamise(menu, btnPlaceholder = '') {
  const objList = menu.querySelectorAll('.js-set');
  const searchInput = menu.querySelector('.searching-input');
  const container = objList[1];
  Utils.setWidthPx(menu.children[1], 200);
  Utils.setWidthPx(menu.children[2], 200);
  if (btnPlaceholder != '') {
    objList[1]._btnPlaceholder = btnPlaceholder;
  }

  searchInput.addEventListener('input', () => { updateList(searchInput, container); });
}
