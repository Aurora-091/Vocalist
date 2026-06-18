import type { LucideIcon } from "lucide-react";

// ─── Core Types ─────────────────────────────────────────────────────────────

export type VerticalKey = "shopify" | "clinic" | "hotel";

export type Glossary = {
  contact: string;
  contacts: string;
  item: string;
  items: string;
  appointment: string;
  appointments: string;
  workspace: string;
  campaign: string;
  campaigns: string;
  agent: string;
  agents: string;
};

export type MetricDefinition = {
  key: string;
  label: string;
  format?: "number" | "currency" | "percent";
  hint?: string;
};

export type DashboardCard = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  links: { label: string; to: string }[];
};

export type NavGroup = {
  label: string;
  items: { to: string; label: string; icon: LucideIcon; end?: boolean }[];
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export type QuickAction = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  route: string;
};

export type TemplateRef = {
  key: string;
  label: string;
  description: string;
  direction: "inbound" | "outbound";
};

export type IntegrationRef = {
  provider_key: string;
  name: string;
  category: string;
  priority: number;
};

export type EmptyStates = {
  dashboard: { title: string; description: string; cta: string; route: string };
  agents: { title: string; description: string; cta: string };
  contacts: { title: string; description: string; cta: string };
  calls: { title: string; description: string };
};

export type VerticalDefinition = {
  key: VerticalKey;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  enabled: boolean;
  glossary: Glossary;
  dashboard: {
    metrics: MetricDefinition[];
    cards: DashboardCard[];
    inboundCopy: string;
    outboundCopy: string;
  };
  navigation: NavGroup[];
  footerNav: { to: string; label: string; icon: LucideIcon }[];
  quickActions: QuickAction[];
  templates: TemplateRef[];
  integrations: IntegrationRef[];
  emptyStates: EmptyStates;
};

// ─── Registry ───────────────────────────────────────────────────────────────

import { shopifyVertical } from "./shopify";
import { clinicVertical } from "./clinic";
import { hotelVertical } from "./hotel";

export const VERTICAL_REGISTRY: Record<VerticalKey, VerticalDefinition> = {
  shopify: shopifyVertical,
  clinic: clinicVertical,
  hotel: hotelVertical,
};

export const DEFAULT_VERTICAL: VerticalKey = "shopify";

export function getVerticalDefinition(key: string | null | undefined): VerticalDefinition {
  if (key && key in VERTICAL_REGISTRY) return VERTICAL_REGISTRY[key as VerticalKey];
  return VERTICAL_REGISTRY[DEFAULT_VERTICAL];
}

export function listVerticals(): VerticalDefinition[] {
  return Object.values(VERTICAL_REGISTRY);
}

export function listEnabledVerticals(): VerticalDefinition[] {
  return Object.values(VERTICAL_REGISTRY).filter((v) => v.enabled);
}
