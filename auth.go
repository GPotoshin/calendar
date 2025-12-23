package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/pem"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

type AuthSystem struct {
	privateKey    *rsa.PrivateKey
	publicKeyPEM  []byte
	keyGeneratedAt time.Time
	mutex         sync.RWMutex
	tokens        map[string]TokenData
	tokensMutex   sync.RWMutex
}

type TokenData struct {
	Username  string
	CreatedAt time.Time
	ExpiresAt time.Time
}

var authSys AuthSystem

func (a *AuthSystem) generateKeys() error {
	a.mutex.Lock()
	defer a.mutex.Unlock()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	a.privateKey = privateKey
	a.keyGeneratedAt = time.Now()
	pubKeyBytes, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		return err
	}
	pubKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubKeyBytes,
	})
	a.publicKeyPEM = pubKeyPEM
	return nil
}

func (a *AuthSystem) getPublicKey() []byte {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	return a.publicKeyPEM
}

func (a *AuthSystem) decrypt(ciphertext []byte) ([]byte, error) {
	a.mutex.RLock()
	defer a.mutex.RUnlock()
	return rsa.DecryptOAEP(sha256.New(), rand.Reader, a.privateKey, ciphertext, nil)
}

func (a *AuthSystem) generateToken() (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	return string(tokenBytes), nil
}

func (a *AuthSystem) storeToken(token, username string) {
	a.tokensMutex.Lock()
	defer a.tokensMutex.Unlock()

	now := time.Now()
	a.tokens[token] = TokenData{
		Username:  username,
		CreatedAt: now,
		ExpiresAt: now.Add(5 * time.Minute),
	}
}

func (a *AuthSystem) validateToken(token string) (string, bool) {
	a.tokensMutex.RLock()
	defer a.tokensMutex.RUnlock()

	data, exists := a.tokens[token]
	if !exists {
		return "", false
	}

	if time.Now().After(data.ExpiresAt) {
		return "", false
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

func startKeyRotation() {
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
	if err := writeString(w, string(pubKey)); err != nil {
		log.Printf("Failed to write public key: %v\n", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
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

	username, err := readStringFromBytes(decryptedData)
	if err != nil {
		log.Printf("Failed to parse username: %v\n", err)
		if err := writeInt32(w, 0); err != nil {
			log.Printf("Failed to write failure response: %v\n", err)
		}
		return
	}

	password, err := readStringFromBytes(decryptedData[4+len(username):])
	if err != nil {
		log.Printf("Failed to parse password: %v\n", err)
		if err := writeInt32(w, 0); err != nil {
			log.Printf("Failed to write failure response: %v\n", err)
		}
		return
	}

	// TODO: Validate credentials against database
	// For now, accept any non-empty credentials
	if username == "" || password == "" {
		log.Println("Empty credentials provided")
		if err := writeInt32(w, 0); err != nil {
			log.Printf("Failed to write failure response: %v\n", err)
		}
		return
	}

	token, err := authSys.generateToken()
	if err != nil {
		log.Printf("Failed to generate token: %v\n", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	authSys.storeToken(token, username)

	if err := writeInt32(w, 1); err != nil {
		log.Printf("Failed to write success flag: %v\n", err)
		return
	}

	if err := writeString(w, token); err != nil {
		log.Printf("Failed to write token: %v\n", err)
		return
	}

	log.Printf("User %s logged in successfully\n", username)
}

func readStringFromBytes(data []byte) (string, error) {
	if len(data) < 4 {
		return "", io.ErrUnexpectedEOF
	}
	length := int32(data[0]) | int32(data[1])<<8 | int32(data[2])<<16 | int32(data[3])<<24
	if length < 0 || int(length) > len(data)-4 {
		return "", io.ErrUnexpectedEOF
	}
	return string(data[4 : 4+length]), nil
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Auth-Token")
		if token == "" {
			http.Redirect(w, r, "/auth", http.StatusSeeOther)
			return
		}

		if _, valid := authSys.validateToken(token); !valid {
			http.Redirect(w, r, "/auth", http.StatusSeeOther)
			return
		}

		next(w, r)
	}
}
