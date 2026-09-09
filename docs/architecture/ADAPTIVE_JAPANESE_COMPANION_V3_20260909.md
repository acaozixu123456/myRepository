# Adaptive Japanese Companion v3 — architecture decision and implementation contract

Status: DESIGN / NOT IMPLEMENTED / NOT DEPLOYED. Author: ChatGPT Sol. Date: 2026-09-09.
Reviewed production base: 313a538df99835165062ffff77bd7c6fb2a18b33.
The user's real experience rejects the current conversational behavior despite previous transport/UI test passes. Treat current conversational product quality as NEEDS_ATTENTION; preserve historical test results with their limited scope.

## 1. User contract

Build one adult Japanese conversation companion who also teaches: easy to begin, actually follows the learner's meaning, guides a small extension when appropriate, and adapts as independent speaking develops. Do not restrict it to NHK or require an article to start. Topics may come from verified news, interests, everyday knowledge, work and imagination, with factual provenance kept distinct. Accept one word initially, but offer a route to phrases and sentences rather than a permanent low ceiling. Questions about Japanese are first-class conversation, not regex-triggered detours to a new drill.

Mobile only. Preserve explicit microphone on/off, actual sound indicators, slower/repeat/help controls, all article/favorite/history/backup/quiet-study data and existing legacy TTS. No Windows Codex/Cursor, Luna or AppDeploy. Do not delete historical exploration code or user data. Keep long-lived credentials server-side. Do not introduce recording or transcript persistence silently.

## 2. What the code establishes, and what it does not

Inspected src/nhkChatConnection.ts, src/nhkGentleTeacher.ts and current README at the production base.

- Ordinary replies wait for a separate input transcription, then use a detached text response (conversation:none,input:[]) and a second detached audio response which only reads SAY. This deliberately reconstructs context as text rather than using a single native speech conversation.
- Text plans must satisfy a universal 48-character cap, short JSON fields, question-shape checks and selected lexical prohibitions. Timeout at 7 seconds or invalid draft replaces it with local fallback, including generic acknowledgements.
- Client history retains at most eight message entries; planning receives bounded text. Current input buffers are cleared at each request; short transport leases cause frequent renewal. These are context/segmentation risks to test, not proven explanations of a specific unrecorded user exchange.
- There is no evidence-based learner capability model distinguishing independent production, prompted completion and imitation. The old prohibition on difficulty escalation cannot implement the newly requested gradual progression.

No recording or transcript of the reported failed exchange has been supplied. Do not claim a unique root cause, provider defect or measured fallback rate. A chained architecture is not inherently defective; the current implementation and constraints need replacement/evaluation for this use case.

## 3. Core design: one speaking agent, supporting services outside the reply path

Mobile audio <-> one stateful Realtime conversation <-> same visible companion/tutor.
Supporting services: session controller, occasional learning observer, topic/source service, optional learning memory.

### Stateful voice core

Prefer native speech-to-speech over existing WebRTC with the already deployed gpt-realtime-2.1 as the initial comparison model. Do not silently change model. Retain the default Realtime conversation containing actual learner audio and assistant responses. Do not use detached empty-input responses for ordinary conversation and do not reinsert the same user transcript as a second user message. Transcription is a fallible subtitle/diagnostic/assessment aid, not the only source of what the learner said.

One component owns response creation and cancellation. Choose one VAD/manual scheduling policy per session; never let client and server both answer one turn. Initial preferred policy is patient VAD with explicit server response scheduling after committed audio, without waiting for independent ASR or a teacher draft. Keep native conversation and prompt configuration authoritative on the server. Verify event support and latency experimentally before release.

The speaking agent performs both conversation and brief teaching. It first resolves the learner's latest intent, then responds, optionally providing a small extension. It may be concise without a universal character-count rejection. Routine turns default to one or two short sentences; a direct explanation may take a little more. Keep emergency runaway/budget safeguards, but do not replace relevant ordinary answers solely because of length, question punctuation or benign topic vocabulary.

### Session correctness

Track logicalSessionId, transportEpoch, turn/item identity, response identity, current thread, unresolved question and last audible assistant segment. Preserve message order and ignore late results from earlier epochs/threads. Do not discard a second fragment because a previous ASR result arrived first. Mute is not end-of-conversation. Stop input immediately on explicit mute; a committed earlier utterance may still receive a response. A half-finished utterance must not be promoted as complete merely by clearing buffers.

When the user interrupts or corrects the assistant, stop playback, synchronize the actually heard portion and handle the correction before continuing. Never treat unplayed generated audio as heard or practiced. The existing 110-second server lease is an implementation constraint, not a pedagogical turn: evaluate a longer-lived controlled session/sideband host before promising seamless long chats. If renewal remains necessary, preserve unanswered question, verified user intent and adaptive policy; replay only when needed, not a new lesson. Keep time/token/spend protections, explicit end and idle pause.

### Asynchronous learning observer

The observer is NOT another voice and does not approve every reply. After a small evidence window or explicit difficulty signal, it proposes a bounded learning-policy update for future turns. Failed or slow observation does not block chat. Apply changes only at turn boundaries with version checks; never mutate the active response mid-sentence. Structured outputs may enforce schema, not truth; reject unsupported observations.

