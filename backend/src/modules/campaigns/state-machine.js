const STATES = Object.freeze({
  QUEUED: "queued",
  SUPPRESSED: "suppressed",
  DIALING: "dialing",
  RINGING: "ringing",
  IN_CALL: "in_call",
  COMPLETED: "completed",
  FAILED: "failed",
  VOICEMAIL: "voicemail",
  RETRY_WAIT: "retry_wait",
  DO_NOT_CALL: "do_not_call",
});

const TERMINAL = new Set([STATES.COMPLETED, STATES.DO_NOT_CALL]);

const ALLOWED = {
  [STATES.QUEUED]: [STATES.DIALING, STATES.SUPPRESSED, STATES.DO_NOT_CALL],
  [STATES.SUPPRESSED]: [STATES.QUEUED, STATES.DO_NOT_CALL],
  [STATES.DIALING]: [STATES.RINGING, STATES.IN_CALL, STATES.FAILED, STATES.VOICEMAIL, STATES.COMPLETED],
  [STATES.RINGING]: [STATES.IN_CALL, STATES.FAILED, STATES.VOICEMAIL, STATES.COMPLETED],
  [STATES.IN_CALL]: [STATES.COMPLETED, STATES.FAILED],
  [STATES.VOICEMAIL]: [STATES.RETRY_WAIT, STATES.COMPLETED],
  [STATES.FAILED]: [STATES.RETRY_WAIT, STATES.COMPLETED],
  [STATES.RETRY_WAIT]: [STATES.QUEUED, STATES.DO_NOT_CALL, STATES.COMPLETED],
  [STATES.COMPLETED]: [],
  [STATES.DO_NOT_CALL]: [],
};

function canTransition(from, to) {
  if (!from) return to === STATES.QUEUED;
  if (TERMINAL.has(from)) return false;
  return (ALLOWED[from] || []).includes(to);
}

async function transition(supabase, { targetId, fromState, toState, reason, callId, orgId }) {
  if (!canTransition(fromState, toState)) {
    throw new Error(`Invalid transition: ${fromState} -> ${toState}`);
  }

  const update = { state: toState, updated_at: new Date().toISOString() };
  if (callId) update.last_call_id = callId;

  const { data, error } = await supabase
    .from("campaign_targets")
    .update(update)
    .eq("id", targetId)
    .eq("state", fromState)
    .select("id, state, attempts")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { ok: false, reason: "state_changed_concurrently" };
  }

  const { error: logErr } = await supabase.from("dialer_transitions").insert({
    org_id: orgId,
    target_id: targetId,
    from_state: fromState,
    to_state: toState,
    reason: reason || null,
    call_id: callId || null,
  });
  if (logErr) throw logErr;

  return { ok: true, target: data };
}

module.exports = { STATES, TERMINAL, ALLOWED, canTransition, transition };
