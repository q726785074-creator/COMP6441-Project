# PhishWise progression and reflection log

This log separates verifiable project changes from personal reflection. The factual entries below describe files and behaviour in the repository. Bracketed reflection prompts must be completed by the student in their own words; they are not evidence of participant testing.

## Progression record

| Stage | Project state | Problem identified | Change made | Evidence to check |
|---|---|---|---|---|
| Version 1 | Basic five-question phishing activity | Coverage was too narrow for the chosen learning objectives | Expanded the assessment and lesson plan | Ten mapped topics in content.js |
| Version 2 | Ten-item pre/post tests and bilingual learning content | A quiz alone gave limited applied practice | Added three email investigations and seven defence decisions | Scenario and defence content in content.js |
| Version 3 | Complete formal activity and presentation workflow | Classroom demonstration required unrestricted navigation without changing formal results | Added isolated Demo Mode and temporary labelled data | Demo state handling in script.js |
| Version 4 | Content-depth review | General advice did not fully explain assets, attack paths, failure modes, residual risk, trade-offs, or evidence limits | Added security-engineering risk cases, control limits, first-attempt measurement, fixed formal sequence, and participant-test documents | Current website and Markdown documents |

## Problems and responses

### Measuring learning while giving feedback

Problem: inspection clicks and defence answers originally remained changeable after feedback, so a final score could include the answer revealed by the teaching activity.

Response: the current version stores the first scenario completion and first defence choice separately. Later interaction remains available as practice and does not overwrite formal evidence.

Student reflection: [Explain how this changed your understanding of assessment validity.]

### Avoiding a one-clue model of phishing

Problem: a highlighted clue could appear to teach that one sign proves an email is malicious. Legitimate messages can be urgent or use an external supplier, while a compromised official account can use the correct domain.

Response: each clue now includes a limitation. The learning section connects combined evidence with trust boundaries, control failure, residual risk, and operational trade-offs.

Student reflection: [Give one example of an assumption you changed and why.]

### Separating presentation data from participant evidence

Problem: sample presentation scores could be mistaken for real test results.

Response: Demo Mode uses a temporary state, labels its values as hypothetical demonstration data, blocks formal summary download, and restores previous formal progress when exited.

Student reflection: [Describe how you checked this separation and why it matters ethically.]

### Maintaining two languages

Problem: dynamic content and newly added evaluation explanations increase the chance that one language becomes incomplete or differs in meaning.

Response: content objects hold paired English and Chinese text, while static interface strings use the translation map. Functional testing must still inspect both versions because wording can have different difficulty.

Student reflection: [Describe a translation or wording decision that was difficult.]

## Required personal reflection before submission

Complete these in your own words after development and real participant testing:

- What security-engineering idea did you misunderstand at the beginning, and what concrete evidence changed your view?
- Which design decision involved the most important trade-off?
- Which implementation or content problem took the most effort to resolve?
- What did participant evidence confirm, contradict, or leave uncertain?
- What would you change in another iteration, and why?
- How did AI assistance contribute to drafting or code changes, and what did you personally verify, reject, or revise?

Do not claim participant improvement, feedback, or personal learning until it has actually occurred and can be supported.
