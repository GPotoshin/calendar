import * as Global from './global_state.js';
import * as SearchDisplay from './search_display.js';
import * as Utils from './utils.js';
import { numeric_input } from './numeric_input.js';
import { BufferWriter } from './io.js';
import * as Api from './api.js';
import * as EventInformation from './event_information.js';

export let dom = document.createElement('div');

export const elements = {
  event_role_list: null,
  competences_tables: null,
  numeric_table_header_list: null,
  numeric_table_content: null,
};

function createStaffTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');

  table.innerHTML = `
    <h3 class="txt-center">Nombre de</h3>
    <div class="h-container align-items-center">
    </div>

    <div id="event-staff-number-map" class="m-box v-container scrollable-box disp-flex grow scroll-smooth bordered">
    </div>
    `;
  
  elements.numeric_table_header_list = table.children[1];
  elements.numeric_table_content = table.children[2];
  elements.numeric_table_content._identifier = Global.zones_identifier.PERSONAL_NUMBER_MAP;
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
  elements.competences_tables = container;

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
  footer.children[0]._identifier = Global.zones_identifier.DURATION;
  return footer;
}

export function loadTemplate() {
  EventInformation.dom.innerHTML = `
    <div class="v-container">
    </div>
  `;

  let [search_display, container] = SearchDisplay.createAndReturnListContainer('Personnel', Global.zones_identifier.EVENT_STAFF);
  container._button_list = [];

  for (const [idetifier, index] of Global.data.roles_idetifier) {
    const name = Global.data.roles_name[index];
    const button = SearchDisplay.createButton(); 
    Utils.setNameAndId(b, name, identifier);
    container.appendChild(button);
    container._button_list.push(button);
  }
  elements.event_role_list = container;

  EventInformation.dom.children[0].append(
    search_display,
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

  const zone = Global.zones[Global.zones_identifier.EVENT];
  if (zone.selection == null) { // we need to show general setting
    return;
  }
  const event_identifier = zone.selection._data_identifier;
  const event_index = Global.data.events_identifier.get(event_id);
  if (event_index === undefined) { throw new Error("[update] no entry for event_id"); }
  const event_roles = Global.data.events_roles[event_index];
  const staff_numeric_map = Global.data.events_staff_numeric_map;

  function createTemplateLine(staff_numeric_map) {
    let line = document.createElement('div');
    line.className = 'h-container align-items-center wide';
    line.innerHTML = participant_num_field_html+staff_num_field_html.repeat(staff_numeric_map);
    for (let i = 0; i < line.children.length-1; i++) {
      line.children[i].classList.add('right-border');
    }
    return line;
  }


  function evolveButton(button) {
    button.classList.add('editable');
    button.removeEventListener('click', b._clickCallback);
    button._clickCallback = null;
  }

  function getNumVal(button) {
    return Number(button.textContent);
  }

  function endOfButtonWriting(button, line_index) {
    numeric_input.swapBackAndSetContent(button);
    if (button.textContent !== '\u00A0') {
      const numeric_value = getNumVal(button);
      let writer = Api.createBufferWriter(Api.UPDATE, Api.EVENTS_PERSONAL_NUM_MAP);
      writer.writeInt32(event_identifier);
      writer.writeInt32(line_index);
      writer.writeInt32(button._data_identifier);
      writer.writeInt32(numeric_value);
      Api.request(writer)
      .then(response => {
        throwIfRespNotOk(response);
        evolveButton(button);
        num_map[event_index][line_index][button._data_identifier] = numeric_value;
      })
      .catch(error => {
        console.error('Could not store num_map button: ', error);
      });
    }
  }

  function endOfLineWriting(staff_number_map, button, line, buttons) {
    numeric_input.swapBackAndSetContent(button);

    let data_is_set = true;
    for (let _button of buttons) {
      if (_button.textContent == '\u00A0') {
        data_is_set = false;
        break;
      }
    };
    if (data_is_set) {
      line.classList.add('deletable');
      line._data_identifier = num_map[event_index].length;
      // we need to make an API store request here
      let writer = Api.createBufferWriter(Api.CREATE, Api.EVENTS_PERSONAL_NUM_MAP);
      writer.writeInt32(event_id);
      writer.writeInt32(buttons.length);
      let data = [];
      for (let j = 0; j < buttons.length; j++) {
        buttons[j]._data_identifier = j;
        evolveButton(buttons[j]);
        const n = getNumVal(buttons[j]);
        writer.writeInt32(numeric_value);
        data.push(numeric_value);
      }
      Api.request(w)
      .then(response => {
        throwIfRespNotOk(response);
        num_map[event_index].push(data);
      })
      .catch(error => {
        line.remove();
        console.error('Could not store num_map line: ', error);
      });
      addEmptyLine(staff_numeric_map);
    }
  }

  function setEmptyButton(button, clickCallback) {
    button.textContent = '\u00A0';
    button.className = 'std-min hover no-padding txt-center tiny-button';
    button._clickCallback = clickCallback;
    button.addEventListener('click', clickCallback)
  }

  function setClickCallback(button, callback) {
    button._clickCallback = callback;
    button.addEventListener('click', callback)
  }

  function addEmptyLine(staff_num) {
    let line = createTemplateLine(staff_num);
    const buttons = line.querySelectorAll('button');
    for (const _button of buttons) {
      setEmptyButton(_button, () => {
        numeric_input.replace(_button);
        numeric_input.endOfWriting = () => {
          endOfLineWriting(staff_num, _button, line, buttons)
        };
      });
    };
    elements.numeric_table_content.appendChild(line);
  }

  // actual function code
  for (const _button of elements.event_role_list._button_list) {
    if (event_roles.includes(_button._data_identifier)) {
      _button.classList.add('clicked');
    } else {
      _button.classList.remove('clicked');
    }
  }

  // nummap
  const base_width = 125;
  let width = base_width*(event_roles.length+1);
  Utils.setWidthInPixels(elements.numeric_table_header_list, width);
  Utils.setWidthInPixels(elements.numeric_table_content, width);

  function createLocalHeader(name) {
    let header_container = document.createElement('div');
    header_container.className = 'disp-flex justify-content-center';
    Utils.setWidthInPixels(header_container, width);
    let header = document.createElement('h4');
    header.className = 'txt-center';
    header.textContent = name;
    header_container.append(header);
    return header_container;
  }
  // @nocheckin: we will need to merge all those iterations together
  let list = [createLocalHeader('Participants')];
  for (const role_identifier of event_roles) {
    const role_index = Global.data.roles_idetifier.get(role_id);
    if (role_index === undefined) { throw new Error('Can find role_id') }
    const name = Global.data.roles_name[role_index];
    list.push(createLocalHeader(name));
  }
  elements.numeric_table_header_list.replaceChildren(...list);

  list = [];
  for (let i = 0; i < staff_numeric_map[event_index].length; i++) {
    let line = createTemplateLine(event_roles.length);
    line.classList.add('deletable');
    const buttons = line.querySelectorAll('button');
    line._data_identifier = i;
    for (let j = 0; j < buttons.length; j++) {
      let _button = buttons[j];
      _button._data_identifier = j;
      const value = num_map[event_index][i][j];
      if (value === -1) {
        setEmptyButton(_button, () => {
          numeric_input.replace(_button);
          numeric_input.endOfWriting = () => {
            endOfButtonWriting(_button, i);
          }
        }); 
      } else {
        _button.textContent = value;
      }
    };
    list.push(line);
  }
  elements.numeric_table_content.replaceChildren(...list);
  addEmptyLine(event_roles.length); // idea is that addEmptyLine will add a line directly to the dom

  list = [SearchDisplay.create('Participants', Global.zones_identifier.COMPETENCES)];
  for (const role_identifier of event_roles) {
    const role_index = Global.data.roles_idetifier.get(role_identifier);
    if (role_index === undefined) { throw new Error("Can't find role_id") }; 
    const name = Global.data.roles_name[role_index];
    list.push(SearchDisplay.create(name, Global.zones_identifier.COMPETENCES));
  }
  elements.competences_tables.replaceChildren(...list);

  let duration = Global.data.events_duration[event_index];
  if (duration === undefined) {
    Global.data.events_duration[event_identifier] = -1;
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
    const event_identifier = Global.zones[Global.zones_identifier.EVENT].selection._data_identifier;
    const event_index = Global.data.events_identifier.get(event_identifier);
    if (event_index === undefined) { throw new Error('[updating duration]: event_identifier does not exist'); }
    if (numeric_input.element.value === '') {
      Global.data.events_duration[event_identifier] = -1;
      return;
    }
    let buffer_writer = createDurationBuffer(new_duration, Api.CREATE, event_identifier);
    Api.request(buffer_writer)
    .then(response => {
      Utils.throwIfNotOk(response);
      Global.data.events_duration[event_index] = duration;
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

export function createDurationBuffer(duration, mode, event_identifier) {
  if (duration < 0 || duration > 1024) {
    console.error("value of duration should be in 1..1024"); 
    return;
  }
  let writer = Api.createBufferWriter(Api.UPDATE, Api.EVENTS_DURATION);
  writer.writeInt32(event_identifier);
  writer.writeInt32(duration);
  return writer;
}
