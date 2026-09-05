# Project the existing transcript at render time

Group display is derived from the host's current direct transcript children on each render. The adapter temporarily presents group views to the original Container renderer and restores the original child-array reference in a finally block. This also lets Pi compute the mouse layout for the actual displayed groups. Tracking only addChild/removeChild was rejected because Pi also inserts transcript entries through direct array edits.

Only presentation is patched: container render/mouse dispatch and native expansion-status routing. Thinking visibility stays owned by Pi's native configuration and components. Tool definitions, execution and conversation data remain authoritative in Pi. The adapter is limited to the exact certified host release and has instance-owned, reversible installation; a future public aggregation interface should replace it.
