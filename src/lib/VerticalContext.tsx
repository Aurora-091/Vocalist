import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "./supabase";
import { getOrgId } from "./db";
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
        const orgId = await getOrgId();
        if (!orgId) { setLoading(false); return; }
        const { data } = await supabase
          .from("orgs")
          .select("vertical_config_id")
          .eq("id", orgId)
          .single();
        if (data?.vertical_config_id) {
          const { data: vc } = await supabase
            .from("vertical_configs")
            .select("key")
            .eq("id", data.vertical_config_id)
            .single();
          if (vc?.key) setVerticalState(vc.key as VerticalKey);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  async function setVertical(key: VerticalKey) {
    setVerticalState(key);
    const orgId = await getOrgId();
    if (!orgId) return;
    const { data: vc } = await supabase
      .from("vertical_configs")
      .select("id")
      .eq("key", key)
      .single();
    if (vc?.id) {
      await supabase
        .from("orgs")
        .update({ vertical_config_id: vc.id })
        .eq("id", orgId);
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
