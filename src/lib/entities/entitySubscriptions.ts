import { entityStore, EntityType } from './entityStore';
import { useState, useEffect } from 'react';
import { hydrationPriority } from '../hydration/hydrationPriority';

export function useEntity<T = any>(type: EntityType, id: string) {
  const [data, setData] = useState<T | null>(() => entityStore.get(type, id));

  useEffect(() => {
    // Register visibility for priority governance
    // In a real app, this would be hooked into an IntersectionObserver
    hydrationPriority.setTarget(id, type, true);

    const unsubscribe = entityStore.subscribe(type, id, (newData) => {
      setData(newData);
    });

    return () => {
      unsubscribe();
      hydrationPriority.removeTarget(id);
    };
  }, [type, id]);

  return data;
}

class EntitySubscriptionManager {
  // Logic for managing multi-entity observers or custom scope logic
  // could be expanded here to handle feed-level optimizations.
}

export const entitySubscriptionManager = new EntitySubscriptionManager();
