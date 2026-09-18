# Security boundaries

Milestone 0 establishes boundaries before financial execution exists.

1. The application API is **not** the future secure signer.
2. LLMs and external capabilities are untrusted inputs, never final authorization authorities.
3. Mainnet writes/autonomy default to off.
4. Secret-bearing files are ignored and rejected by repository verification.
5. Audit records and transactional outbox events carry trace IDs.
6. Signing material must later live behind an isolated signer/KMS/HSM/MPC/passkey/smart-account boundary.
7. Creator code and provider responses will never directly receive unrestricted user signing authority.
8. Onchain receipt anchoring will be asynchronous unless the onchain action itself is required to complete the user's job.
