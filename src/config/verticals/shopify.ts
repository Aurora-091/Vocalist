import { ShoppingBag, PhoneIncoming, PhoneOutgoing, Bot, Megaphone, MessageSquare, Users, BookOpen, PhoneCall, Volume2, Plug, ChartBar as BarChart2, LayoutDashboard, TrendingUp, CreditCard, Settings, ShoppingCart, Repeat, Headphones } from "lucide-react";
import type { VerticalDefinition } from "./index";

export const shopifyVertical: VerticalDefinition = {
  key: "shopify",
  label: "Ecommerce / Shopify",
  shortLabel: "Ecommerce",
  icon: ShoppingBag,
  enabled: true,

  glossary: {
    contact: "Customer",
    contacts: "Customers",
    item: "Order",
    items: "Orders",
    appointment: "Follow-up",
    appointments: "Follow-ups",
    workspace: "Store",
    campaign: "Outreach",
    campaigns: "Outreach",
    agent: "Agent",
    agents: "Agents",
  },

  dashboard: {
    metrics: [
      { key: "calls_total", label: "Calls (30d)" },
      { key: "carts_recovered", label: "Carts recovered" },
      { key: "revenue_recovered", label: "Revenue recovered", format: "currency" },
      { key: "opt_outs", label: "Opt-outs", hint: "Lower is better" },
    ],
    cards: [
      {
        id: "inbound",
        title: "Inbound Handling",
        description: "Answer order-status questions, handle returns, qualify support tickets.",
        icon: PhoneIncoming,
        color: "blue",
        links: [
          { label: "Manage agents", to: "/agents" },
          { label: "View inbound calls", to: "/calls?filter=inbound" },
        ],
      },
      {
        id: "outbound",
        title: "Outbound Campaigns",
        description: "Abandoned cart recovery, COD/RTO confirmation, delivery follow-ups.",
        icon: PhoneOutgoing,
        color: "green",
        links: [
          { label: "New campaign", to: "/campaigns/new" },
          { label: "View outbound calls", to: "/calls?filter=outbound" },
        ],
      },
    ],
    inboundCopy: "Answer order-status questions, handle returns, qualify support tickets.",
    outboundCopy: "Abandoned cart recovery, COD/RTO confirmation, delivery follow-ups.",
  },

  navigation: [
    {
      label: "Overview",
      items: [
        { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
        { to: "/outcomes", label: "Results", icon: TrendingUp },
      ],
    },
    {
      label: "Sales",
      items: [
        { to: "/agents", label: "Agents", icon: Bot },
        { to: "/campaigns", label: "Campaigns", icon: Megaphone },
        { to: "/calls", label: "Conversations", icon: MessageSquare },
      ],
    },
    {
      label: "Customers",
      items: [
        { to: "/contacts", label: "Customers", icon: Users },
        { to: "/knowledge", label: "Knowledge", icon: BookOpen },
      ],
    },
    {
      label: "Setup",
      collapsible: true,
      defaultOpen: false,
      items: [
        { to: "/numbers", label: "Numbers", icon: PhoneCall },
        { to: "/voices", label: "Voices", icon: Volume2 },
        { to: "/integrations", label: "Integrations", icon: Plug },
        { to: "/analytics", label: "Analytics", icon: BarChart2 },
      ],
    },
  ],

  footerNav: [
    { to: "/billing", label: "Billing", icon: CreditCard },
    { to: "/settings", label: "Settings", icon: Settings },
  ],

  quickActions: [
    {
      key: "recover_cart",
      label: "Recover abandoned cart",
      description: "Call customers who left items in their cart",
      icon: ShoppingCart,
      route: "/campaigns/new?template=cart_recovery",
    },
    {
      key: "order_tracking",
      label: "Order tracking agent",
      description: "Let customers check order status by phone",
      icon: Repeat,
      route: "/agents?create=order_status",
    },
    {
      key: "returns_support",
      label: "Returns & support",
      description: "Handle return requests and support tickets",
      icon: Headphones,
      route: "/agents?create=support_triage",
    },
  ],

  templates: [
    { key: "cart_recovery", label: "Cart Recovery", description: "Recover abandoned carts with personalized follow-up calls", direction: "outbound" },
    { key: "order_status", label: "Order Status", description: "Let customers check order and delivery status", direction: "inbound" },
    { key: "cod_confirm", label: "COD Confirmation", description: "Confirm cash-on-delivery orders to reduce RTO", direction: "outbound" },
    { key: "support_triage", label: "Support Triage", description: "Qualify and route inbound support requests", direction: "inbound" },
  ],

  integrations: [
    { provider_key: "shopify", name: "Shopify", category: "ecommerce", priority: 1 },
    { provider_key: "stripe", name: "Stripe", category: "payments", priority: 2 },
    { provider_key: "klaviyo", name: "Klaviyo", category: "messaging", priority: 3 },
    { provider_key: "whatsapp", name: "WhatsApp", category: "messaging", priority: 4 },
    { provider_key: "gsheets", name: "Google Sheets", category: "spreadsheet", priority: 5 },
  ],

  emptyStates: {
    dashboard: {
      title: "Welcome to Weeber",
      description: "Start by creating your first agent, then add customers and launch a cart recovery campaign.",
      cta: "Start setup",
      route: "/onboarding",
    },
    agents: {
      title: "No agents yet",
      description: "Create a cart recovery or order support agent to start handling customer calls.",
      cta: "Create agent",
    },
    contacts: {
      title: "No customers yet",
      description: "Import customers from Shopify or add them manually to start outreach.",
      cta: "Add customer",
    },
    calls: {
      title: "No calls yet",
      description: "Calls will appear here once your agents start handling customer conversations.",
    },
  },
};
