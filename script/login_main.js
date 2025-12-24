import { BufferReader, BufferWriter } from './io.js';
const idInput = document.getElementById('id');
const passwordInput = document.getElementById('password');
const connectButton = document.getElementById('connect');

idInput.addEventListener('input', () => {
  idInput.value = idInput.value.replace(/\D/g, '');
});

let publicKey = null;

async function encryptCredentials(buf) {
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    publicKey,
    buf
  );

  var bw = new BufferWriter();
  bw.writeUint8Array(new Uint8Array(encryptedBuffer));

  return bw.getBuffer();
}

(async function initializeAuth() {
  try {
    console.log('Fetching public key...');
    const response = await fetch('/api/public-key');
    if (!response.ok) throw new Error('Network response was not ok');
    const buffer = await response.arrayBuffer();
    const reader = new BufferReader(buffer);

    const publicKeyBytes = reader.readBytes();
    publicKey = await window.crypto.subtle.importKey(
      "spki",
      publicKeyBytes,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
    console.log('Public key received');
  } catch (error) {
    console.error('Failed to fetch public key:', error);
    alert('Failed to initialize authentication. Please refresh the page.');
  }
})();

connectButton.addEventListener('click', async () => {
  const username = idInput.value.trim();
  const password = passwordInput.value;

  // Validate input
  if (!username || !password) {
    alert('Please enter both username and password'); // @nocheckin
    return;
  }

  if (!publicKey) {
    alert('Authentication not ready. Please wait or refresh the page.'); // @nocheckin
    return;
  }

  connectButton.disabled = true;
  const originalText = connectButton.textContent;
  connectButton.textContent = 'Connecting...';

  try {
    if (!publicKey) {
      throw new Error('Public key not loaded');
    }

    let bw = new BufferWriter();
    bw.writeInt32(Number(username))

    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', passwordData);
    const hashBytes = new Uint8Array(hashBuffer);

    bw.writeHash(hashBytes);

    const timestamp = Math.floor(Date.now() / 1000);
    bw.writeInt32(timestamp);

    const encryptedData = await encryptCredentials(bw.getBuffer());
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: encryptedData,
    });

    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }
    const bin = await resp.arrayBuffer();
    const r = new BufferReader(bin);

    let token = r.readHash();
    let html = r.readString();
    document.body.innerHTML = html;

    passwordInput.value = '';

    import('./main.js')
    .then((module) => {
        module.initApp(token);
    })
    .catch((err) => {
        console.error("Failed to load main.js:", err);
    });const script = document.createElement('script');
  } catch (error) {
    alert('Login failed: ' + error.message);
  } finally {
    connectButton.disabled = false;
    connectButton.textContent = originalText;
  }
});

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectButton.click();
  }
});
