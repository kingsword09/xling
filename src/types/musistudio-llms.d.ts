declare module "@musistudio/llms" {
  export interface LlmsServerOptions {
    initialConfig?: Record<string, unknown>;
    logger?: boolean | Record<string, unknown>;
  }

  export default class LlmsServer {
    constructor(options?: LlmsServerOptions);
    start(): Promise<void>;
    configService: unknown;
    llmService: unknown;
    providerService: unknown;
    transformerService: unknown;
  }
}
