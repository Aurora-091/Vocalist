-- Add analysis_config column to agents and agent_presets tables
ALTER TABLE agents ADD COLUMN IF NOT EXISTS analysis_config jsonb DEFAULT NULL;
ALTER TABLE agent_presets ADD COLUMN IF NOT EXISTS analysis_config jsonb DEFAULT NULL;

-- Update Shopify presets with analysis configs
UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "purchase_intent", "data_type": "string", "description": "Did the customer express intent to complete purchase? Values: yes, no, maybe"},
    {"identifier": "objection_reason", "data_type": "string", "description": "Primary reason customer hesitated or refused, if any"},
    {"identifier": "discount_offered", "data_type": "boolean", "description": "Was a discount code offered during the call?"},
    {"identifier": "next_action", "data_type": "string", "description": "What should happen next: completed_purchase, follow_up_later, do_not_contact, needs_human"}
  ],
  "evaluation_criteria": [
    {"identifier": "call_successful", "description": "The customer agreed to complete their purchase or showed clear intent to return to cart"},
    {"identifier": "remained_polite", "description": "The agent maintained a friendly, non-pushy tone throughout the entire call"},
    {"identifier": "respected_boundaries", "description": "The agent immediately stopped selling when the customer said no or asked to not be contacted"}
  ]
}'::jsonb
WHERE preset_key = 'shopify_cart_recovery';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "order_confirmed", "data_type": "boolean", "description": "Did the customer confirm they placed the order?"},
    {"identifier": "address_correct", "data_type": "boolean", "description": "Is the delivery address confirmed as correct?"},
    {"identifier": "address_correction", "data_type": "string", "description": "New address if customer provided a correction, otherwise empty"},
    {"identifier": "cancellation_requested", "data_type": "boolean", "description": "Did the customer request order cancellation?"}
  ],
  "evaluation_criteria": [
    {"identifier": "identity_verified", "description": "The agent verified the customer identity by confirming order details"},
    {"identifier": "call_efficient", "description": "The call was completed in under 2 minutes with all necessary confirmations"}
  ]
}'::jsonb
WHERE preset_key = 'shopify_cod_confirmation';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "order_id_provided", "data_type": "string", "description": "The order ID the customer asked about"},
    {"identifier": "issue_type", "data_type": "string", "description": "Type of issue: tracking, delay, missing, damaged, wrong_item, or general_inquiry"},
    {"identifier": "resolution", "data_type": "string", "description": "How the query was resolved: info_provided, escalated, refund_initiated, replacement"}
  ],
  "evaluation_criteria": [
    {"identifier": "customer_verified", "description": "Agent verified customer identity before sharing order details"},
    {"identifier": "query_resolved", "description": "The customer query was fully addressed or properly escalated"}
  ]
}'::jsonb
WHERE preset_key = 'shopify_order_status';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "return_or_exchange", "data_type": "string", "description": "Does the customer want a return or exchange? Values: return, exchange, undecided"},
    {"identifier": "return_reason", "data_type": "string", "description": "Reason for return: size, quality, wrong_item, changed_mind, other"},
    {"identifier": "eligible", "data_type": "boolean", "description": "Is the item eligible for return per policy?"},
    {"identifier": "exchange_offered", "data_type": "boolean", "description": "Was an exchange offered as alternative to refund?"}
  ],
  "evaluation_criteria": [
    {"identifier": "policy_followed", "description": "Agent followed return policy correctly and did not make unauthorized exceptions"},
    {"identifier": "exchange_attempted", "description": "Agent offered exchange before processing refund to retain revenue"}
  ]
}'::jsonb
WHERE preset_key = 'shopify_returns';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "satisfaction_level", "data_type": "string", "description": "Customer satisfaction: very_happy, happy, neutral, unhappy, very_unhappy"},
    {"identifier": "review_agreed", "data_type": "boolean", "description": "Did the customer agree to leave a review?"},
    {"identifier": "issue_reported", "data_type": "string", "description": "Any product issue reported, or empty if none"},
    {"identifier": "interested_in_related", "data_type": "boolean", "description": "Did the customer show interest in suggested related products?"}
  ],
  "evaluation_criteria": [
    {"identifier": "non_pushy", "description": "Agent did not push sales when customer expressed dissatisfaction"},
    {"identifier": "issue_escalated", "description": "If a quality issue was reported, agent offered to route to support"}
  ]
}'::jsonb
WHERE preset_key = 'shopify_post_purchase';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "promo_acknowledged", "data_type": "boolean", "description": "Did the customer acknowledge hearing the promotion?"},
    {"identifier": "interest_level", "data_type": "string", "description": "Customer interest: high, moderate, low, none"},
    {"identifier": "sms_requested", "data_type": "boolean", "description": "Did the customer request SMS with promo details?"}
  ],
  "evaluation_criteria": [
    {"identifier": "under_90_seconds", "description": "The call was kept under 90 seconds as required"},
    {"identifier": "single_promo_only", "description": "Agent mentioned only one promotion and did not upsell additional items"}
  ]
}'::jsonb
WHERE preset_key = 'shopify_promo_blast';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "reason_for_absence", "data_type": "string", "description": "Why the customer stopped purchasing: price, quality, forgot, competitor, no_longer_needs, other"},
    {"identifier": "willing_to_return", "data_type": "boolean", "description": "Did the customer express willingness to shop again?"},
    {"identifier": "incentive_needed", "data_type": "string", "description": "What would bring them back: discount, new_products, free_shipping, nothing"}
  ],
  "evaluation_criteria": [
    {"identifier": "personal_approach", "description": "Agent referenced the customers past purchase history to personalize the conversation"},
    {"identifier": "graceful_exit", "description": "If customer was not interested, agent thanked them and ended without pressure"}
  ]
}'::jsonb
WHERE preset_key = 'shopify_winback';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "renewal_confirmed", "data_type": "boolean", "description": "Did the customer confirm they want to continue their subscription?"},
    {"identifier": "changes_requested", "data_type": "string", "description": "Any subscription changes requested: frequency, product, pause, cancel"},
    {"identifier": "payment_issue", "data_type": "boolean", "description": "Was there a payment issue that needs resolution?"}
  ],
  "evaluation_criteria": [
    {"identifier": "retention_attempted", "description": "If customer wanted to cancel, agent offered alternatives before processing"},
    {"identifier": "clear_confirmation", "description": "Agent clearly confirmed the renewal status and next billing date"}
  ]
}'::jsonb
WHERE preset_key = 'shopify_subscription_renewal';

