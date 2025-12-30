function fuzzyMatch(pattern, text) {
  pattern = pattern.toLowerCase();
  text = text.toLowerCase();
  let patternIdx = 0;
  let textIdx = 0;
  let score = 0;
  let consecutiveMatches = 0;
  const matches = [];
  while (patternIdx < pattern.length && textIdx < text.length) {
    if (pattern[patternIdx] === text[textIdx]) {
      matches.push(textIdx);
      if (patternIdx > 0 && matches[patternIdx - 1] === textIdx - 1) {
        consecutiveMatches++;
        score += 5 + consecutiveMatches;
      } else {
        consecutiveMatches = 0;
        score += 1;
      }
      if (textIdx === 0 || text[textIdx - 1] === ' ') {
        score += 10;
      }
      if (text[textIdx] === text[textIdx].toUpperCase() && text[textIdx] !== ' ') {
        score += 5;
      }
      patternIdx++;
    }
    textIdx++;
  }
  if (patternIdx !== pattern.length) {
    return null;
  }
  score -= (text.length - pattern.length) * 0.5;
  return score;
}

function updateList(input, container) {
  const query = input.value;
  if (!query) {
    container.innerHTML = '';
    for (const b of container._btnList) {
      container.append(b);
    }
    return;
  }
  const scored = [];
  for (const b of container._btnList) {
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

function createButton(name = '') {
  let b = document.createElement('button');
  b.classList.add('hover', 'snap-start', 'togglable');
  b.textContent = name;
  return b;
}

export function create(name, btnPlaceholder) {
  let menu = document.createElement('div');

  menu.className = 'm-box v-container align-items-center';
  menu.innerHTML = `
    <h4 class="js-set txt-center">Personnel</h4>
    <div class="h-container with-width">
    <div class="searching-field h-container disp-flex grow"><div class="arrow">></div><input class="searching-input" type="text" placeholder="Trouver"></input></div>
    </div>
    <div class="h-container with-width grow">
    <div class="js-set text-box v-container scrollable-box scroll bordered grow half-wide extendable">
    </div>
    </div>
    `;
  const objList = menu.querySelectorAll('.js-set');
  const searchInput = menu.querySelector('.searching-input');
  objList[0].textContent = name;
  const container = objList[1];
  menu.children[1].style.setProperty('--width', '200px');
  menu.children[2].style.setProperty('--width', '200px');
  objList[1]._createButton = createButton;
  objList[1]._btnPlaceholder = btnPlaceholder;

  searchInput.addEventListener('input', () => { updateList(searchInput, container); });
  return menu;
}

