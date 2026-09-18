declare module "bidi-js" {
  type EmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  };

  type BaseDirection = "ltr" | "rtl" | "auto";

  type BidiApi = {
    getEmbeddingLevels(string: string, baseDirection?: BaseDirection): EmbeddingLevels;
    getReorderSegments(
      string: string,
      embeddingLevels: EmbeddingLevels,
      start?: number | null,
      end?: number | null,
    ): Array<[number, number]>;
    getReorderedString(
      string: string,
      embeddingLevels: EmbeddingLevels,
      start?: number | null,
      end?: number | null,
    ): string;
    getMirroredCharactersMap(
      string: string,
      embeddingLevels: EmbeddingLevels,
      start?: number | null,
      end?: number | null,
    ): Map<number, string>;
    getMirroredCharacter(char: string): string | null;
    getBidiCharTypeName(char: string): string;
  };

  export default function bidiFactory(): BidiApi;
}
