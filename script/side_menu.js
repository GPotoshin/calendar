import * as Global from './global.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as EventInformation from './event_information.js';
import * as CalendarInformation from './calendar_information.js';
import * as Utilities from './utilities.js';
import { BufferWriter } from './io.js';

function handleClickOnViewButton(button, view_zone_identifier) {
  Global.elements.dataListContainer.replaceChildren(Global.zones[view_zone_identifier].element_list); 
  Global.zones[Global.zones_identifier.DATA_TYPE].selection = button;
}

let state = {
  side_menu_is_open: false,
};

Global.elements.side_menu_container = document.getElementById('side-menu-container');
document.getElementById('side-menu-button').addEventListener('click', 
  function(button) {
    let side_menu_container = Global.elements.side_menu_container;
    if (state.side_menu_is_open) {
      side_menu_container.removeChild(Global.elements.side_menu);
    } else {
      side_menu_container.appendChild(Global.elements.side_menu);
    }
    state.side_menu_is_open ^= true;
  }
);

Global.elements.side_menu.classList.add('v-container');
Global.elements.side_menu.id = 'side-menu';
let header_container = document.createElement('div');
header_container.className = 'header-container';
let header_button_container = document.createElement('div');
header_button_container.className = 'button-container';
header_button_container.id = 'data-type';
Global.zones[Global.zones_identifier.DATA_TYPE].element_list = header_button_container.children;
let list_button_container = document.createElement('div');
list_button_container.id = 'button-container';
list_button_container.className = 'v-container grow';

function setupZone(zones_identifier) {
  Global.zones[zones_identifier].element_list.className = 'extendable v-container grow';
  Global.zones[zones_identifier].element_list._identifier = zones_identifier;
}
setupZone(Global.zones_identifier.EVENT);
setupZone(Global.zones_identifier.STAFF);
setupZone(Global.zones_identifier.VENUE);

header_container.append(header_button_container);
Global.elements.dataListContainer = list_button_container;

function createDataTypeButton(zones_identifier, name) {
  let button = document.createElement('button');
  button.addEventListener('click', () => {
    handleClickOnViewButton(button, zones_identifier);
  });
  button.textContent = name;
  button._data_identifier = zones_identifier;
  return button;
}

let event_button = createDataTypeButton(Global.zones_identifier.EVENT, 'Événements');
let staff_button = createDataTypeButton(Global.zones_identifier.STAFF, 'Personnel');
let venue_button = createDataTypeButton(Global.zones_identifier.VENUE, 'Lieux');
header_button_container.append(event_button, staff_button, venue_button);

Global.zones[Global.zones_identifier.DATA_TYPE].selection = event_button;

Global.elements.side_menu.replaceChildren(header_container, Global.elements.dataListContainer);
Global.elements.dataListContainer.appendChild(Global.zones[Global.zones_identifier.EVENT].element_list);

export function buttonClickCallback(event) {
  const current_button = event.currentTarget;
  const zone = Global.zones[Number(current_button.parentElement._identifier)];
  const previous_button = zone.selection;

  current_button.classList.toggle('hover');
  if (previous_button === current_button) {
    Utilities.setBackgroundColor(current_button, 'transparent');
    zone.selection = null;
    if (Global.zones[Global.zones_identifier.VIEW_TYPE].selection._data_identifier === Global.view_identifier.INFORMATION) {
      Global.elements.views[Global.view_identifier.INFORMATION].replaceChildren(CalendarInformation.dom);
    } else {

    }
    return;
  } else {
    if (previous_button) {
      Utilities.setBackgroundColor(previous_button, 'transparent');
      previous_button.classList.toggle('hover');
    }
    Utilities.setBackgroundColor(current_button, palette.blue);
    zone.selection = current_button;
    if (Global.zones[Global.zones_identifier.VIEW_TYPE].selection._data_identifier === Global.view_identifier.INFORMATION) {
      EventInformation.update();
      Global.elements.views[Global.view_identifier.INFORMATION].replaceChildren(EventInformation.dom);
    } else {
      const list = Global.elements.calendar_content.children;
      for (let i = 0; i < list.length; i++) {
        let row = list[i];
        if (row.classList.contains('block-marker')) {
          continue;
        }
        let line = document.createElement('div');
        line.classList = 'event-occurence event-single no-select';
        line.style.top = '0%';
        Utilities.setBackgroundColor(line, palette.green);
        let new_width = row.children[6].getBoundingClientRect().right-
          row.children[0].getBoundingClientRect().left-1;
        line.style.width = new_width+'px';
        row.children[0].getElementsByClassName('bar-holder')[0].prepend(line);
      }
    }
  }
}

export function createTemplateButton() {
  let button = document.createElement('button');
  button.className = 'side-menu-list-button hover deletable editable';
  return button;
}

export function createListButtonAndSetToggleCallback() {
  let button = createTemplateButton();
  button.addEventListener('click', buttonClickCallback);
  return button;
}

export function composeList(map, names, list_identifier) {
  for (const [identifier, index] of map) {
    const name = names[index];
    let button = createListButtonAndSetToggleCallback();
    Utilities.setNameAndIdentifier(button, name, identifier);
    Global.zones[list_identifier].element_list.appendChild(button);
  }
}

export function setUserButton(button, name, surname, matricule) {
  button._data_identifier = matricule;
  let left = document.createElement('span');
  left.textContent = name+' '+surname;
  let right = document.createElement('span');
  right.classList = "color-grey";
  right.textContent = '#'+matricule;
  button.replaceChildren(left, right);
}

export function composeUsersList() {
  for (const [matricule, index] of Global.data.users_identifier_to_index_map) {
    const name = Global.data.users_name[index]; // @factorout
    const surname = Global.data.users_surname[index];
    let button = createListButtonAndSetToggleCallback();
    setUserButton(button, name, surname, matricule);
    Global.zones[Global.zones_identifier.STAFF].element_list.appendChild(button);
  }
}
