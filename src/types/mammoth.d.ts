declare module "mammoth" {
  export interface ConversionResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export interface InputOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }

  export function convertToMarkdown(
    input: InputOptions,
    options?: Record<string, unknown>
  ): Promise<ConversionResult>;

  export function convertToHtml(
    input: InputOptions,
    options?: Record<string, unknown>
  ): Promise<ConversionResult>;

  export function extractRawText(input: InputOptions): Promise<ConversionResult>;
}
