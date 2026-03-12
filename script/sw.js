let token = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_TOKEN') {
    token = event.data.token;
    console.log("Token received in SW!");
  }
});

self.addEventListener('fetch', (event) => {
  console.log("cowabanga")
  if (event.request.url.includes('.js')) {
    const base64Token = btoa(String.fromCharCode(...token));
    const newRequest = new Request(event.request, {
      mode: 'cors',
      headers: {
          'X-Module-Token': base64Token,
      }
    });
    event.respondWith(fetch(newRequest));
  }
});
