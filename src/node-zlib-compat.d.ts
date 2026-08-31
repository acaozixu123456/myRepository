declare module 'node:zlib' {
  export function inflateRawSync(data: import('node:buffer').Buffer): import('node:buffer').Buffer;
}
