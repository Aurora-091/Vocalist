# A2P 10DLC Compliance Guide

**Repo:** `vocalist`
**Date:** 2026-07-01

This guide covers the requirements and implementation details for complying with A2P 10DLC (Application-to-Person 10-Digit Long Code) messaging and calling regulations in the US.

## What is A2P 10DLC?
A2P 10DLC is a regulatory framework by US carriers (AT&T, Verizon, T-Mobile) that requires businesses to register their brand and campaigns before sending SMS or making outbound calls using local 10-digit numbers.

## Requirements for Weeber/Aurora

For Weeber to make outbound calls on behalf of users, the following must be set up:

### 1. Brand Registration
Every organization using Weeber to make outbound calls from a local US number must register their brand.
- Requires: Legal Business Name, EIN/Tax ID, Address, Website, Contact Info.

### 2. Campaign Registration
After brand approval, a campaign must be registered.
- Campaign Type: Usually "Low Volume Mixed" or a specific use case like "Customer Care" or "Marketing".
- Requires: Sample messages/scripts, Opt-in proof, Opt-out mechanism.

### 3. Opt-in and Consent (CRITICAL)
- Call recipients must explicitly opt-in to receive calls/messages.
- The `consent_events` table in Weeber tracks this. `can_dial` DB constraint enforces this.
- If a user marks a call as spam, Twilio may suspend the number.

### 4. Opt-out (DNC List)
- Users must be able to opt-out (e.g., replying STOP to an SMS, or verbally asking to be added to the DNC list).
- Our agent personas must be instructed to invoke the `do_not_call` tool when requested.

## Twilio Implementation Steps

For Weeber-managed Twilio Subaccounts:
1. We must submit the Trust Hub Brand Registration API requests for the subaccount.
2. We must submit the Campaign Registration API requests.
3. Once approved, associate the purchased phone number with the Campaign SID.

For BYO Twilio Accounts:
- The user is responsible for completing A2P 10DLC registration in their own Twilio console.

## Toll-Free Verification
If users purchase Toll-Free numbers (800, 888, etc.), A2P 10DLC does not apply. However, **Toll-Free Verification** is required by carriers.
- Requires a verification form submitted via Twilio detailing the use case and opt-in workflow.
