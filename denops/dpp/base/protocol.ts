export type BaseProtocolParams = Record<string, unknown>;

export abstract class BaseProtocol<Params extends BaseProtocolParams> {
  apiVersion = 1;

  name = "";
  path = "";
  isInitialized = false;

  abstract params(): Params;
}
