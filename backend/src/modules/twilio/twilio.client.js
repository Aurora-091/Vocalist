const twilio = require("twilio");
const env = require("../../config/env");
const { requireAdmin } = require("../../config/supabase");

const tenantClientCache = new Map();
const CACHE_TTL_MS = 60_000;

function isSandbox() {
  return (
    env.TWILIO_SANDBOX_MODE === true ||
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN
  );
}

function masterClient() {
  if (isSandbox()) return null;
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

async function getOrCreateSubaccount(orgId, friendlyName) {
  const admin = requireAdmin();
  const { data: existing } = await admin
    .from("twilio_subaccounts")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (existing && existing.status === "active") return existing;

  if (isSandbox()) {
    const sid = `ACsandbox${orgId.replace(/-/g, "").slice(0, 24)}`;
    const row = {
      org_id: orgId,
      subaccount_sid: sid,
      secret_ref: `sandbox:${orgId}`,
      auth_token_ref: `sandbox:${orgId}`,
      status: "active",
      region: env.TWILIO_REGION,
      account_type: "aurora_managed",
    };
    await admin.from("twilio_subaccounts").upsert(row);
    return row;
  }

  const master = masterClient();
  const sub = await master.api.v2010.accounts.create({
    friendlyName: friendlyName || `Aurora org ${orgId}`,
  });

  const row = {
    org_id: orgId,
    subaccount_sid: sub.sid,
    secret_ref: `vault:twilio:${orgId}:auth_token`,
    auth_token_ref: `vault:twilio:${orgId}:auth_token`,
    status: "active",
    region: env.TWILIO_REGION,
    account_type: "aurora_managed",
    friendly_name: friendlyName || null,
  };
  await admin.from("twilio_subaccounts").upsert(row);

  try {
    await admin.rpc("vault_store", {
      name: row.auth_token_ref,
      secret: sub.authToken,
    });
  } catch (e) {}

  return { ...row, _authToken: sub.authToken };
}

async function linkByoAccount(orgId, { accountSid, authToken, friendlyName }) {
  if (!accountSid || !authToken) throw new Error("accountSid and authToken are required");

  // Validate credentials by fetching the account from Twilio
  const client = twilio(accountSid, authToken);
  const account = await client.api.v2010.accounts(accountSid).fetch();
  if (!account) throw new Error("Invalid Twilio credentials");

  const admin = requireAdmin();
  const secretRef = `vault:twilio:byo:${orgId}:auth_token`;

  try {
    await admin.rpc("vault_store", { name: secretRef, secret: authToken });
  } catch (e) {}

  const row = {
    org_id: orgId,
    subaccount_sid: accountSid,
    secret_ref: secretRef,
    auth_token_ref: secretRef,
    status: "active",
    account_type: "byo_linked",
    friendly_name: friendlyName || account.friendlyName || null,
    verified_at: new Date().toISOString(),
  };

  const { error } = await admin.from("twilio_subaccounts").upsert(row);
  if (error) throw error;

  // Invalidate client cache
  tenantClientCache.delete(orgId);
  return row;
}

async function listByoNumbers(orgId) {
  const client = await getTenantClient(orgId);
  const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });
  return numbers.map((n) => ({
    sid: n.sid,
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    capabilities: n.capabilities || {},
    voiceUrl: n.voiceUrl,
    statusCallback: n.statusCallback,
  }));
}

async function getTenantClient(orgId) {
  const cached = tenantClientCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) return cached.client;

  if (isSandbox()) {
    const stub = makeSandboxClient(orgId);
    tenantClientCache.set(orgId, {
      client: stub,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return stub;
  }

  const admin = requireAdmin();
  const { data: sub } = await admin
    .from("twilio_subaccounts")
    .select("subaccount_sid, auth_token_ref, status")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!sub || sub.status !== "active") {
    throw new Error("twilio_subaccount_not_provisioned");
  }

  const { data: secret } = await admin.rpc("vault_read", { name: sub.auth_token_ref });
  if (!secret) throw new Error("twilio_secret_missing");

  const client = twilio(sub.subaccount_sid, secret);
  tenantClientCache.set(orgId, { client, expiresAt: Date.now() + CACHE_TTL_MS });
  return client;
}

function makeSandboxClient(orgId) {
  return {
    _sandbox: true,
    _orgId: orgId,
    availablePhoneNumbers(country) {
      return {
        local: { list: ({ areaCode, limit = 10 }) => sandboxSearch(country, areaCode, "local", limit) },
        tollFree: { list: ({ limit = 10 }) => sandboxSearch(country, null, "tollfree", limit) },
      };
    },
    incomingPhoneNumbers: {
      create: async ({ phoneNumber, voiceUrl, statusCallback }) => ({
        sid: `PNsandbox${Math.random().toString(36).slice(2, 10)}`,
        phoneNumber,
        voiceUrl,
        statusCallback,
        capabilities: { voice: true, SMS: true, MMS: false },
      }),
      list: async () => [],
      update: async (_sid, params) => ({ ...params }),
    },
    calls: {
      create: async ({ to, from, url, statusCallback }) => ({
        sid: `CAsandbox${Math.random().toString(36).slice(2, 10)}`,
        to,
        from,
        url,
        statusCallback,
        status: "queued",
      }),
    },
  };
}

function sandboxSearch(country, areaCode, kind, limit) {
  const base = areaCode || "415";
  const out = [];
  for (let i = 0; i < limit; i++) {
    const last4 = String(1000 + i).padStart(4, "0");
    out.push({
      friendlyName:
        kind === "tollfree"
          ? `(800) 555-${last4}`
          : `(${base}) 555-${last4}`,
      phoneNumber: kind === "tollfree" ? `+1800555${last4}` : `+1${base}555${last4}`,
      locality: kind === "tollfree" ? "Toll-free" : "San Francisco",
      region: kind === "tollfree" ? "US" : "CA",
      isoCountry: country || "US",
      capabilities: { voice: true, SMS: kind !== "tollfree", MMS: false },
      sandbox: true,
    });
  }
  return out;
}

module.exports = {
  isSandbox,
  masterClient,
  getOrCreateSubaccount,
  getTenantClient,
  linkByoAccount,
  listByoNumbers,
};
