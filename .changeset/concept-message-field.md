---
"@rawsql-ts/ddl-docs-cli": minor
---

Add optional structured Concept Spec package messaging.

Structured Concept Specs can now define `message.tagline` and `message.supportingLine` for package-level concepts or documentation concepts that need a short positioning promise before the detailed concept boundary. Generated concept pages render the message as a dedicated `Message` section, and validation rejects empty message fields when the message object is present.
