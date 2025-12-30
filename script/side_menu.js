import { elms, zones, viewId, zonesId, scopeId, data } from './global_state.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as Api from './api.js';

function handleClickOnViewButton(b, zn) {
  const z = zones[zn];
  z.selection = b._bIdx;
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
elms.scope[scopeId.STAFF].className = 'extendable v-container grow';
elms.scope[scopeId.VENUE].className = 'extendable v-container grow';

function storeFunctionMaker(stateField, map, arr, freeList) {
  return (name) => {
    let w = new BufferWriter();
    Api.writeHeader(w, token, Api.Op.CREATE, Api.StateField.EVENTS_ID_MAP_ID);
    Api.writeCreateMapEntry(w, name);
    fetch("/api", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: w.getBuffer(),
    })
      .then(resp => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        resp.arrayBuffer()
          .then(
            bin => {
              let r = new BufferReader(bin);
              let id = r.readInt32();
              let idx = DM.storageIndex(map, freeList);
              map[id] = idx;
              arr[idx] = name;
            });
      })
      .catch(e => {
        console.error("Could not store ", name);
      });
  };
}

elms.scope[scopeId.EVENT]._createButton = createListButton(zonesId.EVENTLIST);
elms.scope[scopeId.STAFF]._createButton = createListButton(zonesId.STAFFLIST);
elms.scope[scopeId.VENUE]._createButton = createListButton(zonesId.VENUELIST);

elms.scope[scopeId.EVENT]._btnPlaceholder = 'Nouvel Événement';
elms.scope[scopeId.STAFF]._btnPlaceholder = 'Nouveau Membre du Personnel';
elms.scope[scopeId.VENUE]._btnPlaceholder = 'Nouveau Lieu';

elms.scope[scopeId.EVENT]._store =
  storeFunctionMaker(
    Api.StateField.EVENTS_ID_MAP_ID,
    data.eventsId,
    data.eventsName,
    data.eventsFreeList,
  );

hContainer.append(bContainer);
elms.dataListContainer = lContainer;

let b1 = document.createElement('button');
b1.addEventListener('click', () => {
  elms.dataListContainer.replaceChildren(elms.scope[scopeId.EVENT]); 
  handleClickOnViewButton(b1, zonesId.DATATYPE);
});
b1.textContent = 'Événements';
b1._bIdx = 0;
let b2 = document.createElement('button');
b2.addEventListener('click', () => {
  elms.dataListContainer.replaceChildren(elms.scope[scopeId.STAFF]);
  handleClickOnViewButton(b2, zonesId.DATATYPE);
});
b2.textContent = 'Personnel';
b2._bIdx = 1;
let b3 = document.createElement('button');
b3.addEventListener('click', () => {
  elms.dataListContainer.replaceChildren(elms.scope[scopeId.VENUE]);
  handleClickOnViewButton(b3, zonesId.DATATYPE);
});
b3.textContent = 'Lieux';
b3._bIdx = 2;
bContainer.append(b1, b2, b3);

elms.sideMenu.replaceChildren(hContainer, elms.dataListContainer);
elms.dataListContainer.appendChild(elms.scope[scopeId.EVENT]);

function createListButton(zone_id) {
  return () => {
    let button = document.createElement('button');
    button.className = 'side-menu-list-button dynamic_bg deletable editable';
    button.addEventListener('click', function (){
      handleClickOnListButton(button, zone_id);
      if (zones[zone_id].selection >= 0 &&
        zones[zonesId.VIEWTYPE].selection === viewId.INFORMATION) {
        resetEventInfoView();
      }
    });
    return button;
  }
}

export function composeList(m, names, scope_id, zone_id) {
  let i = 0;
  for (const [id, idx] of m) {
    const name = names[idx];
    let button = createListButton(zone_id)();
    elms.scope[scope_id].appendChild(button);
    button._bIdx = i;
    button._dIdx = idx;

    let span = document.createElement('span');
    span.textContent = name;
    button.appendChild(span);
    span = document.createElement('span');
    span.classList = "color-grey";
    span.textContent = '#'+id;
    button.appendChild(span);
    
    i++;
  }
}

function handleClickOnListButton(b, zn) {
  const z = zones[zn];
  if (z.selection == b._bIdx) {
    b.style.setProperty('--bg-color', 'transparent');
    z.selection = -1;
    return;
  }
  b.style.setProperty('--bg-color', palette.blue);
  if (z.selection >= 0) {
    z.eList[z.selection].style.setProperty('--bg-color', 'transparent');
  }
  z.selection = b._bIdx;
}
