const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

export interface PngTextChunk {
  keyword: string;
  text: string;
}

function concatBytes(...chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function writeUint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isPng(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function encodeLatin1Text(text: string) {
  return new TextEncoder().encode(text);
}

function decodeLatin1Text(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function createChunk(type: string, data: Uint8Array) {
  const typeBytes = encodeLatin1Text(type);
  const crc = crc32(concatBytes(typeBytes, data));
  return concatBytes(writeUint32(data.length), typeBytes, data, writeUint32(crc));
}

function createTextChunk(keyword: string, text: string) {
  return createChunk("tEXt", concatBytes(encodeLatin1Text(keyword), new Uint8Array([0]), encodeLatin1Text(text)));
}

export function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

export function decodeBase64Utf8(value: string) {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(value, "base64").toString("utf8");
}

export function writeCharacterCardTextChunks(pngBytes: Uint8Array, formattedJson: string) {
  if (!isPng(pngBytes)) {
    throw new Error("上传图片转换后的文件不是有效 PNG。");
  }

  const encodedJson = encodeBase64Utf8(formattedJson);
  const outputChunks: Uint8Array[] = [PNG_SIGNATURE];
  let offset = PNG_SIGNATURE.length;
  let inserted = false;

  while (offset < pngBytes.length) {
    const length = readUint32(pngBytes, offset);
    const typeOffset = offset + 4;
    const dataOffset = typeOffset + 4;
    const chunkEnd = dataOffset + length + 4;
    const type = decodeLatin1Text(pngBytes.slice(typeOffset, dataOffset));

    if (type === "IEND" && !inserted) {
      outputChunks.push(createTextChunk("chara", encodedJson), createTextChunk("ccv3", encodedJson));
      inserted = true;
    }

    outputChunks.push(pngBytes.slice(offset, chunkEnd));
    offset = chunkEnd;
  }

  if (!inserted) {
    throw new Error("PNG 缺少 IEND 区块，无法写入角色卡数据。");
  }

  return concatBytes(...outputChunks);
}

export function readPngTextChunks(pngBytes: Uint8Array): PngTextChunk[] {
  if (!isPng(pngBytes)) {
    throw new Error("不是有效 PNG。");
  }

  const chunks: PngTextChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < pngBytes.length) {
    const length = readUint32(pngBytes, offset);
    const typeOffset = offset + 4;
    const dataOffset = typeOffset + 4;
    const chunkEnd = dataOffset + length + 4;
    const type = decodeLatin1Text(pngBytes.slice(typeOffset, dataOffset));

    if (type === "tEXt") {
      const data = pngBytes.slice(dataOffset, dataOffset + length);
      const separator = data.indexOf(0);
      if (separator > -1) {
        chunks.push({
          keyword: decodeLatin1Text(data.slice(0, separator)),
          text: decodeLatin1Text(data.slice(separator + 1)),
        });
      }
    }

    offset = chunkEnd;
  }

  return chunks;
}

export function readCharacterCardJsonFromPng(pngBytes: Uint8Array) {
  const chunks = readPngTextChunks(pngBytes);
  const ccv3 = chunks.find((chunk) => chunk.keyword === "ccv3");
  const chara = chunks.find((chunk) => chunk.keyword === "chara");
  const chunk = ccv3 ?? chara;
  if (!chunk) {
    throw new Error("PNG 中没有可读取的角色卡数据。");
  }

  return decodeBase64Utf8(chunk.text);
}

export async function imageFileToPngBytes(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("仅支持 JPG、PNG 和 WebP 图片。");
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("浏览器无法创建图片转换画布。");
  }

  context.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
      } else {
        reject(new Error("图片转换为 PNG 失败。"));
      }
    }, "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}