-- Update Clinic presets with analysis configs
UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "appointment_booked", "data_type": "boolean", "description": "Was an appointment successfully booked?"},
    {"identifier": "appointment_date", "data_type": "string", "description": "Date and time of booked appointment, if any"},
    {"identifier": "appointment_type", "data_type": "string", "description": "Type of appointment: cleaning, checkup, consultation, procedure, emergency"},
    {"identifier": "new_patient", "data_type": "boolean", "description": "Is this a new patient or existing?"}
  ],
  "evaluation_criteria": [
    {"identifier": "booking_completed", "description": "Agent successfully booked or offered available appointment slots"},
    {"identifier": "insurance_asked", "description": "Agent asked about insurance information for new patients"}
  ]
}'::jsonb
WHERE preset_key = 'clinic_appointment_booking';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "appointment_confirmed", "data_type": "boolean", "description": "Did the patient confirm their appointment?"},
    {"identifier": "reschedule_requested", "data_type": "boolean", "description": "Did the patient request to reschedule?"},
    {"identifier": "new_date", "data_type": "string", "description": "New appointment date if rescheduled, otherwise empty"},
    {"identifier": "cancellation", "data_type": "boolean", "description": "Did the patient cancel entirely?"}
  ],
  "evaluation_criteria": [
    {"identifier": "confirmation_obtained", "description": "Agent obtained a clear yes or no on whether patient will attend"},
    {"identifier": "reschedule_offered", "description": "If patient could not make it, agent offered alternative times"}
  ]
}'::jsonb
WHERE preset_key = 'clinic_reminder';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "reason_for_no_show", "data_type": "string", "description": "Why the patient missed: forgot, conflict, sick, transportation, no_reason_given"},
    {"identifier": "rescheduled", "data_type": "boolean", "description": "Was the appointment rescheduled?"},
    {"identifier": "new_date", "data_type": "string", "description": "New appointment date if rescheduled"}
  ],
  "evaluation_criteria": [
    {"identifier": "empathetic_tone", "description": "Agent was understanding and non-judgmental about the missed appointment"},
    {"identifier": "rebooking_attempted", "description": "Agent offered to reschedule before ending the call"}
  ]
}'::jsonb
WHERE preset_key = 'clinic_no_show';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "forms_completed", "data_type": "boolean", "description": "Were intake questions answered?"},
    {"identifier": "insurance_info", "data_type": "string", "description": "Insurance provider and plan type if shared"},
    {"identifier": "allergies_noted", "data_type": "boolean", "description": "Were any allergies or medications mentioned?"},
    {"identifier": "special_needs", "data_type": "string", "description": "Any special accommodations or concerns noted"}
  ],
  "evaluation_criteria": [
    {"identifier": "complete_intake", "description": "All required intake fields were collected during the call"},
    {"identifier": "patient_comfortable", "description": "Agent made the patient feel comfortable sharing personal health information"}
  ]
}'::jsonb
WHERE preset_key = 'clinic_intake';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "recovery_status", "data_type": "string", "description": "Patient recovery: good, some_concerns, needs_attention, emergency"},
    {"identifier": "symptoms_reported", "data_type": "string", "description": "Any symptoms or concerns reported by patient"},
    {"identifier": "follow_up_needed", "data_type": "boolean", "description": "Does the patient need a follow-up appointment?"},
    {"identifier": "medication_issues", "data_type": "boolean", "description": "Any issues with prescribed medication?"}
  ],
  "evaluation_criteria": [
    {"identifier": "concern_addressed", "description": "Agent properly addressed or escalated any health concerns reported"},
    {"identifier": "follow_up_scheduled", "description": "If follow-up was needed, agent offered to schedule it"}
  ]
}'::jsonb
WHERE preset_key = 'clinic_post_visit';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "medication_name", "data_type": "string", "description": "Name of medication being refilled"},
    {"identifier": "refill_approved", "data_type": "boolean", "description": "Was the refill request submitted successfully?"},
    {"identifier": "pharmacy_preference", "data_type": "string", "description": "Preferred pharmacy for pickup"},
    {"identifier": "doctor_review_needed", "data_type": "boolean", "description": "Does the refill require doctor review before approval?"}
  ],
  "evaluation_criteria": [
    {"identifier": "identity_verified", "description": "Agent verified patient identity before processing refill"},
    {"identifier": "safety_check", "description": "Agent confirmed no changes in health status that might affect the prescription"}
  ]
}'::jsonb
WHERE preset_key = 'clinic_prescription_refill';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "insurance_verified", "data_type": "boolean", "description": "Was insurance information successfully verified?"},
    {"identifier": "coverage_status", "data_type": "string", "description": "Coverage status: active, expired, pending, not_found"},
    {"identifier": "copay_amount", "data_type": "string", "description": "Estimated copay if available"},
    {"identifier": "issues_found", "data_type": "string", "description": "Any issues with insurance coverage"}
  ],
  "evaluation_criteria": [
    {"identifier": "verification_complete", "description": "Agent collected all necessary insurance details for verification"},
    {"identifier": "clear_communication", "description": "Agent clearly communicated coverage status and any patient responsibility"}
  ]
}'::jsonb
WHERE preset_key = 'clinic_insurance_verification';

UPDATE agent_presets SET analysis_config = '{
  "data_collection": [
    {"identifier": "screening_type", "data_type": "string", "description": "Type of preventive care discussed: annual_physical, dental_cleaning, vaccination, screening"},
    {"identifier": "appointment_scheduled", "data_type": "boolean", "description": "Was a preventive care appointment booked?"},
    {"identifier": "barriers_mentioned", "data_type": "string", "description": "Barriers to scheduling: time, cost, fear, no_barriers"},
    {"identifier": "last_visit_acknowledged", "data_type": "boolean", "description": "Did the patient acknowledge when their last visit was?"}
  ],
  "evaluation_criteria": [
    {"identifier": "health_benefit_explained", "description": "Agent explained why the preventive care is important for the patients health"},
    {"identifier": "booking_attempted", "description": "Agent offered specific available dates for the appointment"}
  ]
}'::jsonb
WHERE preset_key = 'clinic_preventive_care';
