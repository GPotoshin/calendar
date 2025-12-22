package main

import(
  "io"
  "encoding/binary"
  "fmt"
  "log"
)

func writeInt32(w io.Writer, val int32) error {
  return binary.Write(w, binary.LittleEndian, val)
}

func writeString(w io.Writer, s string) error {
  log.Println("writing string ", s) 
  l := int32(len(s))
  if err := writeInt32(w, l); err != nil {
    return err
  }
  return binary.Write(w, binary.LittleEndian, []byte(s))
}

func writeArray[T any](w io.Writer, arr []T, writeT func(io.Writer, T) error) error {
  n := int32(len(arr))
  if err := binary.Write(w, binary.LittleEndian, n); err != nil {
    return fmt.Errorf("failed to write array length: %w", err)
  }

  for i, item := range arr {
    if err := writeT(w, item); err != nil {
      return fmt.Errorf("failed to write element %d: %w", i, err)
    }
  }
  return nil
}

func writeStringArray(w io.Writer, arr []string) error {
  return writeArray(w, arr, writeString)
}

func writeInt32Array(w io.Writer, arr []int32) error {
  return writeArray(w, arr, writeInt32)
}

func writeArrayOfInt32Arrays(w io.Writer, arr [][]int32) error {
  return writeArray(w, arr, writeInt32Array)
}

func readInt32(r io.Reader) (int32, error) {
  var val int32
  err := binary.Read(r, binary.LittleEndian, &val)
  return val, err
}

func readByte(r io.Reader) (byte, error) {
  var val byte
  err := binary.Read(r, binary.LittleEndian, &val)
  return val, err
}

func readString(r io.Reader) (string, error) {
  l, err := readInt32(r)
  if err != nil {
    return "", fmt.Errorf("failed to read string length: %w", err)
  }
  if l < 0 {
    return "", fmt.Errorf("data length is negative: %d", l)
  }

  buffer := make([]byte, l)
  err = binary.Read(r, binary.LittleEndian, buffer)
  if err != nil {
    return "", fmt.Errorf("failed to read string content: %w", err)
  }
  return string(buffer), nil
}

func readArray[T any](r io.Reader, readT func(io.Reader) (T, error)) ([]T, error) {
  var n int32
  if err := binary.Read(r, binary.LittleEndian, &n); err != nil {
    return nil, fmt.Errorf("failed to read array length: %w", err)
  }
  if n < 0 {
    return nil, fmt.Errorf("array length is negative: %d", n)
  }

  N := int(n)
  retval := make([]T, N)

  for i := 0; i < N; i++ {
    item, err := readT(r)
    if err != nil {
      return nil, fmt.Errorf("failed to read element %d: %w", i, err)
    }
    retval[i] = item
  }

  return retval, nil
}

func readStringArray(r io.Reader) ([]string, error) {
  return readArray(r, readString)
}

func readInt32Array(r io.Reader) ([]int32, error) {
  return readArray(r, readInt32)
}

func readArrayOfInt32Arrays(r io.Reader) ([][]int32, error) {
  return readArray(r, readInt32Array)
}
