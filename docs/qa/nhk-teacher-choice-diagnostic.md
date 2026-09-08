# Real planner diagnostic and bounded correction

Run 34242055931 showed all three short planner requests completed successfully; this was not an API transport, reasoning-budget or timeout problem. Two drafts phrased ONE either/or choice as two rising fragments: ニュースで？学校で？ and 読みやすい？むずかしい？. The one-question validator rejected both, unnecessarily falling back to local wording.

Correction: explicitly request a single choice sentence, and normalize only the exact two short alternatives when they exactly match the two validated keyword fields, e.g. ニュースで、学校で、どちらですか。. The resulting text then goes through all existing length, topic, difficulty-pattern and single-question checks BEFORE audio. Do not merge independent questions, altered keywords, prose prefixes, extra questions or executable text. Real probe requirements, including at least two accepted model turns, remain unchanged. No token-budget increase, provider-key access or extra model was required.
