import { elements, zones, view_identifier, zones_identifier, data } from './global_state.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as EventInformation from './event_information.js';
import * as CalendarInformation from './calendar_information.js';
import * as Utils from './utils.js';
import { BufferWriter } from './io.js';

function handleClickOnViewButton(b, view_zone_identifier) {
  elements.dataListContainer.replaceChildren(zones[view_zone_identifier].element_list); 
  zones[zones_identifier.DATA_TYPE].selection = b;
}

let state = {
  side_menu_is_open: false,
};

elements.side_menu_container = document.getElementById('side-menu-container');
document.getElementById('side-menu-button').addEventListener('click', 
  function(button) {
    let side_menu_container = elements.side_menu_container;
    if (state.side_menu_is_open) {
      side_menu_container.removeChild(elements.side_menu);
    } else {
      side_menu_container.appendChild(elements.side_menu);
    }
    state.side_menu_is_open ^= true;
  }
);

elements.side_menu.classList.add('v-container');
elements.side_menu.id = 'side-menu';
let header_container = document.createElement('div');
header_container.className = 'header-container';
let button_container = document.createElement('div');
header_button_container.className = 'button-container';
header_button_container.id = 'data-type';
zones[zones_identifier.DATA_TYPE].element_list = header_button_container.children;
let list_button_container = document.createElement('div');
list_button_container.id = 'button-container';
list_button_container.className = 'v-container grow';
zones[zones_identifier.EVENT].element_list.className = 'extendable v-container grow';
zones[zones_identifier.EVENT].element_list._identifier = zones_identifier.EVENT;
zones[zones_identifier.STAFF].element_list.className = 'extendable v-container grow';
zones[zones_identifier.STAFF].element_list._identifier = zones_identifier.STAFF;
zones[zones_identifier.VENUE].element_list.className = 'extendable v-container grow';
zones[zones_identifier.VENUE].element_list._identifier = zones_identifier.VENUE;

header_container.append(bContainer);
elements.dataListContainer = lContainer;

// this should be factored out
let b1 = document.createElement('button');
b1.addEventListener('click', () => {
  handleClickOnViewButton(b1, zones_identifier.EVENT);
});
b1.textContent = 'Événements';
b1._data_identifier = zones_identifier.EVENT;
let b2 = document.createElement('button');
b2.addEventListener('click', () => {
  handleClickOnViewButton(b2, zones_identifier.STAFF);
});
b2.textContent = 'Personnel';
b2._data_identifier = zones_identifier.STAFF;
let b3 = document.createElement('button');
b3.addEventListener('click', () => {
  handleClickOnViewButton(b3, zones_identifier.VENUE);
});
b3.textContent = 'Lieux';
b3._data_identifier = zones_identifier.VENUE;
bContainer.append(b1, b2, b3);

zones[zones_identifier.DATA_TYPE].selection = b1;

elements.side_menu.replaceChildren(header_container, elements.dataListContainer);
elements.dataListContainer.appendChild(zones[zones_identifier.EVENT].element_list);

export function buttonClickCallback(event) {
  const current_button = event.currentTarget;
  const zone = zones[Number(current_button.parentElement._id)];
  const previous_button = zone.selection;

  current_button.classList.toggle('hover');
  if (previous_button === current_button) {
    Utils.setBackgroundColor(current_button, 'transparent');
    zone.selection = null;
    if (zones[zones_identifier.VIEW_TYPE].selection._data_identifier === view_identifier.INFORMATION) {
      elements.veiws[view_identifier.INFORMATION].replaceChildren(CalendarInformation.dom);
    } else {

    }
    return;
  } else {
    if (previous_button) {
      Utils.setBackgroundColor(previous_button, 'transparent');
      previous_button.classList.toggle('hover');
    }
    Utils.setBackgroundColor(current_button, palette.blue);
    zone.selection = current_button;
    if (zones[zones_identifier.VIEW_TYPE].selection._data_identifier === view_identifier.INFORMATION) {
      EventInformation.update();
      elements.veiws[view_identifier.INFORMATION].replaceChildren(EventInformation.dom);
    } else {
      const list = elements.calendar_content.children;
      for (let i = 0; i < list.length; i++) {
        let row = list[i];
        if (row.classList.contains('block-marker')) {
          continue;
        }
        let line = document.createElement('div');
        line.classList = 'event-occurence event-single no-select';
        line.style.top = '0%';
        Utils.setBackgroundColor(line, palette.green);
        let newWidth = row.children[6].getBoundingClientRect().right-
          row.children[0].getBoundingClientRect().left-1;
        line.style.width = newWidth+'px';
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
    Utils.setNameAndId(button, name, identifier);
    zones[list_identifier].element_list.appendChild(button);
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
  for (const [mat, idx] of data.users_identifier) {
    const name = data.users_name[idx]; // @factorout
    const surname = data.users_surname[idx];
    let button = createListButtonAndSetToggleCallback();
    setUserButton(button, name, surname, mat);
    zones[zones_identifier.STAFF].element_list.appendChild(button);
  }
}

export function handleClickOnListButton(b, zn) {
}
