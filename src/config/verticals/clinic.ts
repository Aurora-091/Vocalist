import { Stethoscope, PhoneIncoming, PhoneOutgoing, Bot, Megaphone, MessageSquare, Users, BookOpen, PhoneCall, Volume2, Plug, ChartBar as BarChart2, LayoutDashboard, TrendingUp, CreditCard, Settings, CalendarCheck, Bell, ClipboardList } from "lucide-react";
import type { VerticalDefinition } from "./index";

export const clinicVertical: VerticalDefinition = {
  key: "clinic",
  label: "Clinic / Healthcare",
  shortLabel: "Clinic",
  icon: Stethoscope,
  enabled: true,

  glossary: {
    contact: "Patient",
    contacts: "Patients",
    item: "Appointment",
    items: "Appointments",
    appointment: "Visit",
    appointments: "Visits",
    workspace: "Practice",
    campaign: "Recall",
    campaigns: "Recalls",
    agent: "Agent",
    agents: "Agents",
  },

  dashboard: {
    metrics: [
      { key: "calls_total", label: "Calls (30d)" },
      { key: "bookings", label: "Bookings made" },
      { key: "no_shows_prevented", label: "No-shows prevented" },
      { key: "opt_outs", label: "Opt-outs", hint: "Lower is better" },
    ],
    cards: [
      {
        id: "inbound",
        title: "Inbound Handling",
        description: "Book appointments, answer hours/location/insurance questions, route urgent calls.",
        icon: PhoneIncoming,
        color: "blue",
        links: [
          { label: "Manage agents", to: "/agents" },
          { label: "View inbound calls", to: "/calls?filter=inbound" },
        ],
      },
      {
        id: "outbound",
        title: "Outbound Recalls",
        description: "Appointment reminders, no-show recovery, follow-up scheduling.",
        icon: PhoneOutgoing,
        color: "green",
        links: [
          { label: "New recall campaign", to: "/campaigns/new" },
          { label: "View outbound calls", to: "/calls?filter=outbound" },
        ],
      },
    ],
    inboundCopy: "Book appointments, answer hours/location/insurance questions, route urgent calls.",
    outboundCopy: "Appointment reminders, no-show recovery, follow-up scheduling.",
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
      label: "Patients",
      items: [
        { to: "/agents", label: "Agents", icon: Bot },
        { to: "/campaigns", label: "Recalls", icon: Megaphone },
        { to: "/calls", label: "Conversations", icon: MessageSquare },
      ],
    },
    {
      label: "Records",
      items: [
        { to: "/contacts", label: "Patients", icon: Users },
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
      key: "appointment_reminder",
      label: "Appointment reminders",
      description: "Call patients before upcoming appointments",
      icon: Bell,
      route: "/campaigns/new?template=reminder",
    },
    {
      key: "booking_agent",
      label: "Booking agent",
      description: "Let patients schedule appointments by phone",
      icon: CalendarCheck,
      route: "/agents?create=appointment_booking",
    },
    {
      key: "intake_form",
      label: "New patient intake",
      description: "Collect patient information before first visit",
      icon: ClipboardList,
      route: "/agents?create=front_desk_faq",
    },
  ],

  templates: [
    { key: "appointment_booking", label: "Appointment Booking", description: "Let patients book, reschedule, or cancel appointments", direction: "inbound" },
    { key: "reminder", label: "Appointment Reminder", description: "Automated reminders to reduce no-shows", direction: "outbound" },
    { key: "no_show_recovery", label: "No-Show Recovery", description: "Re-engage patients who missed their appointment", direction: "outbound" },
    { key: "front_desk_faq", label: "Front Desk FAQ", description: "Answer hours, location, insurance, and service questions", direction: "inbound" },
  ],

  integrations: [
    { provider_key: "calcom", name: "Cal.com", category: "calendar", priority: 1 },
    { provider_key: "google_cal", name: "Google Calendar", category: "calendar", priority: 2 },
    { provider_key: "outlook_cal", name: "Outlook Calendar", category: "calendar", priority: 3 },
    { provider_key: "athenahealth", name: "Athenahealth", category: "ehr", priority: 4 },
    { provider_key: "drchrono", name: "DrChrono", category: "ehr", priority: 5 },
  ],

  emptyStates: {
    dashboard: {
      title: "Welcome to Weeber",
      description: "Start by creating your first agent, then add patients and schedule appointment reminders.",
      cta: "Start setup",
      route: "/onboarding",
    },
    agents: {
      title: "No agents yet",
      description: "Create a booking or reminder agent to start handling patient calls automatically.",
      cta: "Create agent",
    },
    contacts: {
      title: "No patients yet",
      description: "Import patients from your EHR or add them manually to start recalls.",
      cta: "Add patient",
    },
    calls: {
      title: "No calls yet",
      description: "Calls will appear here once your agents start handling patient conversations.",
    },
  },
};
