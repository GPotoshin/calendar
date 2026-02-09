import { data, zones, zones_identifier } from './global_state.js';
import * as SearchDisplay from './search_display.js';
import * as Utils from './utils.js';
import { numeric_input } from './numeric_input.js';
import { BufferWriter } from './io.js';
import * as Api from './api.js';
import * as EventInformation from './event_info.js';

export let dom = document.createElement('div');

export const elements = {
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
    <div class="h-container align-items-center">
    </div>

    <div id="event-staff-number-map" class="m-box v-container scrollable-box disp-flex grow scroll-smooth bordered">
    </div>
    `;
  
  elements.numtab_header_list = table.children[1];
  elements.numtab_content = table.children[2];
  elements.numtab_content._identifier = zones_identifier.PERSONAL_NUMBER_MAP;
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
  elements.comp_tables = container;

  return table;
}

function createFooterOptions() {
  let footer = document.createElement('div');
  footer.className = 'h-container';
  footer.innerHTML = `
    <div class="row-selection">
    Durée: <button id="event-duration" class="hover std-min no-padding txt-center tiny-button">\u00A0</button>j
    </div>
    `;
  footer.children[0]._identifier = zones_identifier.DURATION;
  return footer;
}

export function loadTemplate() {
  EventInformation.dom.innerHTML = `
    <div class="v-container">
    </div>
  `;

  let [sDisplay, container] = SearchDisplay.createAndReturnListContainer('Personnel', zones_identifier.EVENT_STAFF);
  container._btn_list = [];

  for (const [id, idx] of data.roles_idetifier) {
    const name = data.roles_name[idx];
    const b = SearchDisplay.createButton(); 
    Utils.setNameAndId(b, name, id);
    container.appendChild(b);
    container._btn_list.push(b);
  }
  elements.event_role_list = container;

  EventInformation.dom.children[0].append(
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

  const zone = zones[zones_identifier.EVENT];
  if (zone.selection == null) { // we need to show general setting
    return;
  }
  const event_identifier = zone.selection._data_id;
  const event_index = data.events_identifier.get(event_id);
  if (event_index === undefined) { throw new Error("[update] no entry for event_id"); }
  const event_roles = data.events_roles[event_index];
  const num_map = data.events_staff_numeric_map;

  function createTemplateLine(staff_num) {
    let line = document.createElement('div');
    line.className = 'h-container align-items-center wide';
    line.innerHTML = participant_num_field_html+staff_num_field_html.repeat(staff_num);
    for (let i = 0; i < line.children.length-1; i++) {
      line.children[i].classList.add('right-border');
    }
    return line;
  }


  function evolveButton(b) {
    b.classList.add('editable');
    b.removeEventListener('click', b._clickCallback);
    b._clickCallback = null;
  }

  function getNumVal(b) {
    return Number(b.textContent);
  }

  function endOfButtonWriting(b, line_index) {
    numeric_input.swapBackAndSetContent(b);
    if (b.textContent !== '\u00A0') {
      const n = getNumVal(b);
      let w = Api.createBufferWriter(Api.UPDATE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(event_id);
      w.writeInt32(line_index);
      w.writeInt32(b._data_id);
      w.writeInt32(n);
      Api.request(w)
      .then(resp => {
        throwIfRespNotOk(resp);
        evolveButton(b);
        num_map[event_index][line_index][b._data_id] = n;
      })
      .catch(e => {
        console.error('Could not store num_map button');
      });
    }
  }

  function endOfLineWriting(staff_num, b, line, btns) {
    numeric_input.swapBackAndSetContent(b);

    let data_is_set = true;
    for (let button of btns) {
      if (button.textContent == '\u00A0') {
        data_is_set = false;
        break;
      }
    };
    if (data_is_set) {
      line.classList.add('deletable');
      line._data_id = num_map[event_index].length;
      // we need to make an API store request here
      let w = Api.createBufferWriter(Api.CREATE, Api.EVENTS_PERSONAL_NUM_MAP_ID);
      w.writeInt32(event_id);
      w.writeInt32(btns.length);
      let data = [];
      for (let j = 0; j < btns.length; j++) {
        btns[j]._data_id = j;
        evolveButton(btns[j]);
        const n = getNumVal(btns[j]);
        w.writeInt32(n);
        data.push(n);
      }
      Api.request(w)
      .then(resp => {
        throwIfRespNotOk(resp);
        num_map[event_index].push(data);
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

  function setClickCallback(b, callback) {
    b._clickCallback = callback;
    b.addEventListener('click', callback)
  }

  function addEmptyLine(staff_num) {
    let line = createTemplateLine(staff_num);
    const btns = line.querySelectorAll('button');
    for (const b of btns) {
      setEmptyBtn(b, () => {
        numeric_input.replace(b);
        numeric_input.endOfWriting = () => {
          endOfLineWriting(staff_num, b, line, btns)
        };
      });
    };
    elements.numtab_content.appendChild(line);
  }

  // actual function code
  for (const b of elements.event_role_list._btn_list) {
    if (event_roles.includes(b._data_id)) {
      b.classList.add('clicked');
    } else {
      b.classList.remove('clicked');
    }
  }

  // nummap
  const base_width = 125;
  let width = base_width*(event_roles.length+1);
  Utils.setWidthInPixels(elements.numtab_header_list, width);
  Utils.setWidthInPixels(elements.numtab_content, width);

  function createLocalHeader(name) {
    let retval = document.createElement('div');
    retval.className = 'disp-flex justify-content-center';
    Utils.setWidthInPixels(retval, width);
    let header = document.createElement('h4');
    header.className = 'txt-center';
    header.textContent = name;
    retval.append(header);
    return retval;
  }
  // @nocheckin: we will need to merge all those iterations together
  let list = [createLocalHeader('Participants')];
  for (const role_identifier of event_roles) {
    const role_index = data.roles_idetifier.get(role_id);
    if (role_index === undefined) { throw new Error('Can find role_id') }
    const name = data.roles_name[role_index];
    list.push(createLocalHeader(name));
  }
  elements.numtab_header_list.replaceChildren(...list);

  list = [];
  for (let i = 0; i < num_map[event_index].length; i++) {
    let line = createTemplateLine(event_roles.length);
    line.classList.add('deletable');
    const btns = line.querySelectorAll('button');
    line._data_id = i;
    for (let j = 0; j < btns.length; j++) {
      let b = btns[j];
      b._data_id = j;
      const val = num_map[event_index][i][j];
      if (val === -1) {
        setEmptyBtn(b, () => {
          numeric_input.replace(b);
          numeric_input.endOfWriting = () => {
            endOfButtonWriting(b, i);
          }
        }); 
      } else {
        b.textContent = val;
      }
    };
    list.push(line);
  }
  elements.numtab_content.replaceChildren(...list);
  addEmptyLine(event_roles.length); // idea is that addEmptyLine will add a line directly to the dom

  list = [SearchDisplay.create('Participants', zones_identifier.COMPETENCES)];
  for (const role_identifier of event_roles) {
    const role_index = data.roles_idetifier.get(role_id);
    if (role_index === undefined) { throw new Error("Can't find role_id") }; 
    const name = data.roles_name[role_index];
    list.push(SearchDisplay.create(name, zones_identifier.COMPETENCES));
  }
  elements.comp_tables.replaceChildren(...list);

  let duration = data.events_duration[event_index];
  if (duration === undefined) {
    data.events_duration[_eventId] = -1;
    duration = -1;
  }

  let button = EventInformation.dom.querySelector('#event-duration');
  function localCallback() {
    button.replaceWith(numeric_input.element);
    numeric_input.element.focus();
    numeric_input.endOfWriting = endOfWriting;
  }

  function endOfWriting() {
    const new_duration = Number(numeric_input.element.value);
    button.textContent = numeric_input.element.value | '\u00A0';
    numeric_input.element.replaceWith(button);
    const event_identifier = zones[zones_identifier.EVENT].selection._data_id;
    const event_index = data.events_identifier.get(event_id);
    if (event_index === undefined) { throw new Error('[updating duration]: event_identifier does not exist'); }
    if (numeric_input.element.value === '') {
      data.events_duration[event_id] = -1;
      return;
    }
    let buffer_writer = createDurationBuffer(new_duration, Api.CREATE, event_id);
    Api.request(buffer_writer)
    .then(response => {
      Utils.throwIfNotOk(response);
      data.events_duration[event_index] = duration;
      button.classList.add('editable');
      button.removeEventListener('click', localCallback);
    })
    .catch(e => {
      button.textContent = '\u00A0'
    });
  };

  if (duration === -1) {
    button.textContent = '\u00A0';
    button.classList.remove('editable');
    button.addEventListener('click', localCallback);
  } else {
    button.removeEventListener('click', localCallback);
    button.textContent = duration;
    button.classList.add('editable');
  }
}

export function createDurationBuffer(duration, mode, event_id) {
  if (duration < 0 || duration > 1024) {
    console.error("value of duration should be in 1..1024"); 
    return;
  }
  let w = Api.createBufferWriter(Api.UPDATE, Api.EVENTS_DURATION_ID);
  w.writeInt32(event_id);
  w.writeInt32(duration);
  return w;
}
