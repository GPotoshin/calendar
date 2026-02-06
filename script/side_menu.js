import { elements, zones, viewId, zonesId, data } from './global_state.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as EventInfo from './event_info.js';
import * as CalendarInfo from './calendar_info.js';
import * as Utils from './utils.js';
import { BufferWriter } from './io.js';

function handleClickOnViewButton(b, zones_id) {
  elements.dataListContainer.replaceChildren(zones[zones_id].eList); 
  zones[zonesId.DATATYPE].selection = b;
}

let state = {
  sideMenuIsOpen: false,
};

elements.sideMenuContainer = document.getElementById('side-menu-container');
document.getElementById('side-menu-button').addEventListener('click', 
  function(button) {
    let sideMenuContainer = elements.sideMenuContainer;
    if (state.sideMenuIsOpen) {
      sideMenuContainer.removeChild(elements.sideMenu);
    } else {
      sideMenuContainer.appendChild(elements.sideMenu);
    }
    state.sideMenuIsOpen ^= true;
  }
);

elements.sideMenu.classList.add('v-container');
elements.sideMenu.id = 'side-menu';
let hContainer = document.createElement('div');
hContainer.className = 'header-container';
let bContainer = document.createElement('div');
bContainer.className = 'button-container';
bContainer.id = 'data-type';
let lContainer = document.createElement('div');
zones[0].eList = bContainer.children;
lContainer.id = 'button-container';
lContainer.className = 'v-container grow';
zones[zonesId.EVENT].eList.className = 'extendable v-container grow';
zones[zonesId.EVENT].eList._id = zonesId.EVENT;
zones[zonesId.STAFF].eList.className = 'extendable v-container grow';
zones[zonesId.STAFF].eList._id = zonesId.STAFF;
zones[zonesId.VENUE].eList.className = 'extendable v-container grow';
zones[zonesId.VENUE].eList._id = zonesId.VENUE;

hContainer.append(bContainer);
elements.dataListContainer = lContainer;

// this should be factored out
let b1 = document.createElement('button');
b1.addEventListener('click', () => {
  handleClickOnViewButton(b1, zonesId.EVENT);
});
b1.textContent = 'Événements';
b1._dataId = zonesId.EVENT;
let b2 = document.createElement('button');
b2.addEventListener('click', () => {
  handleClickOnViewButton(b2, zonesId.STAFF);
});
b2.textContent = 'Personnel';
b2._dataId = zonesId.STAFF;
let b3 = document.createElement('button');
b3.addEventListener('click', () => {
  handleClickOnViewButton(b3, zonesId.VENUE);
});
b3.textContent = 'Lieux';
b3._dataId = zonesId.VENUE;
bContainer.append(b1, b2, b3);

zones[zonesId.DATATYPE].selection = b1;

elements.sideMenu.replaceChildren(hContainer, elements.dataListContainer);
elements.dataListContainer.appendChild(zones[zonesId.EVENT].eList);

export function buttonClickCallback(event) {
  const current_button = event.currentTarget;
  const zone = zones[Number(current_button.parentElement._id)];
  const previous_button = zone.selection;

  current_button.classList.toggle('hover');
  if (previous_button === current_button) {
    Utils.setBgColor(current_button, 'transparent');
    zone.selection = null;
    if (zones[zonesId.VIEWTYPE].selection._dataId === viewId.INFORMATION) {
      elements.view[viewId.INFORMATION].replaceChildren(CalendarInfo.dom);
    } else {

    }
    return;
  } else {
    if (previous_button) {
      Utils.setBgColor(previous_button, 'transparent');
      previous_button.classList.toggle('hover');
    }
    Utils.setBgColor(current_button, palette.blue);
    zone.selection = current_button;
    if (zones[zonesId.VIEWTYPE].selection._dataId === viewId.INFORMATION) {
      EventInfo.update();
      elements.view[viewId.INFORMATION].replaceChildren(EventInfo.dom);
    } else {
      const list = elements.calendarContent.children;
      for (let i = 0; i < list.length; i++) {
        let el = list[i];
        if (el.classList.contains('block-marker')) {
          continue;
        }
        let line = document.createElement('div');
        line.classList = 'event-occurence event-single no-select';
        line.style.top = '0%';
        Utils.setBgColor(line, palette.green);
        let newWidth = el.children[6].getBoundingClientRect().right-
          el.children[0].getBoundingClientRect().left-1;
        line.style.width = newWidth+'px';
        el.children[0].getElementsByClassName('bar-holder')[0].prepend(line);
      }
    }
  }
}

export function createTmplButton() {
  let b = document.createElement('button');
  b.className = 'side-menu-list-button hover deletable editable';
  return b;
}

export function createListButtonAndSetToggleCallback() {
  let b = createTmplButton();
  b.addEventListener('click', buttonClickCallback);
  return b;
}

export function composeList(m, names, zone_id) {
  for (const [id, idx] of m) {
    const name = names[idx];
    let button = createListButtonAndSetToggleCallback();
    Utils.setNameAndId(button, name, id);
    zones[zone_id].eList.appendChild(button);
  }
}

export function setUserButton(b, name, surname, mat) {
  b._dataId = mat;
  let left = document.createElement('span');
  left.textContent = name+' '+surname;
  let right = document.createElement('span');
  right.classList = "color-grey";
  right.textContent = '#'+mat;
  b.replaceChildren(left, right);
}

export function composeUsersList() {
  for (const [mat, idx] of data.usersId) {
    const name = data.usersName[idx]; // @factorout
    const surname = data.usersSurname[idx];
    let button = createListButtonAndSetToggleCallback();
    setUserButton(button, name, surname, mat);
    zones[zonesId.STAFF].eList.appendChild(button);
  }
}

export function handleClickOnListButton(b, zn) {
}
