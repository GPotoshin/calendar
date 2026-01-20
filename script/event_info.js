import { data, listId, zones, zonesId, tmpls, scopeId } from './global_state.js';
import * as SearchDisplay from './search_display.js';
import * as Utils from './utils.js';
import { numInput } from './num_input.js';
import { BufferWriter } from './io.js';
import * as Api from './api.js';

export const elms = {
  event_role_list: null,
  comp_tables: null,
  numtab_header_list: null,
  numtab_content: null,
};

function createStaffTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');
  const columnWidth = 125;

  table.innerHTML = `
    <h3 class="txt-center">Nombre de</h3>
    <div class="h-container with-width align-items-center">
    </div>

    <div id="event-staff-number-map" class="m-box with-width v-container scrollable-box disp-flex grow scroll-smooth bordered">
    </div>
    `;
  
  elms.numtab_header_list = table.children[1];
  elms.numtab_content = table.children[2];
  elms.numtab_content._id = listId.NUMMAP;
  return table;
}

function createCompetencesTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');
  table.innerHTML = `
    <div class="v-container align-items-center">
    <h3 class="txt-center">Competences de</h3>

    <div class="js-set h-container align-items-center">
    </div>
    `;

  const container = table.querySelector('.js-set');
  elms.comp_tables = container;

  return table;
}

function createFooterOptions() {
  let footer = document.createElement('div');
  footer.className = 'h-container';
  footer.innerHTML = `
    <div class="row-selection">
    Durée: <button id="event-duration" class="hover std-min no-padding txt-center tiny-button">\u00A0</button>d
    </div>
    `;
  return footer;
}

export function loadTemplate() {
  tmpls[scopeId.EVENT].innerHTML = `
    <div class="v-container">
    </div>
  `;

  let [sDisplay, container] = SearchDisplay.createAndReturnListContainer('Personel', listId.EVENT_STAFF);
  container._btnList = [];

  for (const [id, idx] of data.rolesId) {
    const name = data.rolesName[idx];
    const b = SearchDisplay.createButton(); 
    Utils.setNameAndId(b, name, id);
    container.appendChild(b);
    container._btnList.push(b);
  }
  elms.event_role_list = container;

  tmpls[scopeId.EVENT].children[0].append(
    sDisplay,
    createStaffTable(),
    createCompetencesTable(),
    createFooterOptions(),
  );
}

