import { elms, zones, viewId, zonesId, scopeId, buttonType, data } from './global_state.js';
import { palette } from './color.js';
import * as DM from './data_manager.js';
import * as Api from './api.js';
import * as EventInfo from './event_info.js';
import { BufferWriter } from './io.js';

function handleClickOnViewButton(b, zn) {
  const z = zones[zn];
  z.selection = b._dataId;
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

function createListButtonWithInput(zone_id, btnPlaceholder, target) {
  return () => {
    let b = document.createElement('button');
    b.className = 'side-menu-list-button dynamic_bg deletable editable';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = btnPlaceholder;
    target.appendChild(b);
    b.appendChild(input);
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = input.value;
        input.remove();
        b.textContent = value;
        target._store(value);
        b.addEventListener('click', function (){
          handleClickOnListButton(b, zone_id);
          if (zones[zone_id].selection >= 0 &&
            zones[zonesId.VIEWTYPE].selection === viewId.INFORMATION) {
            EventInfo.update();
          }
        });
      } else if (e.key === 'Escape') {
        b.remove();
      }
    });
  };
}

function createUserButtonWithInput() {
  const target = elms.scope[scopeId.STAFF];
  let b = document.createElement('button');
  b.className = 'side-menu-list-button dynamic_bg deletable editable';
  const inputName = document.createElement('input');
  inputName.type = 'text';
  inputName.placeholder = 'Prenom';
  const inputSurname = document.createElement('input');
  inputSurname.type = 'text';
  inputSurname.placeholder = 'Nom';
  const inputMatricule = document.createElement('input');
  inputMatricule.type = 'text';
  inputMatricule.placeholder = 'Matricule';
  inputMatricule.classList = 'dynamic_bg';
  inputMatricule.style.setProperty('--bg-color', 'transparent');
  inputMatricule.addEventListener('input', () => {
    inputMatricule.value = inputMatricule.value.replace(/\D/g, '');
  });

  function save() {
    const name = inputName.value;
    const surname = inputSurname.value;
    const matricule = Number(inputMatricule.value);

    if (data.usersId.has(Number(matricule))) {
      inputMatricule.style.setProperty('--bg-color', palette.red);
      return;
    }

    let left = document.createElement('span');
    left.textContent = name+' '+surname;
    let right = document.createElement('span');
    right.classList = 'color-grey';
    right.textContent = '#'+matricule;
    b.replaceChildren(left, right);

    let w = new BufferWriter();
    Api.writeHeader(w, Api.Op.CREATE, Api.StateField.USERS_ID_MAP_ID);
    Api.writeCreateUserMapEntry(w, name, surname, matricule); 

    inputName.remove();
    inputSurname.remove();
    inputMatricule.remove();
    b.addEventListener('click', function (){
      handleClickOnListButton(b, zonesId.STAFFLIST);
      if (zones[zoneId.STAFFLIST].selection >= 0 &&
        zones[zonesId.VIEWTYPE].selection === viewId.INFORMATION) {
        EventInfo.update();
      }
    });

    Api.request(w)
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
        b.remove();
        return;
      }
    })
    .catch( e => {
      console.error("Could not store ", name, e);
    });
  }

  inputName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (inputName.value !== '' &&
          inputSurname.value !== '' &&
          inputMatricule.value !== '') {
        e.preventDefault();
        save();
      }
      inputSurname.focus();
    } else if (e.key === 'Escape') {
      b.remove();
    }
  });
  inputSurname.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (inputName.value !== '' &&
          inputSurname.value !== '' &&
          inputMatricule.value !== '') {
        e.preventDefault();
        save();
      }
      inputMatricule.focus();
    } else if (e.key === 'Escape') {
      b.remove();
    }
  });
  inputMatricule.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (inputName.value !== '' &&
          inputSurname.value !== '' &&
          inputMatricule.value !== '') {
        e.preventDefault();
        save();
      }
    } else if (e.key === 'Escape') {
      b.remove();
    }
  });
  target.appendChild(b);
  b.appendChild(inputName);
  b.appendChild(inputSurname);
  b.appendChild(inputMatricule);
  inputName.focus();
}

elms.scope[scopeId.EVENT]._create = createListButtonWithInput(zonesId.EVENTLIST, 'Nouvel Événement', elms.scope[scopeId.EVENT]);
elms.scope[scopeId.STAFF]._create = createUserButtonWithInput;
elms.scope[scopeId.VENUE]._create = createListButtonWithInput(zonesId.VENUELIST, 'Nouveau Lieu', elms.scope[scopeId.VENUE]);

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
  elms.dataListContainer.replaceChildren(elms.scope[scopeId.EVENT]); 
  handleClickOnViewButton(b1, zonesId.DATATYPE);
});
b1.textContent = 'Événements';
b1._dataId = 0;
let b2 = document.createElement('button');
b2.addEventListener('click', () => {
  elms.dataListContainer.replaceChildren(elms.scope[scopeId.STAFF]);
  handleClickOnViewButton(b2, zonesId.DATATYPE);
});
b2.textContent = 'Personnel';
b2._dataId = 1;
let b3 = document.createElement('button');
b3.addEventListener('click', () => {
  elms.dataListContainer.replaceChildren(elms.scope[scopeId.VENUE]);
  handleClickOnViewButton(b3, zonesId.DATATYPE);
});
b3.textContent = 'Lieux';
b3._dataId = 2;
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
    span.classList = "color-grey";
    span.textContent = '#'+id;
    button.appendChild(span);
  }
}

export function composeUsersList() {
  for (const [id, idx] of data.usersId) {
    const name = data.usersName[idx];
    const surname = data.usersSurname[idx];
    let button = createListButton(zonesId.STAFFLIST)();
    elms.scope[scopeId.STAFF].appendChild(button);
    button._dataId = id;
    button._type = buttonType.SIDE_MENU_STAFF; 

    let span = document.createElement('span');
    span.textContent = name+' '+surname;
    button.appendChild(span);
    span = document.createElement('span');
    span.classList = "color-grey";
    span.textContent = '#'+id;
    button.appendChild(span);
    
  }
}

function handleClickOnListButton(b, zn) {
  const z = zones[zn];
  if (z.selection == b._dataId) {
    b.style.setProperty('--bg-color', 'transparent');
    z.selection = -1;
    return;
  }
  b.style.setProperty('--bg-color', palette.blue);
  if (z.selection >= 0) {
    z.eList[z.selection].style.setProperty('--bg-color', 'transparent');
  }
  z.selection = b._dataId;
}
