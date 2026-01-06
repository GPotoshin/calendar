package main

import(
  "io"
  "encoding/binary"
  "fmt"
)

func writeInt32(w io.Writer, val int32) error {
  return binary.Write(w, binary.LittleEndian, val)
}

func writeInt(w io.Writer, val int) error {
  return binary.Write(w, binary.LittleEndian, int32(val))
}

func writeInt32Pair(w io.Writer, val [2]int32) error {
  return binary.Write(w, binary.LittleEndian, val)
}

func writeBytes(w io.Writer, val []byte) error {
  l := int32(len(val))
  if err := writeInt32(w, l); err != nil {
    return err
  }
  return binary.Write(w, binary.LittleEndian, val)
}

func writeHash(w io.Writer, val [32]byte) error {
  return binary.Write(w, binary.LittleEndian, val)
}

func writeString(w io.Writer, s string) error {
  l := int32(len(s))
  if err := writeInt32(w, l); err != nil {
    return err
  }
  return binary.Write(w, binary.LittleEndian, []byte(s))
}

func writeMap[K comparable, V any](w io.Writer, m map[K]V, writeK func(io.Writer, K) error, writeV func(io.Writer, V) error) error {
  err := writeInt32(w, int32(len(m)))
  if err != nil {
    return fmt.Errorf("failed to write map size: %w", err)
  }

  for k, v := range m {
    if err := writeK(w, k); err != nil {
      return fmt.Errorf("failed to read map key: %w", err)
    }
    if err := writeV(w, v); err != nil {
      return fmt.Errorf("failed to read map value: %w", err)
    }
  }

  return nil
}

func writeMapInt32Int(w io.Writer, m map[int32]int) error {
  return writeMap(w, m, writeInt32, writeInt)
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

func writeBytesArray(w io.Writer, arr [][]byte) error {
  return writeArray(w, arr, writeBytes)
}

func writeStringArray(w io.Writer, arr []string) error {
  return writeArray(w, arr, writeString)
}

func writeInt32Array(w io.Writer, arr []int32) error {
  return writeArray(w, arr, writeInt32)
}

func writeHashArray(w io.Writer, arr [][32]byte) error {
  return writeArray(w, arr, writeHash)
}

func writeArrayOfInt32Arrays(w io.Writer, arr [][]int32) error {
  return writeArray(w, arr, writeInt32Array)
}

func writeArrayOfArrayOfInt32Arrays(w io.Writer, arr [][][]int32) error {
  return writeArray(w, arr, writeArrayOfInt32Arrays)
}

func writeInt32PairArray(w io.Writer, arr [][2]int32) error {
  return writeArray(w, arr, writeInt32Pair)
}

func writeArrayOfInt32PairArrays(w io.Writer, arr [][][2]int32) error {
  return writeArray(w, arr, writeInt32PairArray)
}

func readFixed[T comparable](r io.Reader) (T, error) {
  var val T
  err := binary.Read(r, binary.LittleEndian, &val)
  return val, err
}

func readInt32(r io.Reader) (int32, error) {
  var val int32
  err := binary.Read(r, binary.LittleEndian, &val)
  return val, err
}

func readInt(r io.Reader) (int, error) {
  val, err := readInt32(r)
  return int(val), err
}
func readInt32Pair(r io.Reader) ([2]int32, error) {
  var val [2]int32
  err := binary.Read(r, binary.LittleEndian, &val)
  return val, err
}

func readByte(r io.Reader) (byte, error) {
  var val byte
  err := binary.Read(r, binary.LittleEndian, &val)
  return val, err
}

func readHash(r io.Reader) ([32]byte, error) {
  var val [32]byte
  err := binary.Read(r, binary.LittleEndian, &val)
  return val, err
}

func readBytes(r io.Reader) ([]byte, error) {
  l, err := readInt32(r)
  if err != nil {
    return nil, fmt.Errorf("failed to read string length: %w", err)
  }
  if l < 0 {
    return nil, fmt.Errorf("data length is negative: %d", l)
  }
  buffer := make([]byte, l)
  err = binary.Read(r, binary.LittleEndian, buffer)
  if err != nil {
    return nil, fmt.Errorf("failed to read string content: %w", err)
  }
  return buffer, nil
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

func readMap[K comparable, V any](r io.Reader, readK func(io.Reader) (K, error), readV func(io.Reader) (V, error)) (map[K]V, error) {
  l, err := readInt32(r)
  if err != nil {
    return nil, fmt.Errorf("failed to read map size: %w", err)
  }
  if l < 0 {
    return nil, fmt.Errorf("data length is negative: %d", l)
  }
  retval := make(map[K]V)
  var i int32
  for i = 0; i < l; i++ {
    key, err := readK(r)
    if err != nil {
      return nil, fmt.Errorf("failed to read map key: %w", err)
    }
    value, err := readV(r)
    if err != nil {
      return nil, fmt.Errorf("failed to read map value: %w", err)
    }
    retval[key] = value
  }
  
  return retval, nil
}


func readMapInt32Int(r io.Reader) (map[int32]int, error) {
  return readMap(r, readInt32, readInt)
}

// We should make 2 functions. One reads arrays of fixed length types just
// with a single binary read call.
// And the other shoud be written in the same spirit as one bellow with a
// child read function, but we should reference to the length of objects from a
// start index table, which is just a prepended int32 array, which stores all
// the indices and also and at the last position the total length in bytes. Every
// thing is in bytes, so that we don't really depend on types and indices. We
// just later as the date being read reinterpet it a the new type.
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

func readHashArray(r io.Reader) ([][32]byte, error) {
  return readArray(r, readHash)
}

func readBytesArray(r io.Reader) ([][]byte, error) {
  return readArray(r, readBytes)
}

func readInt32Array(r io.Reader) ([]int32, error) {
  return readArray(r, readInt32)
}

func readArrayOfInt32Arrays(r io.Reader) ([][]int32, error) {
  return readArray(r, readInt32Array)
}

func readArrayOfArrayOfInt32Arrays(r io.Reader) ([][][]int32, error) {
  return readArray(r, readArrayOfInt32Arrays)
}

func readInt32PairArray(r io.Reader) ([][2]int32, error) {
  return readArray(r, readInt32Pair)
}

func readArrayOfInt32PairArrays(r io.Reader) ([][][2]int32, error) {
  return readArray(r, readInt32PairArray)
}
