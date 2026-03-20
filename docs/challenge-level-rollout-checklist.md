# Challenge and Level Separation Rollout Checklist

Status key:
- DONE: implemented in this pass
- TODO: planned but not implemented yet

## Sprint 1 - Data and API Foundation

### TKT-BE-001 - Add Challenge Group model and level linkage
- Status: DONE
- Goal: Introduce concept-group layer between module and executable level.
- Scope:
  - Add `challenge_groups` table model.
  - Add `challenge_group_id` foreign key to existing `challenges` table (levels).
  - Add ORM relationships: `Module -> ChallengeGroup -> Challenge`.
- Files:
  - `backend/curriculum/models.py`
- Acceptance criteria:
  - Backend starts with new model definitions.
  - Existing challenge records can be associated with challenge groups.

### TKT-BE-002 - Add challenge-group and level schemas
- Status: DONE
- Goal: Define API contracts for concept groups and levels.
- Scope:
  - Add `ChallengeGroupCreate/Update/Response`.
  - Add `LevelCreate/Update/Response`.
  - Extend legacy challenge payload with optional `challenge_group_id`.
- Files:
  - `backend/curriculum/schemas.py`
- Acceptance criteria:
  - New endpoint payloads validate correctly.
  - Backward compatibility remains for legacy challenge endpoints.

### TKT-BE-003 - Add challenge-group and level services
- Status: DONE
- Goal: Implement business logic for new hierarchy.
- Scope:
  - CRUD for challenge groups.
  - CRUD for levels using explicit level API.
  - Legacy challenge methods remain operational.
  - Level files wrapper support.
- Files:
  - `backend/curriculum/services.py`
- Acceptance criteria:
  - Create/list/update/delete works for challenge groups and levels.
  - Legacy challenge create/edit/list/delete still usable.

### TKT-BE-004 - Add challenge-group and level routes
- Status: DONE
- Goal: Expose separate API surfaces while keeping old routes.
- Scope:
  - Add `/challenge-groups` endpoints.
  - Add `/modules/{module_id}/challenges` group listing endpoint.
  - Add `/levels` endpoints.
  - Add `/challenges/{challenge_group_id}/levels` endpoint.
- Files:
  - `backend/curriculum/router.py`
- Acceptance criteria:
  - New endpoints are available under `/api`.
  - Legacy challenge endpoints remain available.

### TKT-BE-005 - Migration and data backfill
- Status: DONE
- Goal: Safely move existing data into grouped hierarchy.
- Scope:
  - Ensure `challenge_groups` table exists.
  - Add `challenge_group_id` column if missing.
  - Create default group per module where needed.
  - Backfill existing levels to default group.
- Files:
  - `backend/migrate.py`
- Acceptance criteria:
  - Existing modules retain their levels after migration.
  - No level left with null group when backfill runs.

### TKT-BE-006 - Progress payload upgrade for grouped UI
- Status: DONE
- Goal: Return both grouped and legacy flat progress structures.
- Scope:
  - Add nested `challenge_groups` in module progress response.
  - Keep legacy flat `challenges` list for compatibility.
  - Order published levels by challenge-group order then level order.
- Files:
  - `backend/progress/router.py`
- Acceptance criteria:
  - Student clients can render separate challenge page and level page.
  - Existing clients consuming flat list still work.

## Sprint 2 - Admin UX Separation

### TKT-FE-001 - Extend shared admin curriculum API client
- Status: DONE
- Goal: Add frontend helpers for new hierarchy APIs.
- Scope:
  - Add challenge-group methods.
  - Add level methods.
  - Keep legacy challenge methods.
- Files:
  - `client/src/pages/admin/curriculum/api.js`
- Acceptance criteria:
  - Admin pages can call new endpoints without custom fetch boilerplate.

### TKT-FE-002 - Add Challenge Manager page
- Status: DONE
- Goal: Separate Challenge list from Level list.
- Scope:
  - New page to list challenge groups by module.
  - Actions: create, edit, delete, manage levels.
- Files:
  - `client/src/pages/admin/curriculum/ChallengeManager.jsx`
  - `client/src/pages/admin/curriculum/ChallengeManager.css`
- Acceptance criteria:
  - Admin can manage concept groups without opening level editor.

### TKT-FE-003 - Add Challenge Group Form page
- Status: DONE
- Goal: Dedicated create/edit screen for concept groups.
- Scope:
  - New page with title, description, order, publish controls.
- Files:
  - `client/src/pages/admin/curriculum/ChallengeGroupForm.jsx`
  - `client/src/pages/admin/curriculum/ChallengeGroupForm.css`
- Acceptance criteria:
  - Admin can create/edit challenge groups with module context.

### TKT-FE-004 - Add Level Manager page
- Status: DONE
- Goal: Dedicated level list page under each challenge group.
- Scope:
  - List levels by challenge group.
  - Actions: create, edit, delete.
- Files:
  - `client/src/pages/admin/curriculum/LevelManager.jsx`
  - `client/src/pages/admin/curriculum/LevelManager.css`
