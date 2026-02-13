import * as Global from './global.js';
import * as SearchDisplay from './search_display.js';
import * as Utilities from './utilities.js';
import { numeric_input } from './numeric_input.js';
import { BufferWriter } from './io.js';
import * as Api from './api.js';
import * as EventInformation from './event_information.js';

export let dom = document.createElement('div');

export const state = {
  event_role_button_list: null,
  participant_competences_button_list: null,
};

export const elements = {
  competences_tables: null,
  participant_competences: null,
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
  elements.numeric_table_content._identifier = Global.zones_identifier.STAFF_NUMBER_MAP;
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

  const participants_search_display = SearchDisplay.create(
    'Participants',
    Global.zones_identifier.COMPETENCES,
    Global.data.bundleCompetencesNames(),
  );
  state.participant_competences_button_list =
    participants_search_display._container._button_list;
  elements.participant_competences = participants_search_display;

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

  let search_display = SearchDisplay.create(
    'Personnel',
    Global.zones_identifier.EVENT_STAFF,
    Global.data.bundleRolesNames(),
  );
  state.event_role_button_list = search_display._container._button_list;

  EventInformation.dom.children[0].append(
    search_display,
    createStaffTable(),
    createCompetencesTable(),
    createFooterOptions(),
  );
}

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

function createTemplateLine(staff_number) {
  let line = document.createElement('div');
  line.className = 'h-container align-items-center wide';
  line.innerHTML = participant_num_field_html+staff_num_field_html.repeat(staff_number);
  for (let i = 0; i < line.children.length-1; i++) {
    line.children[i]._identifier = Global.zones_identifier.STAFF_NUMBER_MAP_FIELD;
    line.children[i].classList.add('right-border');
  }
  line.children[line.children.length-1]._identifier =
    Global.zones_identifier.STAFF_NUMBER_MAP_FIELD;
  return line;
}

function evolveButton(button) {
  button.classList.add('editable');
  button.removeEventListener('click', button._clickCallback);
  button._clickCallback = null;
}

function getNumericValue(button) {
  return Number(button.textContent);
}

export function endOfButtonWriting(
  button,
  line_index,
  event_identifier,
  event_index,
) {
  numeric_input.swapBackAndSetContent(button);
  if (button.textContent !== '\u00A0') {
    const numeric_value = getNumericValue(button);
    const field_index = button._data_identifier;
    let writer = Api.createBufferWriter(Api.UPDATE, Api.EVENTS_PERSONAL_NUM_MAP);
    writer.writeInt32(event_identifier);
    writer.writeInt32(line_index);
    writer.writeInt32(field_index);
    writer.writeInt32(numeric_value);
    Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);
        evolveButton(button);
        const staff_number_map = Global.data.events_staff_number_map;
        staff_number_map[event_index][line_index][field_index] = numeric_value;
      })
      .catch(error => {
        console.error('Could not store staff_number_map button: ', error);
      });
  }
}

