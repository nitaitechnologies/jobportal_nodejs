export interface StoredObject {
  storageKey: string;
  size: number;
}

export interface StorageAdapter {
  readonly provider: string;
  upload(input: {
    storageKey: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<StoredObject>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
  /** Absolute or provider-relative path for reading private/public bytes. */
  resolvePath(storageKey: string): string;
  getPublicUrl(storageKey: string): string;
  /**
   * Optional signed URL for future object-storage providers.
   * Local adapter returns empty string (use controlled download instead).
   */
  getSignedUrl?(storageKey: string, expiresInSeconds?: number): Promise<string>;
}
