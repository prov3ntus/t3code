import { useEffect } from "react";
import { useAtomValue, useAtomMount } from "@effect/atom-react";

import { runningThreadKeepAliveAtom, desktopRunningThreadCountAtom } from "../../state/threads";

export function RunningThreadKeepAlive() {
  useAtomMount(runningThreadKeepAliveAtom);
  const count = useAtomValue(desktopRunningThreadCountAtom);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Publish active work to Electron before a native close request.
  useEffect(() => {
    void window.desktopBridge?.setRunningThreadCount(count).catch(console.error);
  }, [count]);
  return null;
}
