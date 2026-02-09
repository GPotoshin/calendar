import * as Calendar from './calendar.js';
import * as Api from './api.js';
import * as EventInformation from './event_information.js';
import * as Utils from './utils.js';
import { palette } from './color.js';
import { BufferReader, BufferWriter } from './io.js';
import * as DM from './data_manager.js';
import { numeric_input } from './numeric_input.js';
import {} from './context_menu.js'; // we need it
import {
  callbacks,
  elements,
  zones_identifier,
  view_identifier,
  zones,
  data,
} from './global_state.js';
import { token } from './login.js';
import * as SideMenu from './side_menu.js';
import * as CalendarInformation from './calendar_information.js'

const MS_IN_DAY = 86400000;

let state = {
  scrollPosSave: 0,
};

Calendar.init();

{
  elements.veiws[view_identifier.INFORMATION] = document.createElement('div');
  elements.veiws[view_identifier.INFORMATION].classList =
    'view-content v-container align-items-center';
}

{
  const writer = new BufferWriter();
  writer.writeHash(token);

  fetch("/data", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: writer.getBuffer(),
  })
    .then(response => {
      Utils.throwIfNotOk(resp);
      response.arrayBuffer().then(
        binary => {
          const reader = new BufferReader(binary);
          data.read(reader)
          SideMenu.composeList(data.events_identifier, data.events_name, zones_identifier.EVENT);
          SideMenu.composeUsersList();
          SideMenu.composeList(data.venues_identifier, data.venues_name, zones_identifier.VENUE);
          EventInformation.loadTemplate();
          CalendarInformation.loadTemplate();
        });
    })
    .catch(e => {
      console.error('Could not fetch data:', e);
    });
}

{
  let view_type = document.getElementById('view-type');
  let calendar_button = document.createElement('button');
  let information_button = document.createElement('button');
  calendar_button.textContent = 'Calendrier';
  calendar_button._data_identifier = view_identifier.CALENDAR;
  calendar_button.addEventListener('click' ,()=>{
    elements.body_container.replaceChild(elements.veiws[view_identifier.CALENDER], elements.body_container.children[1]);
    if (zones[zones_identifier.VIEW_TYPE].selection === information_button) {
      // probably we don't need to swap styles, if we do it before rendering
      elements.calendar_body.classList.replace('scroll-smooth', 'scroll-auto');
      elements.calendar_body.scrollTop = state.scrollPosSave;
      elements.calendar_body.classList.replace('scroll-auto', 'scroll-smooth');
    }
    zones[zones_identifier.VIEW_TYPE].selection = calendar_button;
  });
  information_button.textContent = 'Informationrmation';
  information_button._data_identifier = view_identifier.INFORMATION;
  information_button.addEventListener('click' ,()=>{
    if (zones[zones_identifier.VIEW_TYPE].selection === calendar_button) {
      state.scrollPosSave = elements.calendar_body.scrollTop;
      elements.body_container.replaceChild(elements.veiws[view_identifier.INFORMATION], elements.body_container.children[1]);
      zones[zones_identifier.VIEW_TYPE].selection = information_button;
    }
    const data_selection = zones[zones_identifier.DATA_TYPE].selection._data_id;
    if (zones[data_selection].selection === null) {
      elements.veiws[view_identifier.INFORMATION].replaceChildren(CalendarInformation.dom);
    } else if (data_selection === zones_identifier.EVENT) {
      EventInformation.update();
      elements.veiws[view_identifier.INFORMATION].replaceChildren(EventInformation.dom);
    }
    
  });
  view_type.append(calendar_button, information_button);
  zones[zones_identifier.VIEW_TYPE].selection = calendar_button;
}
