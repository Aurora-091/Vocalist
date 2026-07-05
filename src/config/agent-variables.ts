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
