# Validation

Candidate: 0.1.0-rc.1. Report date: 2026-09-05. Independent review and the remote CI matrix are still pending; this is not a release sign-off.

## Local evidence

On macOS arm64, Node 24.12.0 and Pi 0.85.0, 20 checks passed after building/type checking:

- Profile defaults, exact overrides, malformed configuration and native fallback.
- Real Pi component rendering, user/skill boundaries, direct transcript-array edits, pending+failed summaries, native recovery, narrow commands and mouse expansion.
- Repeated install/dispose with thinking restoration and preservation of original streaming/message data.
- Real bundled Pi CLI in a PTY executing a fixed `printf` fixture, rendering a group and reloading ten times while alternating thinking configuration.
- Actual npm tarball inspection and isolated installation with peer auto-install disabled, followed by real CLI loading and two reloads.
- Review regressions: image-only user turns, existing thinking restoration, newly arriving expanded members, native-hidden result text, RPC inactivity, prior prototype conflicts, and native renderer buttons.

The loader test initially failed with a built ESM entry inside the development tree, which resolved a different host class instance. The shipped source entry runs through Pi's extension loader; the adapter receives the host module objects from that entry.

These probes do not use an LLM. They establish CLI loading/lifecycle and component behavior, not a complete live-provider or every-terminal end-to-end certification. Broader replay/multimodal checks remain part of release review.

## Synthetic rendering measurement

Same process/host, 40 user turns, 8 bash calls per turn, 12 retained output lines per call, width 100. Two warmups and seven measured renders; medians below. The fixture contains no user session data.

| View | Native lines | Compact lines | Native median | Compact median |
| --- | ---: | ---: | ---: | ---: |
| Collapsed | 3,640 | 160 | 4.780 ms | 0.525 ms |
| Expanded | 5,560 | 9,080 | 1.450 ms | 1.833 ms |

Expanded output includes an additional retained-data appendix so that successful result blocks hidden by native renderers remain inspectable. Its first implementation rebuilt text layout every frame (15.873 ms median); caching by serialized content reduced that cost. The cache is weakly keyed by tool component, detects in-place content changes, and is discarded on disposal.

These numbers describe this synthetic workload only. Reproduce with `npm run benchmark`; do not infer tool-execution, model-latency or real-session performance from them.

## Certification limits

Only exact Pi 0.85.0 is accepted by the runtime gate. A future Pi version is not certified merely because npm resolves its peers. Linux and Node 22 are configured in CI and are not claimed locally verified until those jobs finish. Windows and alternative Pi runtimes are not certified by this candidate.
