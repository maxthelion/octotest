I’m trying to think about testing an application. Is the prevailing wisdom that integration testing is better , but it’s more expensive to create and to run? Unit testing has a useful role and ends up being more prevalent08:27The "prevailing wisdom" here is actually a bit contested — it's worth unpacking the landscape properly.
The classic view: the Test Pyramid
Martin Fowler/Mike Cohn's test pyramid says: lots of unit tests at the base, fewer integration tests in the middle, even fewer E2E tests at the top. The rationale is exactly what you described — unit tests are cheap to write and fast to run, so you want them to dominate.
The counter-movement: the Test Trophy / "Write tests, not too many, mostly integration"
Kent C. Dodds popularised the "Testing Trophy" shape, which inverts the emphasis. The argument is that unit tests can give you false confidence — they test your code in isolation, but your code doesn't run in isolation. Integration tests catch the bugs that actually matter: mismatched contracts between modules, ORM queries that don't behave as expected, middleware that mutates state unexpectedly.
The "ice cream cone" anti-pattern
This is the failure mode: mostly manual testing at the top, a fat layer of E2E tests, almost no unit or integration tests. Slow, fragile, expensive to maintain.
Where the nuance actually lives
The cost trade-off you described is real but context-dependent:

Unit tests are cheaper per-test but can be more numerous and can test the wrong things — they often end up testing implementation details, so they break on refactors even when behaviour is correct.
Integration tests cost more upfront (test setup, fixtures, managing side effects) but tend to test behaviour, which is more stable than implementation.
E2E tests are expensive to write, slow to run, and flaky — most teams now advocate keeping these to a small set of "happy path" smoke tests.

What the actual prevailing wisdom seems to be right now
There's broad consensus that the pyramid framing is still structurally useful — you don't want a top-heavy suite — but the emphasis has shifted toward integration tests being higher value per test. The trend is:

Fewer, meaningful unit tests (pure functions, complex algorithms, well-isolated logic)
A solid middle layer of integration tests that test real behaviour through real interfaces
Minimal E2E tests as a safety net, not a primary strategy

