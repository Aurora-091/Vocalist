# Shopify Integration Flow

This document outlines how the Shopify integration works across WeeberSh (the Shopify App) and Vocalist (the Backend API).

## Two-Way Connection Flow

We support two ways for a merchant to connect their Shopify store to Vocalist:

1. **Initiated from Vocalist:**
   - The merchant clicks "Connect Shopify" in the Vocalist dashboard.
   - The frontend calls `GET /api/integrations/shopify/install?shop=store.myshopify.com`.
   - The backend validates the domain and returns an install URL pointing to WeeberSh (e.g., `https://weebersh.up.railway.app/api/auth?shop=...&org_id=...`).
   - The merchant completes the OAuth flow in Shopify, which redirects back to WeeberSh.
   - WeeberSh captures the Shopify access token and `org_id` and forwards them to Vocalist at `POST /api/integrations/shopify/connected`.

2. **Initiated from Shopify (Direct Install):**
   - The merchant discovers WeeberSh in the Shopify App Store and installs it directly.
   - The OAuth flow completes without an `org_id`.
   - WeeberSh forwards the credentials to Vocalist (`POST /api/integrations/shopify/connected`) with a null `org_id`.
   - Vocalist detects the missing `org_id` and securely **auto-provisions** a new user account (using the merchant's Shopify email) and a new Organization.
   - A password reset email is automatically triggered so the merchant can log in to their new Vocalist dashboard.

## Webhooks

### Lifecycle Webhooks
- **App Uninstalled:** Shopify notifies WeeberSh via `app/uninstalled`. WeeberSh forwards this to `POST /api/integrations/shopify/uninstalled`. Vocalist marks the integration as `inactive`.

### Data Webhooks (e.g. Abandoned Carts)
- WeeberSh subscribes to Shopify webhooks (like `checkouts/create` and `checkouts/update`).
- Currently, WeeberSh forwards these payloads to `/api/integrations/shopify/checkouts/create`.
- *Note:* The Vocalist backend expects to receive these payloads to schedule recovery calls (via `ShopifyProvider._handleCheckoutEvent`), but the routing pipeline is currently incomplete and needs to be unified.
