# Issue: Test Call Fails with 400 (Complete Twilio Setup)

## Description
When attempting to initiate a test call for an agent, the request fails with a `400 Bad Request` response because Twilio setup is incomplete.

## Details
- **Endpoint:** `POST /v1/agents/1d05746d-dd36-464e-b9e5-9d1c8337fad4/test-call`
- **Status Code:** `400 Bad Request`
- **Response Time:** `323.003 ms`
- **Error Message:** `Complete Twilio setup before testing calls`

## Steps to Reproduce
1. Send a `POST` request to `/v1/agents/1d05746d-dd36-464e-b9e5-9d1c8337fad4/test-call`.
2. Observe the `400` status code with the message instructing to complete Twilio setup first.

## Expected Resolution
Ensure Twilio credentials (API keys, phone numbers, and webhook configurations) are fully configured and associated with the organization or agent before attempting to place test calls.
