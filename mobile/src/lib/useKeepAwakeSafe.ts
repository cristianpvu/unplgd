import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

// Varianta sigura a `useKeepAwake`: pe Android, activarea poate esua cu
// "Unable to activate keep awake" (activitate nu-i in foreground / mount rapid),
// iar `useKeepAwake` lasa rejectia neprinsa => eroare in dev. Aici o inghitim:
// keep-awake e best-effort, esecul nu trebuie sa crape nimic.
export function useKeepAwakeSafe(tag: string) {
  useEffect(() => {
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [tag]);
}
