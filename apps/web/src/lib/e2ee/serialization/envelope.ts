import { ProtocolEnvelope, CURRENT_PROTOCOL_VERSION, isValidProtocolEnvelope } from './versioning';

export const serializeEnvelope = (envelope: ProtocolEnvelope): string => {
  return JSON.stringify(envelope);
};

export const parseEnvelope = (payloadStr: string): ProtocolEnvelope | null => {
  try {
    const parsed = JSON.parse(payloadStr);
    if (isValidProtocolEnvelope(parsed)) {
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
};
