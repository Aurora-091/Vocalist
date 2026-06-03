class BillingService {
  /**
   * Processes the billing for a completed call.
   * This operation must be idempotent to prevent duplicate billing from webhooks.
   * 
   * @param {Object} supabase - Supabase client
   * @param {Object} callData - Information about the call
   */
  async processCallCompletion(supabase, { org_id, call_id, duration_seconds, provider_cost }) {
    if (!duration_seconds || duration_seconds <= 0) return { ok: true, note: "No duration to bill" };

    // Idempotency check: see if a ledger entry already exists for this call
    const idempotencyKey = `call_${call_id}_duration`;
    
    const { data: existing, error: fetchErr } = await supabase
      .from("usage_ledger")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
      
    if (fetchErr) throw fetchErr;
    if (existing) {
      // Already processed, return early safely
      return { ok: true, note: "Already billed" };
    }

    // Calculate usage amount (e.g. rate per minute or per second). 
    // Usually this is loaded from org's pricing plan, but we'll insert raw usage units here.
    const units = duration_seconds;

    const { error: insertErr } = await supabase
      .from("usage_ledger")
      .insert({
        org_id,
        idempotency_key: idempotencyKey,
        reference_id: call_id,
        type: "voice_call_seconds",
        units,
        cost: provider_cost || 0, // Keep track of what the provider charged us, if available
        created_at: new Date().toISOString()
      });

    // Note: In Supabase, you can set a UNIQUE constraint on idempotency_key to prevent race conditions.
    // Assuming the migrations created such an index/constraint.
    if (insertErr) {
      // If error is unique constraint violation (code 23505), then a parallel webhook already processed it.
      if (insertErr.code === '23505') {
        return { ok: true, note: "Already billed (caught race condition)" };
      }
      throw insertErr;
    }

    return { ok: true };
  }
}

module.exports = new BillingService();
