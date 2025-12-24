package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"io"
	"log"
  "fmt"
	"net/http"
	"sync"
	"time"
  "bytes"
  "os"
)

func (s *ApplicationState) generateKeys() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	s.privateKey = privateKey
	s.keyGeneratedAt = time.Now()
	s.publicKey, err = x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	return err
}

func (s *ApplicationState) getPublicKey() []byte {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
  retval := make([]byte, 32)
  copy(retval, s.publicKey)
	return retval
}

func (s *ApplicationState) decrypt(data []byte) ([]byte, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return rsa.DecryptOAEP(sha256.New(), rand.Reader, s.privateKey, data, nil)
}

func (s *ApplicationState) generateToken() ([32]byte, error) {
  const maxRetries = 10

  for i := 0; i < maxRetries; i++ {
    tokenBytes := make([]byte, 32)
    if _, err := rand.Read(tokenBytes); err != nil {
      return [32]byte{}, fmt.Errorf("entropy source error: %w", err)
    }

    token := [32]byte(tokenBytes)

    s.tokensMutex.Lock()
    _, exists := s.tokens[token]
    if !exists {
      s.tokens = append(s.tokens, [32]byte(tokenBytes))
      s.tokensMutex.Unlock()
      return s.token, nil
    }
    s.tokensMutex.Unlock()
  }

  return [32]byte{}, fmt.Errorf("failed to generate unique token after %d attempts", maxRetries)
}

func (a *AuthSystem) storeToken(token [32]byte, username int32) {
	a.tokensMutex.Lock()
	defer a.tokensMutex.Unlock()

	now := time.Now()
	a.tokens[token] = TokenData{
		Username:  username,
		CreatedAt: now,
		ExpiresAt: now.Add(5 * time.Minute),
	}
}

func (a *AuthSystem) validateToken(token [32]byte) (int32, bool) {
	a.tokensMutex.RLock()
	defer a.tokensMutex.RUnlock()

	data, exists := a.tokens[token]
	if !exists {
		return -1, false
	}

	if time.Now().After(data.ExpiresAt) {
		return -1, false
	}

	return data.Username, true
}

func (a *AuthSystem) cleanupExpiredTokens() {
	a.tokensMutex.Lock()
	defer a.tokensMutex.Unlock()

	now := time.Now()
	for token, data := range a.tokens {
		if now.After(data.ExpiresAt) {
			delete(a.tokens, token)
		}
	}
}

func initAuth() {
  authSys.tokens = make(map[[32]byte]TokenData)
}

func startKeyRotation() {
  if err := authSys.generateKeys(); err != nil {
    log.Printf("Failed to iniate auth keys: %v\n", err)
    os.Exit(1)
  }
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			log.Println("Rotating RSA keys...")
			if err := authSys.generateKeys(); err != nil {
				log.Printf("Failed to rotate keys: %v\n", err)
			} else {
				log.Println("Keys rotated successfully")
			}
		}
	}()
}

func startTokenCleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			authSys.cleanupExpiredTokens()
		}
	}()
}

func handlePublicKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	pubKey := authSys.getPublicKey()
	if err := writeBytes(w, pubKey); err != nil {
		log.Printf("Failed to write public key: %v\n", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
  fmt.Println("Handeling login")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	encryptedSize, err := readInt32(r.Body)
	if err != nil {
		log.Printf("Failed to read encrypted data size: %v\n", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	if encryptedSize < 0 || encryptedSize > 1024*1024 {
		log.Printf("Invalid encrypted data size: %d\n", encryptedSize)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	encryptedData := make([]byte, encryptedSize)
	if _, err := io.ReadFull(r.Body, encryptedData); err != nil {
		log.Printf("Failed to read encrypted data: %v\n", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	decryptedData, err := authSys.decrypt(encryptedData)
	if err != nil {
		log.Printf("Failed to decrypt data: %v\n", err)
		if err := writeInt32(w, 0); err != nil {
			log.Printf("Failed to write failure response: %v\n", err)
		}
		return
	}

  reader := bytes.NewReader(decryptedData)

	username, err := readInt32(reader)
	if err != nil {
		log.Printf("Failed to parse username: %v\n", err)
		return
	}

	password, err := readHash(reader)
	if err != nil {
		log.Printf("Failed to parse password: %v\n", err)
		return
	}

  for i := 0; i < len(state.UserIDs); i++ {
		if username == state.UserIDs[i] && password == state.UserPasswords[i] {
      token, err := authSys.generateToken()
      if err != nil {
        log.Printf("Failed to generate token: %v\n", err)
        http.Error(w, "Internal server error", http.StatusInternalServerError)
        return
      }

      authSys.storeToken(token, username)

      if err := writeHash(w, token); err != nil {
        log.Printf("Failed to write token: %v\n", err)
        return
      }

      appHtml, err := composeApp()
      fmt.Println("Application length: ", len(appHtml))
      if err != nil {
        log.Printf("failed to compose App");
      }
      if err := writeBytes(w, appHtml); err != nil {
        log.Printf("Failed to write App: %v\n", err)
        return
      }
      log.Printf("User %s logged in successfully\n", username)
      return
    }
  }

  http.Error(w, "Internal server error", http.StatusUnauthorized)
}
