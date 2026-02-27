import * as Calendar from './calendar.js';
import * as Api from './api.js';
import * as EventInformation from './event_information.js';
import * as Utilities from './utilities.js';
import { palette } from './color.js';
import * as Io from './io.js';
import * as DM from './data_manager.js';
import { numeric_input } from './numeric_input.js';
import {} from './context_menu.js'; // we need it
import * as Global from './global.js';
import { token } from './login.js';
import * as SideMenu from './side_menu.js';
import * as CalendarInformation from './calendar_information.js'

let state = {
  scroll_pos_save: 0,
};

Calendar.init();

{
  Global.elements.views[Global.view_identifier.INFORMATION] = document.createElement('div');
  Global.elements.views[Global.view_identifier.INFORMATION].classList =
    'view-content v-container align-items-center';
}

{
  const writer = new Io.BufferWriter();
  Io.writeHash(writer, token);

  fetch("/data", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: writer.getBuffer(),
  })
    .then(response => {
      Utilities.throwIfNotOk(response);
      response.arrayBuffer().then(
        binary => {
          const reader = new Io.BufferReader(binary);
          Global.data.read(reader)
          SideMenu.composeEventList();
          SideMenu.composeUsersList();
          SideMenu.composeVenueList();
          EventInformation.loadTemplate();
          CalendarInformation.loadTemplate();
          Calendar.renderBars();
          Calendar.swapBuffers();
        });
    })
    .catch(error => {
      console.error('Could not fetch data:', error);
    });
}

{
  let view_type = document.getElementById('view-type');
  let calendar_button = document.createElement('button');
  let information_button = document.createElement('button');
  calendar_button.textContent = 'Calendrier';
  calendar_button._data_identifier = Global.view_identifier.CALENDAR;
  calendar_button.addEventListener('click' ,()=>{
    Global.elements.body_container.replaceChild(Global.elements.views[Global.view_identifier.CALENDER], Global.elements.body_container.children[1]);
    if (Global.zones[Global.zones_identifier.VIEW_TYPE].selection === information_button) {
      // probably we don't need to swap styles, if we do it before rendering
      Global.elements.calendar_body.classList.replace('scroll-smooth', 'scroll-auto');
      Global.elements.calendar_body.scrollTop = state.scroll_pos_save;
      Global.elements.calendar_body.classList.replace('scroll-auto', 'scroll-smooth');
    }
    Global.zones[Global.zones_identifier.VIEW_TYPE].selection = calendar_button;
  });
  information_button.textContent = 'Information';
  information_button._data_identifier = Global.view_identifier.INFORMATION;
  information_button.addEventListener('click' ,()=>{
    if (Global.zones[Global.zones_identifier.VIEW_TYPE].selection === calendar_button) {
      state.scroll_pos_save = Global.elements.calendar_body.scrollTop;
      Global.elements.body_container.replaceChild(Global.elements.views[Global.view_identifier.INFORMATION], Global.elements.body_container.children[1]);
      Global.zones[Global.zones_identifier.VIEW_TYPE].selection = information_button;
    }
    const data_selection = Global.zones[Global.zones_identifier.DATA_TYPE].selection._data_identifier; if (Global.zones[data_selection].selection === null) {
      Global.elements.views[Global.view_identifier.INFORMATION].replaceChildren(CalendarInformation.dom);
    } else if (data_selection === Global.zones_identifier.EVENT) {
      EventInformation.update();
      Global.elements.views[Global.view_identifier.INFORMATION].replaceChildren(EventInformation.dom);
    }
    
  });
  view_type.append(calendar_button, information_button);
  Global.zones[Global.zones_identifier.VIEW_TYPE].selection = calendar_button;
}
