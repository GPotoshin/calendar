export class BufferReader {
  constructor(buf) {
      this.view = new DataView(buf);
      this.offset = 0;
      this.textDecoder = new TextDecoder('utf-8');
  }

  readInt32() {
    if (this.offset + 4 > this.view.byteLength) {
      throw new Error("Buffer overrun reading Int32");
    }
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readHash() {
    const length = 32;
    if (this.offset + length > this.view.byteLength) {
      throw new Error(`Buffer overrun reading Hash: expected ${length} bytes`);
    }
    const hash = new Uint8Array(this.view.buffer.slice(this.offset, this.offset + length));
    this.offset += length;
    
    return hash;
  }

  readBytes() {
    const length = this.readInt32();
    if (length < 0) {
        throw new Error(`Invalid byte array length: ${length}`);
    }
    if (this.offset + length > this.view.byteLength) {
        throw new Error(`Buffer overrun reading Bytes of length ${length}`);
    }

    const bytes = new Uint8Array(this.view.buffer.slice(this.offset, this.offset + length));
    this.offset += length;
    return bytes;
}

  readString() {
    const length = this.readInt32();
    if (length < 0) {
      throw new Error(`Invalid string length: ${length}`);
    }
    if (this.offset + length > this.view.byteLength) {
      throw new Error(`Buffer overrun reading String of length ${length}`);
    }

    const stringBytes = new Uint8Array(this.view.buffer, this.offset, length);
    const value = this.textDecoder.decode(stringBytes);
    this.offset += length;
    return value;
  }

  readArray(readChild) {
    const N = this.readInt32();
    if (N < 0) {
      throw new Error(`Invalid array length: ${arrayLength}`);
    }
    const array = [];

    for (let i = 0; i < N; i++) {
      array.push(readChild.call(this));
    }
    return array;
  }

  readStringArray() {
    return this.readArray(this.readString);
  }

  readInt32Array() {
    return this.readArray(this.readInt32);
  }

  readArrayOfInt32Arrays() {
    return this.readArray(this.readInt32Array);
  }
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
      const newSize = Math.max(required, this.buffer.byteLength * 2);
      const newBuffer = new ArrayBuffer(newSize);
      new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));
      this.buffer = newBuffer;
      this.view = new DataView(this.buffer);
    }
  }

  writeInt32(value) {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
  }

  writeHash(hashBytes) {
    if (hashBytes.length !== 32) {
      throw new Error(`Invalid hash length: expected 32, got ${hashBytes.length}`);
    }
    this.ensureCapacity(32);
    new Uint8Array(this.buffer, this.offset, 32).set(hashBytes);
    this.offset += 32;
  }

  writeString(str) {
    const encoded = this.textEncoder.encode(str);
    const length = encoded.length;
    this.writeInt32(length);
    this.ensureCapacity(length);
    new Uint8Array(this.buffer, this.offset, length).set(encoded);
    this.offset += length;
  }

  writeArray(array, writeChild) {
    this.writeInt32(array.length);
    for (const item of array) {
      writeChild.call(this, item);
    }
  }

  writeUint8Array(array) {
    this.writeInt32(array.length);
    this.ensureCapacity(array.length);
    new Uint8Array(this.buffer, this.offset, array.length).set(array);
    this.offset += array.length;
  }

  writeStringArray(array) {
    this.writeArray(array, this.writeString);
  }

  writeInt32Array(array) {
    this.writeArray(array, this.writeInt32);
  }

  writeArrayOfInt32Arrays(arrays) {
    this.writeArray(arrays, this.writeInt32Array);
  }

  // Get the final buffer with only the written data
  getBuffer() {
    return this.buffer.slice(0, this.offset);
  }
}
