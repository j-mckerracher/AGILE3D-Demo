---
title: Agile3D - Demo Video Essential Points
date: 2025-10-09T18:25:30Z
tags:
  - nsf
  - site-visit
  - agile3d
status: draft
source: "[[agile3d-mobisys25.pdf]]"
related:
  - "[[agile3d-high-level-summary]]"
---

[[agile3d-mobisys25.pdf]]

## Core message for 60–120s
Agile3D adaptively balances accuracy and latency for 3D object detection on embedded GPUs by switching among pre-buffered model branches based on scene content and real-time contention, achieving SOTA accuracy while meeting strict latency SLOs (100–500 ms) across Waymo, nuScenes, and KITTI on Jetson Orin/Xavier.

## Visual elements to show (scenes, assets, animations)
- Live LiDAR point cloud with 3D bounding boxes for vehicles/pedestrians/cyclists.
- On-screen indicators for current contention level and target latency SLO (e.g., 100/350/500 ms).
- Overlay showing the currently selected branch (e.g., CP-Voxel vs. PP-variant) and a small timeline of recent branch switches.
- Side panel chart: live latency vs. SLO, latency violations (expected <10%), and throughput (aiming for 10 Hz on Waymo-like sequences).
- Comparative callouts vs. a static baseline (e.g., DSVT-Pillar or CP-Pillar): accuracy delta (+3–11% depending on dataset/condition) and speedup (1.2–8× depending on scenario).

## Demo flow outline (step-by-step, 5–8 steps)
1. Problem/Setup: Latency-accuracy tension on embedded GPUs; show static baseline struggling under contention.
2. Introduce Agile3D: MEF with five control knobs and CARL controller (DPO-tuned) + pre-buffered branches (<1 ms switching).
3. Live playback: Waymo-like sequence with injected contention changes (Light → Moderate → Intense → Peak) while tracking SLO compliance.
4. Content shift: Switch to scenes dominated by pedestrians vs. vehicles; show different branches being selected to keep accuracy high.
5. Metrics overlay: Show accuracy vs. latency Pareto placement improving over baselines in the same scenes.
6. Stability check: Show low violation ratio under 500 ms SLO and sustained throughput around 10 Hz.
7. Wrap-up: Summarize SOTA accuracy at embedded-device SLOs and applicability to autonomous robotics and AR/VR.

## Metrics or results to present visually
- Accuracy deltas: +1–5% vs. adaptive baselines; +7–16% vs. static models in some settings (dataset-dependent).
- SLO compliance: latency violation ratio <10% under 100–500 ms SLOs across contention levels.
- Switching overhead: <1 ms per branch change with models pre-buffered; controller overhead ~1–8 ms.
- Throughput: near 10 Hz for Waymo-like LiDAR cadence at target SLOs.

## Assets/timeline checklist for coordination
- Jetson platform prepared (Orin/Xavier), max power mode, DVFS disabled; demo scripts and profiles installed.
- Curated LiDAR sequence(s) representing vehicles/pedestrians/cyclists; content-shift segments.
- Real-time overlay: latency, SLO, current branch, violation ratio.
- Pareto and result figures as backup slides (Waymo/nuScenes/KITTI highlights).
- Dry-runs with contention profiles; verify <1 ms switching and <10% violations under 500 ms SLO.
