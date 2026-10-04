---
title: Agile / Scrum ceremonies
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Scrum Guide 2020
tags: [agile, scrum, process]
sources: [scrumguides.org]
---

Purpose, timebox and outputs of each Scrum event, plus the artefacts that connect them. Timeboxes are maximums for a one-month sprint; shorter sprints use proportionally less.

## Roles (accountabilities)

- **Product Owner** — maximises product value; owns and orders the Product Backlog
- **Scrum Master** — coaches the team, removes impediments, protects the process
- **Developers** — create the Increment; own the Sprint Backlog and how work is done

```text
Scrum Team = 1 Product Owner + 1 Scrum Master + Developers (typically 10 or fewer people)
```

## Sprint

- Fixed length, one month or less (two weeks is common)
- Contains all other events; a new sprint starts immediately after the previous one
- Only the Product Owner can cancel a sprint (if the Sprint Goal becomes obsolete)

```text
Sprint Planning → Daily Scrums → Sprint Review → Sprint Retrospective → next Sprint
```

## Sprint Planning

- Timebox: up to 8 hours (one-month sprint); ~2–4 hours for two weeks
- Answers: **Why** is this sprint valuable? **What** can be done? **How** will it get done?
- Output: Sprint Goal + selected backlog items + plan = Sprint Backlog

```text
Sprint Goal: "Customers can download a masked loan statement as PDF."
```

## Daily Scrum

- Timebox: 15 minutes, same time and place every working day
- For Developers to inspect progress toward the Sprint Goal and adapt the plan
- Any format works — focus on the goal and impediments, not status reporting

```text
Toward the goal: What changed? What's next? What's blocking us?
```

## Sprint Review

- Timebox: up to 4 hours (one-month sprint)
- A working session with stakeholders to inspect the Increment and adapt the Product Backlog
- Not just a demo — discuss what to do next

```text
Inputs: Increment, Product Backlog · Output: revised Product Backlog
```

## Sprint Retrospective

- Timebox: up to 3 hours (one-month sprint)
- Inspect people, interactions, processes, tools and the Definition of Done
- Pick the most helpful improvements; they may go into the next Sprint Backlog

```text
Formats: Start / Stop / Continue · Mad / Sad / Glad · 4Ls (Liked, Learned, Lacked, Longed for)
```

## Artefacts and commitments

- **Product Backlog** → commitment: **Product Goal**
- **Sprint Backlog** → commitment: **Sprint Goal**
- **Increment** → commitment: **Definition of Done**

```text
Definition of Done (example): code reviewed · unit tests ≥ 85% · security scan clean · deployed to UAT · docs updated
```

## Backlog refinement

- Ongoing activity (not a formal event); often ~10 % of capacity
- Break items down, clarify acceptance criteria, estimate
- Ready items are small, clear and testable (INVEST)

```text
As an operations analyst, I want to merge scanned PDFs, so that each case file is a single document.
Acceptance: given 2–50 PDFs, when I merge, then pages keep order and scripts are removed.
```

## Estimation and flow

- Story points estimate relative effort; velocity is for planning, not performance
- Planning poker uses a modified Fibonacci scale
- Kanban metrics: WIP limits, cycle time, throughput

```text
Story points: 1, 2, 3, 5, 8, 13, 20, 40, 100 · "?" = need more information
```
