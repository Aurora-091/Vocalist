import { Hotel, PhoneIncoming, PhoneOutgoing, Bot, Megaphone, MessageSquare, Users, BookOpen, PhoneCall, Volume2, Plug, ChartBar as BarChart2, LayoutDashboard, TrendingUp, CreditCard, Settings, CalendarCheck, BedDouble, ConciergeBell } from "lucide-react";
import type { VerticalDefinition } from "./index";

export const hotelVertical: VerticalDefinition = {
  key: "hotel",
  label: "Hotel / Hospitality",
  shortLabel: "Hotel",
  icon: Hotel,
  enabled: false,

  glossary: {
    contact: "Guest",
    contacts: "Guests",
    item: "Reservation",
    items: "Reservations",
    appointment: "Stay",
    appointments: "Stays",
    workspace: "Property",
    campaign: "Outreach",
    campaigns: "Outreach",
    agent: "Agent",
    agents: "Agents",
  },

  dashboard: {
    metrics: [
      { key: "calls_total", label: "Calls (30d)" },
      { key: "reservations", label: "Reservations" },
      { key: "checkins_handled", label: "Check-ins handled" },
      { key: "opt_outs", label: "Opt-outs", hint: "Lower is better" },
    ],
    cards: [
      {
        id: "inbound",
        title: "Inbound Handling",
        description: "Take reservations, answer amenity questions, handle special requests.",
        icon: PhoneIncoming,
        color: "blue",
        links: [
          { label: "Manage agents", to: "/agents" },
          { label: "View inbound calls", to: "/calls?filter=inbound" },
        ],
      },
      {
        id: "outbound",
        title: "Guest Outreach",
        description: "Booking confirmations, pre-arrival check-in, post-stay feedback.",
        icon: PhoneOutgoing,
        color: "green",
        links: [
          { label: "New outreach", to: "/campaigns/new" },
          { label: "View outbound calls", to: "/calls?filter=outbound" },
        ],
      },
    ],
    inboundCopy: "Take reservations, answer amenity questions, handle special requests.",
    outboundCopy: "Booking confirmations, pre-arrival check-in, post-stay feedback.",
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
      label: "Guests",
      items: [
        { to: "/agents", label: "Agents", icon: Bot },
        { to: "/campaigns", label: "Outreach", icon: Megaphone },
        { to: "/calls", label: "Conversations", icon: MessageSquare },
      ],
    },
    {
      label: "Property",
      items: [
        { to: "/contacts", label: "Guests", icon: Users },
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
      key: "booking_confirm",
      label: "Booking confirmation",
      description: "Confirm upcoming reservations with guests",
      icon: CalendarCheck,
      route: "/campaigns/new?template=booking_confirm",
    },
    {
      key: "concierge",
      label: "Concierge agent",
      description: "Answer guest questions about amenities and services",
      icon: ConciergeBell,
      route: "/agents?create=concierge",
    },
    {
      key: "checkout",
      label: "Late checkout handler",
      description: "Handle late checkout requests automatically",
      icon: BedDouble,
      route: "/agents?create=pre_arrival_checkin",
    },
  ],

  templates: [
    { key: "reservation", label: "Reservation Agent", description: "Take and modify hotel reservations by phone", direction: "inbound" },
    { key: "concierge", label: "Concierge Agent", description: "Answer guest questions about property amenities", direction: "inbound" },
    { key: "pre_arrival_checkin", label: "Pre-Arrival Check-in", description: "Collect guest preferences before arrival", direction: "outbound" },
  ],

  integrations: [
    { provider_key: "google_cal", name: "Google Calendar", category: "calendar", priority: 1 },
    { provider_key: "cloudbeds", name: "Cloudbeds", category: "pms", priority: 2 },
    { provider_key: "opera_pms", name: "Opera PMS", category: "pms", priority: 3 },
    { provider_key: "mews", name: "Mews", category: "pms", priority: 4 },
  ],

  emptyStates: {
    dashboard: {
      title: "Welcome to Weeber",
      description: "Start by creating your first agent, then add guests and launch confirmation outreach.",
      cta: "Start setup",
      route: "/onboarding",
    },
    agents: {
      title: "No agents yet",
      description: "Create a reservation or concierge agent to start handling guest calls.",
      cta: "Create agent",
    },
    contacts: {
      title: "No guests yet",
      description: "Import guests from your PMS or add them manually.",
      cta: "Add guest",
    },
    calls: {
      title: "No calls yet",
      description: "Calls will appear here once your agents start handling guest conversations.",
    },
  },
};