The cost of running integration tests has also come down significantly with containerisation (Testcontainers etc.), which weakens the traditional argument for unit test dominance.
What's your application context — are you thinking about this for the city gen system or Octowiki, or something else?I’m thinking about it more broadly in the context of agents being able to reduce the costs of integration tests08:30That's a really interesting angle. The traditional cost arguments against integration tests were always about human time — the setup, fixture management, teardown, and maintenance burden. Agents potentially attack several of those directly.
Where agents could reduce integration test costs
Test fixture and environment setup is probably the biggest win. Writing realistic, consistent test data and spinning up the right dependencies is tedious for humans but well-suited to agents — they can generate fixtures from schemas, inspect real data shapes, and maintain them as the system evolves.
Test authoring from behaviour descriptions — if your documentation or specs are the source of truth (very relevant for Octowiki's model), an agent could derive integration tests directly from them. The spec is the test generator.
Maintenance burden is where integration tests historically rot. When contracts change, tests break in non-obvious ways. An agent that understands the codebase could triage failures — distinguishing "this is a real regression" from "this fixture is stale" — and propose or apply fixes.
Exploratory test generation — agents could probe integration boundaries more systematically than humans do, finding edge cases in how components interact that nobody thought to write a test for.
The more interesting implication
If agents substantially reduce integration test costs, it doesn't just make the existing pyramid cheaper — it potentially reshapes the optimal strategy. The pyramid was partly a cost-driven heuristic. If the cost differential narrows, you'd rationally shift weight toward integration tests, since their signal quality is higher.
You could end up with a model where unit tests are reserved for genuinely complex isolated logic, and integration tests become the default — with agents maintaining the suite continuously rather than it being a discrete authoring task.
The remaining hard part
The cost that agents don't obviously solve is test oracle quality — knowing what the correct behaviour actually is. Agents can generate tests, but if the expected outputs are wrong or underspecified, you get a fast, cheap suite that gives false confidence. That's arguably worse than no tests. The source-of-truth problem is the residual hard part.
Which connects back to Octowiki's core premise — if documentation is the authoritative spec, you have a candidate oracle. That's a more interesting foundation for agent-generated integration tests than most codebases have.What about other types of expensive testing like matrix testing or fuzz testing? Should they be more prevalent if easy to achieve?08:34Yes, and the logic is the same as with integration tests — these techniques were historically rate-limited by cost, not by their value. If agents remove the cost barrier, the rational response is to use them more.
Matrix testing
The expense was always combinatorial explosion — you can't manually cover every combination of OS, runtime version, config flag, input shape, and dependency version. So teams made pragmatic cuts: test a representative subset, maybe a few key diagonals.
Agents change this in a couple of ways. They can intelligently generate the matrix rather than requiring humans to specify it exhaustively. More importantly, they can triage failures — a 500-cell matrix that fails in 40 cells is currently a nightmare to debug, but an agent that can cluster failures, identify the causally relevant variables, and produce a minimal reproduction is a different proposition entirely. The bottleneck shifts from "running the matrix" to "understanding what the failures mean," and agents help with the second part too.
Fuzz testing
Fuzz testing is interesting because it's already somewhat automated at the execution layer — tools like libFuzzer or AFL will generate inputs without human effort. The traditional costs were: setting up the harness, defining meaningful corpus seeds, and most critically, interpreting results. A fuzzer that finds a crash gives you a raw input, not an explanation.
Agents could help at both ends — writing the harness and corpus from a description of the interface, and triaging outputs to distinguish security-relevant crashes from benign edge cases. The technique has been under-used outside security-focused teams largely because of that setup and interpretation cost.
The deeper pattern
There's a common structure across all of these:

Technique has high signal value but high human attention cost
Automation handles execution but leaves a residue of human judgment tasks (setup, maintenance, triage, interpretation)
Agents are specifically good at that residue

So the question isn't just "should these be more prevalent" — it's that the entire category of "expensive but high-signal" testing becomes more accessible. Property-based testing, mutation testing, chaos/fault injection — all follow the same logic. They were viable only for well-resourced teams willing to invest in the tooling and the cognitive overhead. That constraint loosens significantly.
The strategic implication
If all of this becomes cheap, the limiting factor on test quality shifts from technique availability to having a good model of what correct behaviour looks like. Which keeps coming back to the oracle problem — and to the value of having well-specified, authoritative documentation as a foundation.Explain the oracle problem08:37The oracle problem is the question: how do you know what the correct output is?
A test has two parts — running the code under test, and asserting something about the result. The oracle is the thing that tells you what to assert. It sounds trivial but it's actually the fundamental hard problem in testing.
Why it's easy to miss
For simple cases, the oracle is obvious. If you're testing a sort function, you know what a sorted list looks like. If you're testing addition, you know 2+2=4. So in introductory testing, the oracle problem doesn't appear — you just write the expected value.
It becomes non-trivial when:

The correct output is complex, context-dependent, or probabilistic
The system's job is to make a judgment rather than compute a deterministic answer
The expected behaviour isn't fully specified anywhere
The output space is too large to enumerate

Concrete forms it takes
The implicit oracle — most tests use the developer's mental model as the oracle. They write what they think the output should be. But if their mental model is wrong, the test enshrines the bug. This is especially insidious because the test passes confidently.
The differential oracle — compare output against a reference implementation or a previous version. Useful for catching regressions but doesn't tell you if the original was correct.
The metamorphic oracle — instead of specifying exact outputs, specify relationships that must hold. If you rotate an image 360 degrees you should get the original back. If you search for a subset of a query's terms you should get at least as many results. You're testing properties rather than values. This sidesteps needing to know the exact answer.
The no-oracle problem — some domains genuinely have no ground truth accessible during testing. ML models, complex simulations, generative systems. You can't write assert output == correct_answer because you don't have correct_answer.
Why it matters for agents
Agents can generate tests fluently, but they inherit whatever oracle problem the domain has. An agent writing integration tests for a well-specified CRUD API has a reasonable oracle — the spec says what the response should be. An agent writing tests for something like city gen — where the "correct" output of a settlement placement algorithm is partly aesthetic and emergent — has almost no oracle to work from.
This is why documentation-as-source-of-truth is load-bearing for the approach. A spec that says what the system should do at a behavioural level is a candidate oracle. Without it, agents generate tests that assert the current behaviour, which means they detect changes but not incorrectness — you get regression coverage, not correctness coverage.
The residual hard problem
Even with good specs, there's a gap between "the spec says X" and "this output satisfies X." For anything beyond simple values — structured outputs, emergent behaviour, quality judgments — closing that gap still requires either human judgment or a model sophisticated enough to evaluate outputs against intent. That evaluation model is itself untested, so you've just pushed the oracle problem up a level.
It doesn't go away. It just moves to wherever your specification ends.What about diagnostic testing where more granular tests only run if a low granularity integration test fails? Is that a thing? Also, what about screenshot service running against a web app and comparing diffs of bitmaps with previous runs? Only investigating if different? Or how about an agentic red team writing tests that they think will fail?08:56These are all real patterns, though they vary in how established they are.
Diagnostic / hierarchical testing
This exists but is underused and doesn't have a single canonical name. The closest established concepts are:
Test quarantining and drill-down — CI pipelines that gate on a fast smoke suite before running the full suite. If smoke fails, you don't bother with the rest. But that's coarse.
Shrinking in property-based testing (QuickCheck, Hypothesis) is the closest intellectual relative — when a fuzz/property test fails, the framework automatically tries to find the minimal input that still triggers the failure. That's diagnostic narrowing happening automatically.
What you're describing — integration test fails, triggering a targeted sub-suite to localise the fault — is a sound idea that's mostly done manually today. A developer sees a failing integration test and then runs unit tests to find the cause. Automating that cascade is underexplored. Agents make it more tractable because the "which sub-tests are relevant to this failure" question is a reasoning task, not just a mechanical one.
The value is real: you get the signal quality of integration tests with a path to the diagnostic precision of unit tests, without paying for the unit tests on every run.
Screenshot / visual diffing
This is very much a thing — Percy, Chromatic, Applitools, BackstopJS are all production tools doing exactly this. The pattern is well established in frontend development.
The oracle problem here is interesting though. Pixel-diff against a previous screenshot isn't testing correctness, it's testing stability. You're using the past as the oracle, which is a differential oracle. It catches unintended changes well, but it also flags intended changes as failures, which creates noise and reviewer fatigue — the "just approve the diff" habit that erodes the signal over time.
Applitools went further by using ML to distinguish meaningful visual changes from noise (antialiasing differences, minor layout shifts) which helps. But the deeper issue remains — if the previous screenshot was wrong, you're enshrining the wrong state.
The agentic extension here is compelling: rather than a human looking at a diff and deciding "is this intentional," an agent could assess whether the change is consistent with recent commits, whether it affects user-facing flows, whether it looks like a regression or a feature. That turns visual diffing from a noise-generating comparison tool into something with genuine triage intelligence.
Agentic red-teaming
This is actively being developed and is probably the most forward-looking of the three. The idea of an agent that tries to break the system — writing tests it expects to fail, probing edge cases, looking for contradictions between components — is a natural extension of adversarial testing.
A few things make this interesting:
An agent red-teaming a system with access to the codebase and specs can form hypotheses about where the seams are weak. It's not random fuzzing — it's directed adversarial reasoning. "This module assumes the input is normalised but I don't see where that normalisation is guaranteed upstream — let me write a test that violates that assumption."
The oracle problem is partially inverted here — the agent is specifically trying to find cases where the system does produce output, but the output is wrong or inconsistent. It's looking for contradictions rather than asserting correct values. That's a more tractable oracle problem in some ways.
The risk is that a red-teaming agent without good judgment about what matters generates a lot of adversarial tests that are technically failures but not meaningful ones. Quality of the attack surface model matters a lot.
The unifying thread
What connects all three of these is that they're moving testing from static assertion toward dynamic investigation. Rather than a human pre-specifying every expectation, the system runs, something flags as potentially wrong, and then reasoning kicks in to decide whether it matters and where to look. Agents are well-suited to that middle reasoning layer across all three patterns. The common shape is: cheap broad signal → intelligent triage → targeted deep investigation. That's a testing architecture that makes a lot of sense if the triage layer is capable enough.