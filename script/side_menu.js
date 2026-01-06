import { elms, zones, viewId, zonesId, scopeId, listId, data } from './global_state.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as Api from './api.js';
import * as EventInfo from './event_info.js';
import { BufferWriter } from './io.js';

function handleClickOnViewButton(b, scope_id) {
  elms.dataListContainer.replaceChildren(elms.scope[scope_id]); 
  const z = zones[zonesId.DATATYPE];
  z.selection = b;
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

function storeFunctionMaker(stateField, map, arr, freeList) {
  return (name) => {
    let w = new BufferWriter();
    Api.writeHeader(w, Api.Op.CREATE, Api.StateField.EVENTS_ID_MAP_ID);
   Api.writeCreateMapEntry(w, name);
    Api.request(w)
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      resp.arrayBuffer()
      .then(bin => {
        let r = new BufferReader(bin);
        let id = r.readInt32();
        let idx = DM.storageIndex(map, freeList);
        map[id] = idx;
        arr[idx] = name;
      });
    })
    .catch(e => {
      console.error("Could not store ", name, e);
    });
  };
}

elms.scope[scopeId.EVENT]._store =
  storeFunctionMaker(
    Api.StateField.EVENTS_ID_MAP_ID,
    data.eventsId,
    data.eventsName,
    data.eventsFreeList,
  );

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

zones[zonesId.VIEWTYPE].selection = b1;

elms.sideMenu.replaceChildren(hContainer, elms.dataListContainer);
elms.dataListContainer.appendChild(elms.scope[scopeId.EVENT]);

function createListButton(zone_id) {
  return () => {
    let button = document.createElement('button');
    button.className = 'side-menu-list-button dynamic_bg hover deletable editable';
    button.addEventListener('click', function (){
      handleClickOnListButton(button, zone_id);
      if (zones[zone_id].selection &&
        zones[zonesId.VIEWTYPE].selection._dataId === viewId.INFORMATION) {
        EventInfo.update();
      }
    });
    return button;
  }
}

export function composeList(m, names, scope_id, zone_id) {
  for (const [id, idx] of m) {
    const name = names[idx];
    let button = createListButton(zone_id)();
    elms.scope[scope_id].appendChild(button);
    button._dataId = id;

    let span = document.createElement('span');
    span.textContent = name;
    button.appendChild(span);
    span = document.createElement('span');
    span.classList = 'color-grey';
    span.textContent = '#'+id;
    button.appendChild(span);
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
    let button = createListButton(zonesId.STAFFLIST)();
    setUserButton(button, name, surname, mat);
    elms.scope[scopeId.STAFF].appendChild(button);
  }
}

export function handleClickOnListButton(b, zn) {
  const z = zones[zn];
  if (z.selection == b) {
    b.style.setProperty('--bg-color', 'transparent');
    b.classList.toggle('hover');
    z.selection = null;
    return;
  }
  b.style.setProperty('--bg-color', palette.blue);
  b.classList.toggle('hover');
  if (z.selection) {
    z.selection.style.setProperty('--bg-color', 'transparent');
    z.selection.classList.toggle('hover');
  }
  z.selection = b;
}
