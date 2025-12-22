const idInput = document.getElementById('id');
const passwordInput = document.getElementById('password');
const connectButton = document.getElementById('connect');

let publicKey = null;

async function importPublicKey(pemKey) {
  const pemContents = pemKey
    .replace(/-----BEGIN RSA PUBLIC KEY-----/, '')
    .replace(/-----END RSA PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryDer = atob(pemContents);
  const binaryArray = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    binaryArray[i] = binaryDer.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'spki',
    binaryArray.buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

async function generateMachineHash() {
  const data = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset()
  ].join('|');

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function encryptCredentials(username, password) {
  if (!publicKey) {
    throw new Error('Public key not loaded');
  }

  const credentials = {
    username: username,
    password: password,
    timestamp: Math.floor(Date.now() / 1000),
    machineHash: await generateMachineHash()
  };

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(credentials));

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    publicKey,
    dataBuffer
  );

  const encryptedArray = new Uint8Array(encryptedBuffer);
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
  
  return encryptedBase64;
}

async function sendLoginRequest(encryptedData) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ encryptedData })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }

  return await response.json();
}

(async function initializeAuth() {
  try {
    console.log('Fetching public key...');
    const response = await fetch('/api/public-key');
    const data = await response.json();
    publicKey = await importPublicKey(data.publicKey);
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
    alert('Please enter both username and password');
    return;
  }

  if (!publicKey) {
    alert('Authentication not ready. Please wait or refresh the page.');
    return;
  }

  connectButton.disabled = true;
  const originalText = connectButton.textContent;
  connectButton.textContent = 'Connecting...';

  try {
    console.log('Encrypting credentials...');
    const encryptedData = await encryptCredentials(username, password);

    console.log('Sending login request...');
    const result = await sendLoginRequest(encryptedData);

    console.log('Login successful:', result);
    
    if (result.token) {
      localStorage.setItem('authToken', result.token);
    }

    passwordInput.value = '';

    alert('Login successful!');

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
