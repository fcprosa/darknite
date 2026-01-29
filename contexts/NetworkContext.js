import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AppState } from "react-native";

// Try to import expo-network, provide fallback if not available
let Network = null;
try {
  Network = require("expo-network");
} catch (e) {
  console.warn("[NetworkContext] expo-network not available, network detection disabled");
}

const NetworkContext = createContext(null);

/**
 * NetworkProvider - Provides network status throughout the app
 * Uses expo-network to check connectivity status
 */
export function NetworkProvider({ children }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [networkType, setNetworkType] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkNetworkStatus = useCallback(async () => {
    // If expo-network is not available, assume connected
    if (!Network) {
      setIsConnected(true);
      setIsInternetReachable(true);
      setLastChecked(new Date());
      return;
    }

    try {
      const networkState = await Network.getNetworkStateAsync();

      setIsConnected(networkState.isConnected ?? true);
      setIsInternetReachable(networkState.isInternetReachable ?? true);
      setNetworkType(networkState.type ?? null);
      setLastChecked(new Date());

      console.log("[Network] Status:", {
        connected: networkState.isConnected,
        reachable: networkState.isInternetReachable,
        type: networkState.type,
      });
    } catch (error) {
      console.warn("[Network] Error checking status:", error);
      // Assume connected if check fails
      setIsConnected(true);
      setIsInternetReachable(true);
    }
  }, []);

  // Check on mount
  useEffect(() => {
    checkNetworkStatus();
  }, [checkNetworkStatus]);

  // Check when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkNetworkStatus();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [checkNetworkStatus]);

  // Periodic check every 30 seconds when app is active
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") {
        checkNetworkStatus();
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [checkNetworkStatus]);

  // Derived state: is the app truly online?
  const isOnline = isConnected && isInternetReachable;

  const value = {
    isConnected,
    isInternetReachable,
    isOnline,
    networkType,
    lastChecked,
    checkNetworkStatus, // Expose for manual refresh
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * useNetwork hook - Access network status from any component
 */
export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

/**
 * useIsOnline hook - Simple boolean check for online status
 */
export function useIsOnline() {
  const { isOnline } = useNetwork();
  return isOnline;
}
