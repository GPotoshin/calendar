export class BufferReader {
  constructor(buf) {
      this.view = new DataView(buf);
      this.offset = 0;
      this.text_decoder = new TextDecoder('utf-8');
  }
}

export function readInt32(reader) {
  if (reader.offset + 4 > reader.view.byteLength) {
    throw new Error("Buffer overrun reading Int32");
  }
  const value = reader.view.getInt32(reader.offset, true);
  reader.offset += 4;
  return value;
}

export function readHash(reader) {
  const length = 32;
  if (reader.offset + length > reader.view.byteLength) {
    throw new Error(`Buffer overrun reading Hash: expected ${length} bytes`);
  }
  const hash = new Uint8Array(reader.view.buffer.slice(reader.offset, reader.offset + length));
  reader.offset += length;

  return hash;
}

export function readBytes(reader) {
  const length = readInt32(reader);
  if (length < 0) {
    throw new Error(`Invalid byte array length: ${length}`);
  }
  if (reader.offset + length > reader.view.byteLength) {
    throw new Error(`Buffer overrun reading Bytes of length ${length}`);
  }

  const bytes = new Uint8Array(reader.view.buffer.slice(reader.offset, reader.offset + length));
  reader.offset += length;
  return bytes;
}

export function readMapInt32Int(reader) {
  const size = readInt32(reader);
  const map = new Map();
  for (let i = 0; i < size; i++) {
    const key = readInt32(reader);
    const value = readInt32(reader);
    map.set(key, value);
  }
  return map;
}

export function readString(reader) {
  const length = readInt32(reader);
  if (length < 0) {
    throw new Error(`Invalid string length: ${length}`);
  }
  if (reader.offset + length > reader.view.byteLength) {
    throw new Error(`Buffer overrun reading String of length ${length}`);
  }

  const string_bytes = new Uint8Array(reader.view.buffer, reader.offset, length);
  const value = reader.text_decoder.decode(string_bytes);
  reader.offset += length;
  return value;
}

export function readStringWithLimit(reader, limit) {
  const length = readInt32(reader);
  if (length < 0 || length > limit) {
    throw new Error(`Invalid string length: ${length}`);
  }
  if (reader.offset + length > reader.view.byteLength) {
    throw new Error(`Buffer overrun reading String of length ${length}`);
  }

  const string_bytes = new Uint8Array(reader.view.buffer, reader.offset, length);
  const value = reader.text_decoder.decode(string_bytes);
  reader.offset += length;
  return value;
}

export function readArray(reader, readChild) {
  const N = readInt32(reader);
  if (N < 0) {
    throw new Error(`Invalid array length: ${arrayLength}`);
  }
  const array = [];

  for (let i = 0; i < N; i++) {
    array.push(readChild(reader));
  }
  return array;
}

export function readStringArray(reader) {
  return readArray(reader, readString);
}

export function readInt32Array(reader) {
  return readArray(reader, readInt32);
}

export function readArrayOfInt32Arrays(reader) {
  return readArray(reader, readInt32Array);
}

export function readArrayOfArrayOfInt32Arrays(reader) {
  return readArray(reader, readArrayOfInt32Arrays);
}

export function readInt32Pair(reader) {
  return [readInt32(reader), readInt32(reader)];
}

export function readInt32PairArray(reader) {
  return readArray(reader, readInt32Pair);
}

export function readArrayOfInt32PairArrays(reader) {
  return readArray(reader, readInt32PairArray);
}

export class BufferWriter {
  constructor(initialSize = 1024) {
    this.buffer = new ArrayBuffer(initialSize);
    this.view = new DataView(this.buffer);
    this.offset = 0;
    this.textEncoder = new TextEncoder();
  }

  // Ensure buffer has enough space, resize if needed
  ensureCapacity(additionalBytes) {
    const required = this.offset + additionalBytes;
    if (required > this.buffer.byteLength) {
      const new_size = Math.max(required, this.buffer.byteLength * 2);
      const new_buffer = new ArrayBuffer(new_size);
      new Uint8Array(new_buffer).set(new Uint8Array(this.buffer));
      this.buffer = new_buffer;
      this.view = new DataView(this.buffer);
    }
  }

  // Get the final buffer with only the written data
  getBuffer() {
    return this.buffer.slice(0, this.offset);
  }
}

export function writeInt32(writer, value) {
  writer.ensureCapacity(4);
  writer.view.setInt32(writer.offset, value, true);
  writer.offset += 4;
}

export function writeHash(writer, hash_bytes) {
  if (hash_bytes.length !== 32) {
    throw new Error(`Invalid hash length: expected 32, got ${hash_bytes.length}`);
  }
  writer.ensureCapacity(32);
  new Uint8Array(writer.buffer, writer.offset, 32).set(hash_bytes);
  writer.offset += 32;
}

export function writeInt32Pair(writer, pair) {
  if (pair.length !== 2) {
    throw new Error(`Invalid pair length: expected 2, got ${pair.length}`);
  }
  writer.ensureCapacity(8);
  writer.view.setInt32(writer.offset, pair[0], true);
  writer.offset += 4;
  writer.view.setInt32(writer.offset, pair[1], true);
  writer.offset += 4;
}

export function writeString(writer, string) {
  const encoded = writer.textEncoder.encode(string);
  const length = encoded.length;
  writeInt32(writer, length);
  writer.ensureCapacity(length);
  new Uint8Array(writer.buffer, writer.offset, length).set(encoded);
  writer.offset += length;
}

export function writeArray(writer, array, writeChild) { 
  writeInt32(writer, array.length);
  for (const item of array) {
    writeChild(writer, item);
  }
}

export function writeUint8Array(writer, array) {
  writeInt32(writer, array.length);
  writer.ensureCapacity(array.length);
  new Uint8Array(writer.buffer, writer.offset, array.length).set(array);
  writer.offset += array.length;
}

export function writeStringArray(writer, array) {
  writeArray(writer, array, writeString);
}

export function writeInt32Array(writer, array) {
  writeArray(writer, array, writeInt32);
}

export function writeArrayOfInt32Arrays(writer, arrays) {
  writeArray(writer, arrays, writeInt32Array);
}

export function writeArrayOfInt32Pairs(writer, array) {
  writeArray(writer, array, writeInt32Pair)
}
