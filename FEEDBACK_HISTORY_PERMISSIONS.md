# Feedback history permissions reconciliation

Supabase production default table privileges grant service_role more than SELECT/INSERT. Granting SELECT/INSERT alone does not remove inherited UPDATE, DELETE or TRUNCATE privileges. The workflow migration now explicitly revokes service_role privileges on site_review_events before granting SELECT/INSERT, preserving the intended append-only server access.

The PostgreSQL fixture reproduces production-like default privileges. The original migration fails its history mutation check; the corrected migration passes, including explicit UPDATE, DELETE and TRUNCATE denials. Submission and history insertion continue through the existing RPC.

This exact privilege tightening was included in the authorized production rollout recorded as **20261027211954_feedback_review_workflow** in project jzfctjaaowdvubhqswpa on October 27, 2026. The checked-in historical filename is 20261027190238_feedback_review_workflow.sql. They represent the same workflow migration: **do not replay the local file or run a broad database push against production**. The base migration similarly uses hosted version 20261016195758 rather than local 20261016195233. Reconcile migration history explicitly before any future migration tooling; this PR does not modify hosted history or perform a migration.

Read-only production verification confirmed 22 original notes preserved, 22 legacy events, no fabricated approval timestamps, service_role UPDATE/DELETE denied, and public client roles denied table reads. Tad's existing membership is owner; Beth's membership remains absent pending normal email verification. No new grants, deployment or production writes are part of this review.

Recovery must preserve tasks and history. Do not delete reviewer memberships to revoke access: the existing note foreign key cascades deletion. The private, character-exact pre-rollout backup is retained outside Git and was restored locally; its contents are not included here.
