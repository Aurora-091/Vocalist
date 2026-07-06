export type VariableCategory = "trigger" | "settings" | "custom";

export type VariableDefinition = {
  key: string;
  label: string;
  category: VariableCategory;
  description: string;
  example: string;
};

export const KNOWN_VARIABLES: VariableDefinition[] = [
  // Trigger variables — injected at call time from scheduled_call metadata
  {
    key: "customer_name",
    label: "Customer Name",
    category: "trigger",
    description: "Name of the person being called",
    example: "Priya Sharma",
  },
  {
    key: "cart_total",
    label: "Cart Total",
    category: "trigger",
    description: "Total value of the abandoned cart",
    example: "2,499",
  },
  {
    key: "cart_items",
    label: "Cart Items",
    category: "trigger",
    description: "Comma-separated list of items in the cart",
    example: "Blue T-Shirt, Running Shoes",
  },
  {
    key: "recovery_url",
    label: "Recovery URL",
    category: "trigger",
    description: "Link to resume the abandoned checkout",
    example: "https://store.com/checkout/abc123",
  },
  {
    key: "order_id",
    label: "Order ID",
    category: "trigger",
    description: "Shopify order identifier for COD confirmation",
    example: "#1042",
  },
  {
    key: "order_total",
    label: "Order Total",
    category: "trigger",
    description: "Total amount for the order",
    example: "1,299",
  },
  {
    key: "currency",
    label: "Currency",
    category: "trigger",
    description: "Currency code for the transaction",
    example: "INR",
  },
  {
    key: "discount_percent",
    label: "Discount Percent",
    category: "trigger",
    description: "Discount percentage offered for cart recovery",
    example: "10",
  },
  {
    key: "cod_amount",
    label: "COD Amount",
    category: "trigger",
    description: "Cash-on-delivery amount to be collected",
    example: "899",
  },
  {
    key: "return_window_days",
    label: "Return Window (days)",
    category: "trigger",
    description: "Number of days customer has to return the product",
    example: "7",
  },
  {
    key: "appointment_date",
    label: "Appointment Date",
    category: "trigger",
    description: "Scheduled appointment date",
    example: "Monday, 14 July",
  },
  {
    key: "appointment_time",
    label: "Appointment Time",
    category: "trigger",
    description: "Scheduled appointment time",
    example: "10:30 AM",
  },
  {
    key: "patient_name",
    label: "Patient Name",
    category: "trigger",
    description: "Name of the patient for clinic workflows",
    example: "Rahul Verma",
  },
  {
    key: "doctor_name",
    label: "Doctor Name",
    category: "trigger",
    description: "Name of the doctor for the appointment",
    example: "Dr. Meera Iyer",
  },
  {
    key: "room_type",
    label: "Room Type",
    category: "trigger",
    description: "Hotel room category booked",
    example: "Deluxe King",
  },
  {
    key: "checkin_date",
    label: "Check-in Date",
    category: "trigger",
    description: "Hotel check-in date",
    example: "15 July 2025",
  },

  // Settings variables — from agent/org configuration
  {
    key: "business_name",
    label: "Business Name",
    category: "settings",
    description: "Name of the business the agent represents",
    example: "Acme Store",
  },
  {
    key: "agent_name",
    label: "Agent Name",
    category: "settings",
    description: "The name the AI agent introduces itself as",
    example: "Maya",
  },
  {
    key: "transfer_number",
    label: "Transfer Number",
    category: "settings",
    description: "Phone number to transfer the call to a human",
    example: "+919876543210",
  },
  {
    key: "business_hours",
    label: "Business Hours",
    category: "settings",
    description: "Operating hours of the business",
    example: "Mon-Sat 9 AM to 9 PM",
  },
];

export function extractVariablesFromText(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

export function categorizeVariable(key: string): VariableDefinition | null {
  return KNOWN_VARIABLES.find((v) => v.key === key) || null;
}