Policy fields: current comprehension support, output support, one active communicative goal, explicit pace preference, task/domain context, evidence count and confidence. No fixed global N-level inferred from a single word. The voice model itself can offer immediate help; the observer stabilizes longer-term adaptation.

## 4. Adaptive teaching policy

Separate three facts:
1. independently expresses an intention;
2. can express it with a keyword/starter/example;
3. has just imitated a displayed or spoken answer.

Record comprehension, communicative success, independence, repair ability and within-person fluency as distinct observations. A short yes/no may be the best answer; do not punish it. Do not turn word count, ASR completion time, microphone permission latency, network delay, accent, silence or corrected text into a proficiency score. Muted time, unplayed audio and unreliable recognition are excluded from learner evidence. Fluency changes require comparable tasks and more than one observation. Pronunciation scoring is not part of v3 without separate validated evaluation.

Two timescales:
- This conversation: begin from a comfortable estimate, increase assistance immediately on genuine difficulty, occasionally try one small extension after several relevant successful turns. Initial evidence-window sizes are tunable heuristics, not scientifically validated thresholds. The learner can override with easier/harder/slow/no teaching.
- Across conversations: save a conservative capability hypothesis only when memory is enabled, distinguish domains and assisted versus independent evidence, and require repeated later evidence for durable growth. Fatigue or a new domain changes current support without erasing prior capability.

Progression is not a compulsory ladder. Available moves include keyword -> add a predicate -> add time/object -> connect one reason -> retell a small event -> spontaneous back-and-forth. Change one dimension at a time; reduce scaffolding before adding unfamiliar grammar, longer listening and faster speech together. Do not automatically speed up audio when content grows.

Teaching moves: acknowledge intended meaning; expand naturally; give a partial phrase when needed; model one optional short answer; invite rather than demand a retry; re-use the expression later in a different natural context. Preserve the learner's intended opinion and details. Never infer personal preferences from imitation, sample answers or hypothetical roleplay.

## 5. Conversation behavior and Japanese questions

Chat is not an interview or a fixed exercise sequence. Answer learner questions before asking a new question; allow a natural reaction without an obligatory follow-up. Clarify uncertain recognition with one small confirmation instead of inventing a topic. Acknowledgement should reference the actual meaning when possible rather than repeatedly saying a generic reassurance. No forced praise, grade or countdown.

Help requests may ask for meaning, wording, grammar difference, pronunciation replay or simplification. Resolve the target from the current dialogue; if ambiguous, ask which expression. Explain in brief Chinese when that is lower burden, give one natural Japanese example, then return to the unfinished topic only when appropriate. Do not treat all Chinese as a mandatory Japanese repetition command. The learner may simply be conversing in mixed language or requesting an explanation.

Illustrative design, not a guaranteed learning outcome:
Companion: 寝る前は、何を見ますか。
Learner: 猫。
Companion: 猫の動画？
Learner: はい。
Companion: 「猫の動画を見ます」ですね。
Visible optional cue: 寝る前に、…
Learner: 寝る前に、猫の動画を見ます。
Companion: つい長く見ちゃいますか。
Learner: つい是什么意思？
Companion: 「つい」是“不知不觉就”。「つい長く見ちゃう」就是“一不留神看了很久”。
Later, optionally reuse つい… in a different context. A supported sentence in this session is not proof of independent mastery.

## 6. Topic system: interesting openings, not endless random questions

Conversation can start without NHK. A mobile primary entry starts from an available easy hook; no mandatory topic/level/role setup. A small shuffle control lets the learner reject the hook, and spoken/text interest immediately takes priority. NHK remains an optional import/library entry.

Providers:
- News: retrieved source, publisher, publication/retrieval date, supported fact snippets and expiry. No unverified generated story labelled as real news. When source unavailable/stale, offer a non-news topic rather than invent an update.
- Interests: learner-confirmed preferences or tentative suggestions, with concrete choices, surprising contrasts, imagination or small stories.
- Knowledge: distinguish sourced claims, unsettled questions and fiction. Do not use viral myths as established facts.
- Work: language practice around progress, requests, explanations, meetings, debugging and collaboration. Do not fetch employer files, inbox, code or customer data without authorization; synthetic examples are sufficient.
- Personal daily life: invite an experience without assuming private facts.

A TopicSeed includes sourceType, hook, simple opening, optional concrete context, possible conversational direction, suitable support range, provenance and expiry when factual. Do not manufacture a scripted multi-turn dialogue. The next turn follows the learner, not the seed.

Prepare a bounded batch ahead of need, cache short sourced summaries, diversify topic/action/setting and penalize recent semantic repetition. Shuffle changes angle, not just wording. Do not automatically switch while the learner is engaged. Randomization is a cold-start aid, not the main conversational engine. News retrieval and topic generation are paid and rate-limited; share/cache where allowed rather than invoke search at every utterance.

## 7. Memory, privacy and operations

