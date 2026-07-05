const assert = require("node:assert/strict");
const { test } = require("node:test");
const { tryE164 } = require("../../utils/phone");

test("syncContacts maps Shopify customer to correct schema", () => {
  const customer = {
    id: 12345,
    phone: "+1 (415) 555-0199",
    first_name: "Sarah",
    last_name: "Chen",
    email: "sarah@example.com",
    marketing_consent: { state: "subscribed" },
    tags: "vip,returning",
    orders_count: 5,
  };

  const contact = mapCustomerToContact("org_abc", customer, "US");
  assert.equal(contact.org_id, "org_abc");
  assert.equal(contact.e164, "+14155550199");
  assert.equal(contact.name, "Sarah Chen");
  assert.equal(contact.email, "sarah@example.com");
  assert.equal(contact.source, "shopify");
  assert.equal(contact.consent_status, "granted");
  assert.equal(contact.crm_ref, "shopify_12345");
  assert.equal(contact.fields.shopify_id, 12345);
});

test("syncContacts skips customers without phone", () => {
  const customer = {
    id: 999,
    phone: null,
    first_name: "NoPhone",
    last_name: "User",
    email: "no@example.com",
    marketing_consent: null,
  };
  const contact = mapCustomerToContact("org_abc", customer, "US");
  assert.equal(contact, null);
});

test("syncContacts sets consent_status to none when not subscribed", () => {
  const customer = {
    id: 888,
    phone: "+447911123456",
    first_name: "Jane",
    last_name: null,
    email: null,
    marketing_consent: { state: "not_subscribed" },
    tags: "",
    orders_count: 0,
  };
  const contact = mapCustomerToContact("org_xyz", customer, "GB");
  assert.equal(contact.consent_status, "none");
  assert.equal(contact.name, "Jane");
});

test("phone number normalization uses tryE164 for India", () => {
  const customer = {
    id: 777,
    phone: "9876543210",
    first_name: "Raj",
    last_name: "Patel",
    email: null,
    marketing_consent: { state: "subscribed" },
    tags: null,
    orders_count: 1,
  };
  const contact = mapCustomerToContact("org_1", customer, "IN");
  assert.equal(contact.e164, "+919876543210");
});

test("invalid phone returns null contact", () => {
  const customer = {
    id: 666,
    phone: "123",
    first_name: "Bad",
    last_name: "Phone",
    email: null,
    marketing_consent: null,
  };
  const contact = mapCustomerToContact("org_1", customer, "IN");
  assert.equal(contact, null);
});

function mapCustomerToContact(orgId, customer, countryCode = "IN") {
  if (!customer.phone) return null;
  const e164 = tryE164(customer.phone, countryCode);
  if (!e164) return null;
  return {
    org_id: orgId,
    e164,
    name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || null,
    email: customer.email || null,
    crm_ref: `shopify_${customer.id}`,
    source: "shopify",
    consent_status: customer.marketing_consent?.state === "subscribed" ? "granted" : "none",
    fields: { shopify_id: customer.id, tags: customer.tags, orders_count: customer.orders_count },
  };
}
