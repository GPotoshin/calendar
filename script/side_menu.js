import { elms, tmpls, zones, viewId, zonesId, scopeId, data } from './global_state.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as EventInfo from './event_info.js';
import * as Utils from './utils.js';
import { BufferWriter } from './io.js';

function handleClickOnViewButton(b, scope_id) {
  elms.dataListContainer.replaceChildren(elms.scope[scope_id]); 
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
elms.scope[scopeId.EVENT].className = 'extendable v-container grow';
elms.scope[scopeId.EVENT]._id = zonesId.EVENTLIST;
elms.scope[scopeId.STAFF].className = 'extendable v-container grow';
elms.scope[scopeId.STAFF]._id = zonesId.STAFFLIST;
elms.scope[scopeId.VENUE].className = 'extendable v-container grow';
elms.scope[scopeId.VENUE]._id = zonesId.VENUELIST;

hContainer.append(bContainer);
elms.dataListContainer = lContainer;

// this should be factored out
let b1 = document.createElement('button');
b1.addEventListener('click', () => {
  handleClickOnViewButton(b1, scopeId.EVENT);
});
b1.textContent = 'Événements';
b1._dataId = 0;
let b2 = document.createElement('button');
b2.addEventListener('click', () => {
  handleClickOnViewButton(b2, scopeId.STAFF);
});
b2.textContent = 'Personnel';
b2._dataId = 1;
let b3 = document.createElement('button');
b3.addEventListener('click', () => {
  handleClickOnViewButton(b3, scopeId.VENUE);
});
b3.textContent = 'Lieux';
b3._dataId = 2;
bContainer.append(b1, b2, b3);

zones[zonesId.DATATYPE].selection = b1;

elms.sideMenu.replaceChildren(hContainer, elms.dataListContainer);
elms.dataListContainer.appendChild(elms.scope[scopeId.EVENT]);

export function sideListButtonClickCallback(event) {
    const b = event.currentTarget;
    const zone = zones[Number(b.parentElement._id)];
    if (zone.selection == b) {
      Utils.setBgColor(b, 'transparent');
      b.classList.toggle('hover');
      zone.selection = null;
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
      elms.view[viewId.INFORMATION].replaceChildren(tmpls[scopeId.EVENT]);
    }
}

export function createTmplButton() {
  let b = document.createElement('button');
  b.className = 'side-menu-list-button hover deletable editable';
  return b;
}

export function createListButton() {
  let b = createTmplButton();
  b.addEventListener('click', sideListButtonClickCallback);
  return b;
}

export function composeList(m, names, scope_id, zone_id) {
  for (const [id, idx] of m) {
    const name = names[idx];
    let button = createListButton();
    Utils.setNameAndId(button, name, id);
    elms.scope[scope_id].appendChild(button);
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
    let button = createListButton();
    setUserButton(button, name, surname, mat);
    elms.scope[scopeId.STAFF].appendChild(button);
  }
}

export function handleClickOnListButton(b, zn) {
}
