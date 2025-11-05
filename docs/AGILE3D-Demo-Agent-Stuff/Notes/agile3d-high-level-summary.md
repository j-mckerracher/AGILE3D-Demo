---
title: Agile3D - High-level Summary
date: 2025-10-09T18:25:30Z
tags:
  - nsf
  - site-visit
  - agile3d
status: draft
source: "[[agile3d-mobisys25.pdf]]"
related:
  - "[[agile3d-demo-video-essential-points]]"
---

[[agile3d-mobisys25.pdf]]

## Summary
Agile3D is an adaptive, contention- and content-aware 3D object detection system tailored for embedded GPUs. It combines a cross-model Multi-branch Execution Framework (MEF) with a reinforcement learning controller (CARL) that is supervised-pretrained and fine-tuned via Direct Preference Optimization (DPO) to select the optimal execution branch at runtime. Across Waymo, nuScenes, and KITTI on NVIDIA Jetson Orin/Xavier, Agile3D consistently satisfies tight latency SLOs (100–500 ms) under varying GPU contention while improving accuracy over adaptive baselines by roughly 1–5% and surpassing static 3D detectors by up to 7–16% in several settings.

## Key contributions
- First adaptive 3D object detection system for embedded GPUs that is both contention- and content-aware, operating under strict latency SLOs.
- Multi-branch Execution Framework (MEF) with five control knobs enabling >50 model branches:
  - Point cloud encoding format: voxel vs. pillar
  - Spatial resolution: voxel/pillar sizes
  - Spatial encoding: Hard Voxelization (HV) vs. Dynamic Voxelization (DV)
  - 3D feature extractor: transformer, sparse 3D CNNs (voxel), or 2D CNNs (pillar)
  - Detection head: anchor-based vs. center-based
- CARL controller that uses supervised pretraining and DPO fine-tuning (first application of DPO for branch scheduling in 3D detection) to remove hand-crafted reward design.
- Pre-buffering of branch models in GPU memory enabling <1 ms branch switching; controller overhead ~1–8 ms depending on variant.
- Two controller options: CARL (contention- and content-aware) for dynamic conditions, and DA-LUT (distribution-aware LUT) for contention-free scenarios.

## Method/Approach overview
- Cross-model branching (not single-model parameter tuning) is necessary in 3D because changing voxel/pillar sizes alters intermediate feature map geometry and often requires retraining.
- MEF exposes five control knobs across the detection pipeline (encoder → backbone → head) to create a portfolio of branches spanning latency/accuracy trade-offs.
- CARL formulates branch selection as an MDP over state S = (current point cloud, prior detection context, current contention). It is trained with supervised targets from an Approximate Oracle (AOB) and then fine-tuned with DPO using preference pairs derived from the AOB vs. reference policy.
- An alternate DA-LUT controller uses offline profiling statistics (mean/variance) to select branches with high confidence under SLOs when contention is low and content variability is modest.

## Evaluation summary (datasets, metrics, main results)
- Datasets: Waymo (primary), nuScenes, KITTI (standard splits; validation-reported mAP/NDS per common practice).
- Hardware: Jetson Orin and Xavier (embedded GPUs) with max power mode and DVFS disabled.
- Metrics: mAP/NDS and latency violation ratio under SLOs of 100, 350, 500 ms (aligned with LiDAR 10 Hz acquisition).
- Results (high level):
  - With contention: Agile3D leads or is on the Pareto frontier across SLOs, keeping violation rates <10% and improving accuracy vs. adaptive baselines (Chanakya, LiteReconfig) by ~1–3%+.
  - Without contention: Agile3D outperforms static 3D models (DSVT, CenterPoint, PointPillars, SECOND, etc.)—on Waymo, achieves 1–10% higher accuracy while operating 2.8–8× faster at comparable mAP; on nuScenes, 7–16% higher accuracy at 1.2–4× speedups; on KITTI, consistently meets 50–150 ms SLO with 2–7% accuracy gains.
  - Switching overhead <1 ms when branches are pre-buffered; total system overhead is a small fraction of the latency budget.

## Limitations/assumptions
- Requires offline training/profiling per dataset and target hardware configuration to calibrate branches and controller.
- Evaluation uses synthetic contention generators (common in prior work); future work should incorporate real-world multi-tenant contention traces.
- Spatial resolution changes (voxel/pillar sizes) typically require retraining specific modules; online adaptation without retraining remains open.

## Relevance to NSF site visit demo
- Demonstrates an adaptive 3D perception system that balances accuracy and latency on embedded hardware—a compelling systems+ML story.
- Visually engaging: live point cloud detections, branch switching under injected contention, SLO compliance, and accuracy-latency Pareto improvements.
- Directly connects to safety and reliability narratives for autonomous systems (consistent performance despite contention and scene variability).

## Open questions for Saurabh
- Target demo scenario(s): dataset segment and object classes to emphasize (vehicles, pedestrians, cyclists)?
- Which controller to showcase live (CARL vs. DA-LUT), and whether to visualize branch selection decisions over time?
- Which metrics to highlight on-screen: mAP/NDS, violation rate, per-branch latency distributions, or switching overhead timeline?
- Platform of record for the demo (Orin vs. Xavier), and expected contention patterns to simulate?
- How much to emphasize HV vs. DV trade-offs and center-based vs. anchor-based heads in the narrative?
- I need a rough idea of what the video should look like. Do you have an example?
