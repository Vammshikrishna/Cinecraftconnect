import { useSyncExternalStore } from 'react';
import { subscribeLiveCall, getLiveCallSnapshot, LiveCallSnapshot } from '../services/liveCall';

/** Subscribes a component to the live call engine (participants, speaking, connection state). */
export const useLiveCall = (): LiveCallSnapshot => useSyncExternalStore(subscribeLiveCall, getLiveCallSnapshot);