export function update() { // @working
  // scoped functions
  const participant_num_field_html = `
    <div class="with-padding num-field align-items-center justify-content-center">
    de <button class="std-min hover no-padding txt-center tiny-button">
    </button> à <button class="std-min hover no-padding txt-center tiny-button"></button>
    </div>
    `;
  const staff_num_field_html = `
    <div class="num-field with-padding">
    <button class="hover std-min no-padding txt-center tiny-button"></button>
    </div>
    `;

  const zone = zones[zonesId.EVENTLIST];
  if (zone.selection == null) { // we need to show general setting
    return;
  }
  const event_id = zone.selection._dataId;
  const event_idx = data.eventsId.get(event_id);
  const event_roles = data.eventsRole[event_idx];
  const num_map = data.eventsPersonalNumMap;

  function createTemplateLine(staff_num) {
    let line = document.createElement('div');
    line.className = 'h-container align-items-center wide';
    line.innerHTML = participant_num_field_html+staff_num_field_html.repeat(staff_num);
    for (let i = 0; i < line.children.length-1; i++) {
      line.children[i].classList.add('right-border');
    }
    return line;
  }

  function swapButtonBack(b) {
    b.textContent = numInput.elm.value || '\u00A0';
    numInput.elm.replaceWith(b);
  }

  function evolveButton(b) {
    b.classList.add('editable');
    b.removeEventListener('click', btns[j]._clickCallback);
    b._clickCallback = null;
  }

  function getNumVal(b) {
    return Number(b.textContent);
  }

  function endOfButtonWriting(b, line_idx) {
    swapButtonBack(b);
    if (b.textContent !== '\u00A0') {
      const n = getNumVal(b);
      let w = Api.createBufferWriter(Api.UPDATE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(event_id);
      w.writeInt32(line_idx);
      w.writeInt32(b._dIdx);
      w.writeInt32(n);
      Api.request(w)
      .then(resp => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        evolveButton(b);
        num_map[event_idx][line_idx][b._dIdx] = n;
      })
      .catch(e => {
        console.error('Could not store num_map button');
      });
    }
  }

  function endOfLineWriting(staff_num, b, line, btns) {
    swapButtonBack(b);

    let dataIsSet = true;
    for (let _b of btns) {
      if (_b.textContent == '\u00A0') {
        dataIsSet = false;
        break;
      }
    };
    if (dataIsSet) {
      line.classList.add('deletable');
      line._dIdx = num_map[event_idx].length;
      // we need to make an API store request here
      let w = Api.createBufferWriter(Api.CREATE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(event_id);
      w.writeInt32(btns.length);
      let data = [];
      for (let j = 0; j < btns.length; j++) {
        btns[j]._dIdx = j;
        evolveButton(btns[j]);
        const n = getNumVal(btns[j]);
        w.writeInt32(n);
        data.push(n);
      }
      Api.request(w)
      .then(resp => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        num_map[event_idx].push(data);
      })
      .catch(e => {
        line.remove();
        console.error('Could not store num_map line');
      });
      addEmptyLine(staff_num);
    }
  }

  function setEmptyBtn(b, clickCallback) {
    b.textContent = '\u00A0';
    b.className = 'std-min hover no-padding txt-center tiny-button';
    b._clickCallback = clickCallback;
    b.addEventListener('click', clickCallback)
  }

  function swapBtn(b) {
    b.replaceWith(numInput.elm);
    numInput.elm.focus();
  }

  function setClickCallback(b, callback) {
    b._clickCallback = callback;
    b.addEventListener('click', callback)
  }

  function addEmptyLine(staff_num) {
    let line = createTemplateLine(staff_num);
    const btns = line.querySelectorAll('button');
    for (const b of btns) {
      setEmptyBtn(b, () => {
        swapBtn(b);
        numInput.endOfWriting = () => {
          endOfLineWriting(staff_num, b, line, btns)
        };
      });
    };
    elms.numtab_content.appendChild(line);
  }

  // actual function code
  for (const b of elms.event_role_list._btnList) {
    if (event_roles.includes(b._dataId)) {
      b.classList.add('clicked');
    } else {
      b.classList.remove('clicked');
    }
  }

  // nummap
  const base_width = 125;
  let width = base_width*(event_roles.length+1);
  Utils.setWidthPx(elms.numtab_header_list, width);
  Utils.setWidthPx(elms.numtab_content, width);

  function createLocalHeader(name) {
    let retval = document.createElement('div');
    retval.className = 'disp-flex with-width justify-content-center';
    Utils.setWidthPx(retval, width);
    let header = document.createElement('h4');
    header.className = 'txt-center';
    header.textContent = name;
    retval.append(header);
    return retval;
  }
  // @nocheckin: we will need to merge all those iterations together
  let list = [createLocalHeader('Participant')];
  for (const role_id of event_roles) {
    const role_idx = data.rolesId.get(role_id);
    const name = data.rolesName[role_idx];
    list.push(createLocalHeader(name));
  }
  elms.numtab_header_list.replaceChildren(...list);

  list = [];
  for (let i = 0; i < num_map[event_idx].length; i++) {
    let line = createTemplateLine(event_roles.length);
    line.classList.add('deletable');
    const btns = line.querySelectorAll('button');
    line._dataId = i;
    for (let j = 0; j < btns.length; j++) {
      let b = btns[j];
      b._dataId = j;
      const val = num_map[event_idx][i][j];
      if (val === -1) {
        setEmptyBtn(b, () => {
          swpaBtn(b);
          numInput.endOfWriting = () => {
            endOfButtonWriting(b, i);
          }
        }); 
      } else {
        b.textContent = val;
      }
    };
    list.push(line);
  }
  elms.numtab_content.replaceChildren(...list);
  addEmptyLine(event_roles.length); // idea is that addEmptyLine will add a line directly to the dom

  list = [SearchDisplay.create('Participant', listId.COMPETENCES)];
  for (const role_id of event_roles) {
    const role_idx = data.rolesId.get(role_id);
    const name = data.rolesName[role_idx];
    list.push(SearchDisplay.create(name, listId.COMPETENCES));
  }
  elms.comp_tables.replaceChildren(...list);

  let duration = data.eventsDuration[event_idx];
  if (duration === undefined) {
    data.eventsDuration[_eventId] = -1;
    duration = -1;
  }

  let b = tmpls[scopeId.EVENT].querySelector('#event-duration');
  if (duration === -1) {
    b.textContent = '\u00A0';

    function localCallback() {
      b.replaceWith(numInput.elm);
      numInput.elm.focus();
      numInput.endOfWriting = () => { endOfWriting() };
    }

    function endOfWriting() {
      numInput.elm.replaceWith(b);
      const _eventId = zones[zonesId.EVENTLIST].selection._dataId;
      if (numInput.elm.value === '') {
        data.eventsDuration[_eventId] = -1;
        return;
      }
      b.textContent = numInput.elm.value;
      data.eventsDuration[_eventId] = Number(numInput.elm.value);
      b.classList.add('editable');
      b.removeEventListener('click', localCallback);
    }
    b.addEventListener('click', localCallback);
  } else {
    b.textContent = duration;
    b.classList.add('editable');
  }
}
