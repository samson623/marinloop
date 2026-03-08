# MarinLoop Trust Center

MarinLoop is built for personal medication tracking, reminders, and caregiver coordination. This document explains the product's intended use, safety boundary, data-handling posture, and the external guidance that informs how the beta is positioned.

This document is product guidance, not legal advice.

## Intended Use

MarinLoop is intended to help patients and caregivers:

- track medications, schedules, refill timing, and adherence history
- record symptoms, vitals, notes, and appointments
- coordinate with caregivers and emergency contacts
- receive best-effort reminders and informational drug reference lookups

## Not Intended For

MarinLoop is not intended to:

- diagnose, treat, cure, or prevent disease
- provide clinical decision support or treatment recommendations
- replace a pharmacist, physician, nurse, or other licensed professional
- serve as the sole safeguard for time-critical medication administration
- control, alter, or interface with regulated medical devices
- be used for production workflows that require HIPAA business associate agreements in this beta

## HIPAA Boundary For This Beta

This beta is not being offered as a HIPAA-regulated service for covered entities or business associates. Do not use MarinLoop beta for:

- provider-deployed patient workflows that require BAAs
- storage or transmission of third-party PHI on behalf of a covered entity
- production clinical operations or care-delivery programs

If MarinLoop were to be used in a HIPAA-regulated environment in the future, that would generally require a separate compliance program including BAAs with applicable cloud and AI subprocessors, a documented risk analysis, and operational controls aligned to the intended deployment model.

## AI Boundary

AI features are optional and require explicit user consent. In this beta, they should be treated as non-HIPAA features and not used with regulated PHI. Core medication tracking, schedules, and reminders work without AI.

AI output in MarinLoop is informational only:

- no diagnosis
- no treatment recommendation
- no medication-order authority
- no substitution for professional review

## Built-In Safeguards

- authentication through Supabase Auth
- Row Level Security on application tables
- HTTPS transport and encryption at rest through platform providers
- explicit beta terms and AI consent gating
- in-app privacy policy and terms of service
- account export and delete controls
- idle-timeout support and audit-focused data patterns
- best-effort push reminders rather than safety-critical alarm claims

## Reviewer Notes

For medical reviewers:

- MarinLoop is positioned as a patient/caregiver workflow tool with a clearly limited safety scope.
- Drug reference and interaction surfaces are informational and should be independently reviewed by a licensed professional.

For technical partners:

- the repo includes typed frontend code, Supabase RLS, Edge Functions for server-side AI, automated tests, CI, secret scanning, and Lighthouse checks
- the product boundary is deliberately narrower than a clinical system

For investors:

- the strength of MarinLoop is product scope and execution across a real adherence workflow
- the near-term credibility challenge is presentation, trust packaging, and disciplined external proof

## External References

- FDA: Device Software Functions Including Mobile Medical Applications  
  https://www.fda.gov/medical-devices/digital-health-center-excellence/device-software-functions-including-mobile-medical-applications
- FDA: Examples of Software Functions That Are NOT Medical Devices  
  https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-are-not-medical-devices
- HHS OCR: Guidance on HIPAA and Cloud Computing  
  https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html
- HHS OCR: HIPAA Security Series, Technical Safeguards  
  https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/techsafeguards.pdf
- OpenAI Help Center: Business Associate Agreement (BAA) for API Services  
  https://help.openai.com/en/articles/8660679
