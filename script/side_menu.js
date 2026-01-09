import { elms, zones, viewId, zonesId, scopeId, listId, data } from './global_state.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as Api from './api.js';
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
elms.scope[scopeId.EVENT]._id = listId.EVENT;
elms.scope[scopeId.STAFF].className = 'extendable v-container grow';
elms.scope[scopeId.STAFF]._id = listId.STAFF;
elms.scope[scopeId.VENUE].className = 'extendable v-container grow';
elms.scope[scopeId.VENUE]._id = listId.VENUE;

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

export function createButtonTmpl() {
  let b = document.createElement('button');
  b.className = 'side-menu-list-button dynamic-bg hover deletable editable';
  return b;
}

export function setClickCallback(b, z) {
  if (z === zonesId.NONE) {
    return;
  }
  b.addEventListener('click', function (){
    handleClickOnListButton(b, z);
    if (zones[z].selection &&
      zones[zonesId.VIEWTYPE].selection._dataId === viewId.INFORMATION) {
      EventInfo.update();
    }
  });
}

function createListButton(z) {
  let b = createButtonTmpl();
  setClickCallback(b, z);
  return b;
}

export function composeList(m, names, scope_id, zone_id) {
  for (const [id, idx] of m) {
    const name = names[idx];
    let button = createListButton(zone_id);
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
    let button = createListButton(zonesId.STAFFLIST);
    setUserButton(button, name, surname, mat);
    elms.scope[scopeId.STAFF].appendChild(button);
  }
}

export function handleClickOnListButton(b, zn) {
  const z = zones[zn];
  if (z.selection == b) {
    Utils.setBgColor(b, 'transparent');
    b.classList.toggle('hover');
    z.selection = null;
    return;
  }
  Utils.setBgColor(b, palette.blue);
  b.classList.toggle('hover');
  if (z.selection) {
    Utils.setBgColor(z.selection, 'transparent');
    z.selection.classList.toggle('hover');
  }
  z.selection = b;
}