- Acceptance criteria:
  - Admin can browse levels separately from challenge groups.

### TKT-FE-005 - Rewire Module form flow
- Status: DONE
- Goal: Route module setup into challenge-first management.
- Scope:
  - Replace direct level management block with challenge-group management links.
  - Update create-module post-save redirect to challenge manager.
- Files:
  - `client/src/pages/admin/curriculum/ModuleForm.jsx`
- Acceptance criteria:
  - New module setup flow is Module -> Challenge Manager -> Level Manager.

### TKT-FE-006 - Upgrade advanced level editor for challenge context
- Status: DONE
- Goal: Keep existing advanced editor UI, but make it group-aware.
- Scope:
  - Add `challenge_id` query context support.
  - Use new level APIs for create/update/files.
  - Return to level manager after save/cancel when challenge context exists.
- Files:
  - `client/src/pages/admin/curriculum/ChallengeForm.jsx`
- Acceptance criteria:
  - Admin edits levels from dedicated level list and returns to same context.

### TKT-FE-007 - Register admin routes for separated pages
- Status: DONE
- Goal: Add explicit routes for challenge and level pages.
- Scope:
  - Add challenge manager, challenge-group form, level manager, level edit/create routes.
  - Keep legacy routes active.
- Files:
  - `client/src/App.jsx`
- Acceptance criteria:
  - New admin navigation paths resolve and render.

## Sprint 3 - Student UX Separation

### TKT-FE-008 - Convert module page into challenge list page
- Status: DONE
- Goal: Student sees challenge groups first, not direct level list.
- Scope:
  - Render challenge-group timeline/cards per module.
  - Navigate to challenge-level page on click.
- Files:
  - `client/src/pages/workspace/ModuleCurriculum.jsx`
  - `client/src/pages/workspace/ModuleCurriculum.css`
- Acceptance criteria:
  - Module view lists concept groups with counts and XP.

### TKT-FE-009 - Add challenge-level listing page
- Status: DONE
- Goal: Dedicated page listing levels for one challenge group.
- Scope:
  - New page with timeline cards for levels.
  - Navigate to workspace with challenge context.
- Files:
  - `client/src/pages/workspace/ChallengeLevels.jsx`
  - `client/src/App.jsx`
- Acceptance criteria:
  - Student flow becomes Module -> Challenge -> Level -> Workspace.

### TKT-FE-010 - Update workspace route and resolver logic
- Status: DONE
- Goal: Support level loading in challenge context while keeping legacy paths.
- Scope:
  - Add challenge-aware workspace route.
  - Resolve levels by local index inside challenge group.
  - Keep legacy module-level route functional.
- Files:
  - `client/src/pages/workspace/Workspace.jsx`
  - `client/src/App.jsx`
- Acceptance criteria:
  - Workspace opens from new challenge-level path.
  - Legacy direct module/level path still works.

### TKT-FE-011 - Update Continue CTA in lab page
- Status: DONE
- Goal: Continue button should follow new hierarchy paths.
- Scope:
  - Prefer challenge-aware level route when grouped data exists.
  - Fallback to legacy path if needed.
- Files:
  - `client/src/pages/workspace/LabCurriculum.jsx`
- Acceptance criteria:
  - Continue button opens next playable level in the new path structure.

## Sprint 4 - QA and Hardening

### TKT-QA-001 - Manual regression pass for admin flow
- Status: TODO
- Test cases:
  - Create module -> create challenge group -> create level.
  - Edit and delete challenge group.
  - Edit and delete level.
  - Legacy level edit routes still open editor.

### TKT-QA-002 - Manual regression pass for student flow
- Status: TODO
- Test cases:
  - Lab -> Module -> Challenge -> Level -> Workspace path.
  - Continue CTA from lab lands in challenge-level path.
  - Locked states remain respected.
  - Completion still grants XP and progresses gates.

### TKT-QA-003 - Migration execution and verification
- Status: DONE
- Steps:
  - Run migration inside backend container:
    - `docker compose exec backend python migrate.py`
  - Verify challenge group rows created for existing modules.
  - Verify no null `challenge_group_id` rows remain in `challenges`.
- Execution result:
  - Migration command executed successfully in this pass.
  - Schema detected as up-to-date and challenge group backfill completed.

### TKT-QA-004 - API compatibility verification
- Status: TODO
- Test cases:
  - Old challenge endpoints still return expected payloads.
  - New challenge-group and level endpoints return expected payloads.

## Deployment Runbook

1. Pull latest code.
2. Run backend migration inside container:
   - `docker compose exec backend python migrate.py`
3. Restart backend and frontend containers.
4. Execute Sprint 4 QA tickets.
5. Promote to staging/production after QA sign-off.

## Notes

- Existing visual style is intentionally preserved.
- Legacy API and legacy route compatibility were retained to reduce rollout risk.
- Drag-and-drop reorder for challenge groups and levels is not implemented yet and can be scheduled as a follow-up sprint.
