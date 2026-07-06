import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import {
  getOrgVerticalConfigId,
  getVerticalConfigKey,
  getVerticalConfigId,
  updateOrgVerticalConfig,
} from "./db";
import {
  getVerticalDefinition,
  type VerticalKey,
  type VerticalDefinition,
  type Glossary,
} from "../config/verticals";

type VerticalContextValue = {
  vertical: VerticalKey | null;
  config: VerticalDefinition;
  glossary: Glossary;
  loading: boolean;
  setVertical: (key: VerticalKey) => Promise<void>;
  t: (key: keyof Glossary) => string;
};

const defaultConfig = getVerticalDefinition(null);

const VerticalContext = createContext<VerticalContextValue>({
  vertical: null,
  config: defaultConfig,
  glossary: defaultConfig.glossary,
  loading: true,
  setVertical: async () => {},
  t: (key) => defaultConfig.glossary[key],
});

export function useVertical() {
  return useContext(VerticalContext);
}

export function VerticalProvider({ children }: { children: ReactNode }) {
  const [vertical, setVerticalState] = useState<VerticalKey | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const verticalConfigId = await getOrgVerticalConfigId();
        if (verticalConfigId) {
          const key = await getVerticalConfigKey(verticalConfigId);
          if (key) setVerticalState(key as VerticalKey);
        }
      } catch {
        /* ignored */
      }
      setLoading(false);
    })();
  }, []);

  async function setVertical(key: VerticalKey) {
    setVerticalState(key);
    try {
      const configId = await getVerticalConfigId(key);
      if (configId) {
        await updateOrgVerticalConfig(configId);
      }
    } catch {
      /* ignored */
    }
  }

  const config = getVerticalDefinition(vertical);

  const t = useCallback(
    (key: keyof Glossary) => config.glossary[key],
    [config]
  );

  return (
    <VerticalContext.Provider
      value={{
        vertical,
        config,
        glossary: config.glossary,
        loading,
        setVertical,
        t,
      }}
    >
      {children}
    </VerticalContext.Provider>
  );
}
