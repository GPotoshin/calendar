import { elms, zones, viewId, zonesId, data } from './global_state.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as EventInfo from './event_info.js';
import * as CalendarInfo from './calendar_info.js';
import * as Utils from './utils.js';
import { BufferWriter } from './io.js';

function handleClickOnViewButton(b, zones_id) {
  elms.dataListContainer.replaceChildren(zones[zones_id].eList); 
  zones[zonesId.DATATYPE].selection = b;
}

let state = {
  sideMenuIsOpen: false,
};

elms.sideMenuContainer = document.getElementById('side-menu-container');
document.getElementById('side-menu-button').addEventListener('click', 
  function(button) {
    let sideMenuContainer = elms.sideMenuContainer;
    if (state.sideMenuIsOpen) {
      sideMenuContainer.removeChild(elms.sideMenu);
    } else {
      sideMenuContainer.appendChild(elms.sideMenu);
    }
    state.sideMenuIsOpen ^= true;
  }
);

elms.sideMenu.classList.add('v-container');
elms.sideMenu.id = 'side-menu';
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
elms.dataListContainer = lContainer;

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

elms.sideMenu.replaceChildren(hContainer, elms.dataListContainer);
elms.dataListContainer.appendChild(zones[zonesId.EVENT].eList);

export function buttonClickCallback(event) {
    const b = event.currentTarget;
    const zone = zones[Number(b.parentElement._id)];
    if (zone.selection == b) {
      Utils.setBgColor(b, 'transparent');
      b.classList.toggle('hover');
      zone.selection = null;
      if (zones[zonesId.VIEWTYPE].selection._dataId === viewId.INFORMATION) {
        elms.view[viewId.INFORMATION].replaceChildren(CalendarInfo.dom);
      }
      return;
    }
    Utils.setBgColor(b, palette.blue);
    b.classList.toggle('hover');
    if (zone.selection) {
      Utils.setBgColor(zone.selection, 'transparent');
      zone.selection.classList.toggle('hover');
    }
    zone.selection = b;
    if (zone.selection &&
      zones[zonesId.VIEWTYPE].selection._dataId === viewId.INFORMATION) {
      EventInfo.update();
      elms.view[viewId.INFORMATION].replaceChildren(EventInfo.dom);
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
