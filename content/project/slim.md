---
title: SLIM
summary: Lab operations platform for academic laboratories; samples, inventory, equipment, notebooks, multi-lab access control.
start: 2026-06
url: https://slim.poqet.cz
uses:
  - { to: skill/sveltekit, note: 'full-stack SvelteKit application' }
  - { to: skill/effect, note: 'Effect for services, typed errors and validation' }
  - { to: skill/surrealdb, note: 'SurrealDB as the database' }
  - { to: skill/typescript, note: 'strict TypeScript throughout' }
  - {
      to: skill/agentic-engineering,
      note: 'developed with a Claude Code harness, guardrails and evaluations',
    }
in-domain: [domain/lab-operations]
---

SLIM is poqet's lab operations platform for academic laboratories in botany, biology and chemistry: sample tracking, inventory and warehouses, projects and tasks, equipment and reservations, lab notebooks and protocols, several laboratories within one institute, and a role- and permission-based access system. Used by research groups at three Prague institutions. Full-stack web application in SvelteKit, Effect and SurrealDB, built by a three-person team led by Pavel Holman.
