export class Reader {
  constructor(buf) {
      this.view = new DataView(buf);
      this.offset = 0;
      this.textDecoder = new TextDecode('utf-8');
  }

  readInt32() {
    if (this.offset + 4 > this.view.byteLength) {
      throw new Error("Buffer overrun reading Int32");
    }
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
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