Keep session context in memory for continuity. Optional learning memory is distinct from existing default-OFF diagnostic experience records. Explain and ask before enabling persistent learning memory. Default storage proposal: local, inspectable, editable/deletable summary of demonstrated capabilities, confirmed interests and user-approved reusable expressions. No raw audio, full transcripts, employer secrets or inferred sensitive traits; no silent conversion of existing observations into a learner profile. Without memory the current session still adapts.

Any later cloud sync requires user identity, authorization and separate consent. Existing anonymous JWT/origin/quota defenses are insufficient for public personalized memory; do not expose shared profiles. Keep old article schemas and keys unchanged; use new namespaced storage and non-destructive migration only when needed. Provider processing/retention must be described separately from app non-storage.

Diagnostics default to content-free event metadata. Add an optional '刚才没接上' report: it marks the turn locally and lets the user review and choose whether to share a bounded text excerpt; no automatic recording upload. Both semantic issues and fallback/network failures must be visible in QA, not disguised as fluent conversation.

## 8. Release gates: quality before deployment

Test suite outcomes must separate transport, dialogue relevance, tutoring usefulness, adaptation and physical-phone feedback. A successful API request, nonzero RMS, keyword match, JSON validity or green CI does not establish product quality.

For each dialogue scenario, review whether the reply answers the latest intent, preserves corrected meaning, offers appropriate assistance and avoids invented personal/news facts. Use multi-turn branching inputs, fragments, natural pauses, questions, corrections and changing support needs. Multiple runs expose variability; do not cherry-pick a single pass. Critical regressions (mute leakage, lost/duplicated turns, cross-session data, fabricated news attribution) block release. Semantic acceptance rubrics require separate reviewer judgment, with clear failing examples; model grading is a secondary signal.

Representative scenarios (not executed by this design commit):
1. A fragment answers the current question; no unsolicited new subject.
2. Learner corrects 'dog' to 'cat'; next reply reflects the correction.
3. Learner asks the meaning of the word just spoken; answer before resuming.
4. Chinese statement of intended meaning is preserved without invented details.
5. Strong comprehension but weak production gets output support, not childish speech.
6. Assisted short sentence is not recorded as independently mastered.
7. Several independent relevant answers invite one small extension, not a sudden level jump.
8. Repeated difficulty increases support without leaving the topic.
9. Direct request for harder/easier overrides automatic policy.
10. A genuine yes/no does not trigger needless sentence expansion.
11. Closed microphone stays closed through help, topic switch and renewal.
12. Late microphone permission after exit is stopped.
13. Interrupted assistant output is not treated as already heard.
14. Two speech fragments and out-of-order transcription do not lose/reorder meaning.
15. Renewal preserves the pending question and does not duplicate a response.
16. Source lookup failure never becomes fabricated latest news.
17. Topic suggestions change semantic angle and do not interrupt engagement.
18. Slow/failed observer or optional hints do not block a native voice reply.
19. Learning memory OFF persists no profile, transcript or audio.
20. Deleting optional new memory never alters NHK articles or favorites.

Baseline and candidate should be compared using the same difficult dialogue cases. Real synthetic audio is useful for deterministic transport checks, not proof of natural hesitation/accent quality. Physical-phone use and user feedback must remain an explicit acceptance stage, ideally on a few varied topics; no claim of guaranteed growth by the second round or quantified learning efficacy.

## 9. Implementation order and rollback

A. Isolated conversation core and semantic regression fixtures: native stateful voice, reliable turn identity/correction/help, explicit mute and actual indicators. Expose a test entry without replacing the current production route. Verify continuity before adaptation.
B. Adaptive teaching: evidence model, graduated support, small within-session extensions, intent-aware Japanese explanations and optional learning memory. Assess scaffolding independence, not transcript polish.
C. Topic independence and source adapters: interests/work/knowledge and verified news, interesting hooks and semantic non-repetition. Preserve NHK library and all legacy routes.
D. Mobile preview and whole-path evaluation, then controlled promotion. Keep a reversible feature flag; do not automatically deploy design documents as a completed product.

Do not build several talking agents, a full curriculum/game/scoring system or a long placement test. Do not claim a fixed launch date before testing the new conversation core. Price optimization follows a working semantic baseline; bound observer/search calls and measure actual costs.

## References checked for this design (2026-09-09)

Official API capabilities, not proof of this app's behavior:
- https://developers.openai.com/api/docs/guides/voice-agents — native speech sessions versus chained workflow tradeoffs.
- https://developers.openai.com/api/docs/guides/realtime-conversations — stateful conversation, default versus detached responses and audio handling.
- https://developers.openai.com/api/docs/guides/realtime-server-controls — sideband monitoring and configuration/tool control.
- https://developers.openai.com/api/docs/guides/realtime-vad — adjustable turn detection, not perfect pause interpretation.
- https://developers.openai.com/api/docs/guides/tools-web-search — retrieval with sources for verified news tools.

Pedagogical inspiration, not direct efficacy evidence for a Japanese voice chatbot:
- Poehner & Lantolf (2013), Bringing the ZPD into the equation, doi:10.1177/1362168813482935. The reported study concerns computerized L2 listening/reading assessment and distinguishes unmediated and mediated performance; this design adapts that distinction, not its scores or an unproven universal growth rate.
