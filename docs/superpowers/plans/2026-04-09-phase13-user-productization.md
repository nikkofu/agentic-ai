# Phase 13 User Productization Implementation Plan

**Goal:** Turn the stronger runtime kernel into a product surface users can understand and trust by exposing intent, plan, policy, evidence, blocking reasons, and artifact truth clearly in the dashboard and delivery flow.

## Task 1: Runtime Inspector
- expose `intent`, `planner policy`, `latest delivery`, and `blocking reason` through `taskLifecycle.inspectTask()`
- surface those facts in dashboard inspector UI
- add focused tests for inspector summaries and UI rendering

## Task 2: Artifact And Verification UX
- show final artifacts with existence / non-empty truth
- show verification evidence counts and previews
- make blocked research-writing tasks explain what evidence is missing

## Task 3: Final Result And Blocking Diagnosis
- improve task close summaries for `completed`, `blocked`, `failed`
- show actionable next steps instead of opaque state strings
- unify task/node failure explanations between banner, lifecycle panel, and graph

## Task 4: Gold-Path Demo Flows
- add product-facing proof flows for:
  - research-writing
  - code edit + test
  - async resume after interruption
- archive demo artifacts and explain where they are stored

## Task 5: Release Verification And Documentation
- run Phase 13 focused verification
- update README / CHANGELOG
- add release diary on version cut