function endOfLineWriting(
  staff_number_map,
  button,
  line,
  buttons,
  event_identifier,
  event_index,
  event_roles,
) {
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
    line._data_identifier = staff_number_map[event_index].length;
    // we need to make an API store request here
    let writer = Api.createBufferWriter(Api.CREATE, Api.EVENTS_PERSONAL_NUM_MAP);
    writer.writeInt32(event_identifier);
    writer.writeInt32(buttons.length);
    let data = [];
    for (let j = 0; j < buttons.length; j++) {
      const numeric_value = Number(buttons[j].textContent);
      buttons[j]._data_identifier = j;
      evolveButton(buttons[j]);
      const n = getNumericValue(buttons[j]);
      writer.writeInt32(numeric_value); // we don't have numeric value yet
      data.push(numeric_value);
    }
    Api.request(writer)
      .then(response => {
        Utilities.throwIfNotOk(response);
        staff_number_map[event_index].push(data);
      })
      .catch(error => {
        line.remove();
        console.error('Could not store staff_number_map line: ', error);
      });
    addEmptyLine(staff_number_map, event_identifier, event_index, event_roles);
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

function addEmptyLine(staff_number_map, event_identifier, event_index, event_roles) {
  let line = createTemplateLine(event_roles.length);
  const buttons = line.querySelectorAll('button');
  for (const _button of buttons) {
    setEmptyButton(_button, () => {
      numeric_input.replace(_button);
      numeric_input.endOfWriting = () => {
        endOfLineWriting(staff_number_map, _button, line, buttons, event_identifier, event_index, event_roles);
      };
    });
  };
  elements.numeric_table_content.appendChild(line);
}


export function update() { // @working
  // scoped functions
  const zone = Global.zones[Global.zones_identifier.EVENT];
  if (zone.selection == null) { // we need to show general setting
    return;
  }
  const event_identifier = zone.selection._data_identifier;
  const event_index = Global.data.events_identifier_to_index_map.get(event_identifier);
  if (event_index === undefined) { throw new Error("[update] no entry for event_identifier"); }
  const event_roles = Global.data.events_roles[event_index];
  const role_requirements = Global.data.events_roles_requirements[event_index];
  const staff_number_map = Global.data.events_staff_number_map;

  // actual function code
  for (const _button of state.event_role_button_list) {
    if (event_roles.includes(_button._data_identifier)) {
      _button.classList.add('clicked');
    } else {
      _button.classList.remove('clicked');
    }
  }

  // nummap
  const base_width = 125;
  let width = base_width*(event_roles.length+1);
  Utilities.setWidthInPixels(elements.numeric_table_header_list, width);
  Utilities.setWidthInPixels(elements.numeric_table_content, width);

  function createLocalHeader(name) {
    let header_container = document.createElement('div');
    header_container.className = 'disp-flex justify-content-center';
    Utilities.setWidthInPixels(header_container, width);
    let header = document.createElement('h4');
    header.className = 'txt-center';
    header.textContent = name;
    header_container.append(header);
    return header_container;
  }
  // @nocheckin: we will need to merge all those iterations together
  let list = [createLocalHeader('Participants')];
  for (const role_identifier of event_roles) {
    const role_index = Global.data.roles_identifier_to_index_map.get(role_identifier);
    if (role_index === undefined) { throw new Error('Can find role_identifier') }
    const name = Global.data.roles_name[role_index];
    list.push(createLocalHeader(name));
  }
  elements.numeric_table_header_list.replaceChildren(...list);

  list = [];
  for (let i = 0; i < staff_number_map[event_index].length; i++) {
    let line = createTemplateLine(event_roles.length);
    line.classList.add('deletable');
    const buttons = line.querySelectorAll('button');
    line._data_identifier = i;
    for (let j = 0; j < buttons.length; j++) {
      let _button = buttons[j];
      _button._data_identifier = j;
      const value = staff_number_map[event_index][i][j];
      if (value === -1) {
        setEmptyButton(_button, () => {
          numeric_input.replace(_button);
          numeric_input.endOfWriting = () => {
            endOfButtonWriting(_button, i, event_identifier, event_index);
          }
        }); 
      } else {
        _button.classList.add('editable');
        _button.textContent = value;
      }
    };
    list.push(line);
  }
  elements.numeric_table_content.replaceChildren(...list);
  addEmptyLine(staff_number_map, event_identifier, event_index, event_roles);

  list = [];
  for (let role_ordinal = 0; role_ordinal < event_roles.length; role_ordinal++) {
    const role_identifier = event_roles[role_ordinal]; 
    const role_index = Global.data.roles_identifier_to_index_map.get(role_identifier);
    if (role_index == undefined) {
      throw new Error("Currupted state: role_index for id(${role_identifier} does not exist)");
    }
    const search_display = SearchDisplay.createTemplate(
      Global.data.roles_name[role_index],
      Global.zones_identifier.COMPETENCES,
    );
    search_display._data_identier = role_ordinal;
    let requirements = role_requirements[role_ordinal];
    if (requirements === undefined) { requirements = []; }

    for (const _button of state.participant_competences_button_list) {
      const cloned_button = _button.cloneNode(true);
      if (requirements.includes(_button._data_identifier)) {
        cloned_button.classList.add('clicked');
      } else {
        cloned_button.classList.remove('clicked');
      }
      cloned_button._data_idetifier = _button._data_identifier;
      search_display._container.appendChild(cloned_button);
      search_display._container._button_list.push(cloned_button);
    }
    list.push(search_display);
  }
  elements.competences_tables.replaceChildren(
    elements.participant_competences,
    ...list,
  );

  let duration = Global.data.events_duration[event_index];
  if (duration === undefined) {
    Global.data.events_duration[event_identifier] = -1;
    duration = -1;
  }

  const event_duration_button = EventInformation.dom.querySelector('#event-duration');
  function localCallback() {
    event_duration_button.replaceWith(numeric_input.element);
    numeric_input.element.focus();
    numeric_input.endOfWriting = endOfWriting;
  }

  function endOfWriting() {
    const new_duration = Number(numeric_input.element.value);
    event_duration_button.textContent = numeric_input.element.value | '\u00A0';
    numeric_input.element.replaceWith(event_duration_button);
    const event_identifier = Global.getEventSelectionIdentifier();
    const event_index = Global.data.events_identifier_to_index_map.get(event_identifier);
    if (event_index === undefined) { throw new Error('[updating duration]: event_identifier does not exist'); }
    if (numeric_input.element.value === '') {
      Global.data.events_duration[event_identifier] = -1;
      return;
    }
    let buffer_writer = createDurationBuffer(new_duration, Api.CREATE, event_identifier);
    Api.request(buffer_writer)
    .then(response => {
      Utilities.throwIfNotOk(response);
      Global.data.events_duration[event_index] = duration;
      event_duration_button.classList.add('editable');
      event_duration_button.removeEventListener('click', localCallback);
    })
    .catch(e => {
      event_duration_button.textContent = '\u00A0'
    });
  };

  if (duration === -1) {
    event_duration_button.textContent = '\u00A0';
    event_duration_button.classList.remove('editable');
    event_duration_button.addEventListener('click', localCallback);
  } else {
    event_duration_button.removeEventListener('click', localCallback);
    event_duration_button.textContent = duration;
    event_duration_button.classList.add('editable');
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
