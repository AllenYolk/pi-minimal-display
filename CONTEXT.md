# Tool presentation

Compact, inspectable presentation of Pi tool activity while preserving execution and conversation data.

## Language

**User turn**: Tool activity between two user-input boundaries in a transcript. Assistant commentary and thinking within it do not start another user turn.

**Tool call**: One invocation with an identity, arguments, and eventual result. A display group never merges executions.

**Display group**: A visual summary of the opted-in tool calls in a user turn. Every retained member detail remains accessible through expansion.

**Native mode**: Pi's existing presentation, including any registered tool renderer. The extension does not compact this tool.

**Count-only mode**: A compact count and status with details available on expansion.

**Lines mode**: A compact command preview when ungrouped; a group member when grouping is enabled.

**Retained detail**: The command, text blocks, images, structured details, and truncation references available to Pi. It excludes content Pi has already discarded.

**Certified host**: An exact Pi version whose presentation and lifecycle behavior has passed this project's checks.
