# Collaboration frontend candidate

This branch prepares 1.0.0-RC.37 for the coordinated collaboration adoption. A version declaration is not publication evidence; verify the remote artifact before adopting it.

Runtime code is the previously accepted collaboration frontend at 8d372142. The later dce92cfb commit adds a focused mention-read UI assertion. This branch changes release metadata, not that runtime behavior.

Use QQQ core `4.1.0-collab-33464d37e-SNAPSHOT` and collaboration `0.1.0-collab-8f348da-SNAPSHOT` together. The issued presence lease protocol requires coordinated frontend/backend adoption. Redis-backed hosts additionally use `qbit-redis:0.1.0-redis-7fe5492-SNAPSHOT`. Presence does not replace versioned database save checks.

Acceptance must select core source `33464d37e815e61dc0a08bd5b2eb249718dfe1b5`. Previous runtime acceptance is GitHub run 39683690943; a new run will verify this release revision before publication. The canonical CircleCI frontend publisher validates matching npm/Maven/tag versions and runs type, lint, test and static-export checks.

Track host adoption and release evidence in QRun-IO/qqq#1315. This candidate is not a production deployment or a stable release.
