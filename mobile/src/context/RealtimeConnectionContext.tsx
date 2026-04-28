import React, { createContext, useContext } from 'react';

const RealtimeConnectionContext = createContext<boolean>(false);

export function RealtimeConnectionProvider({
  isConnected,
  children,
}: {
  isConnected: boolean;
  children: React.ReactNode;
}) {
  return (
    <RealtimeConnectionContext.Provider value={isConnected}>
      {children}
    </RealtimeConnectionContext.Provider>
  );
}

/** AppNavigator 에서 제공 — STOMP 준비된 뒤에만 채널 구독·전송 허용 */
export function useRealtimeConnection(): boolean {
  return useContext(RealtimeConnectionContext);
}
