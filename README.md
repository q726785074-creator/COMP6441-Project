# PhishWise

PhishWise is a bilingual, local-only phishing awareness activity for university students aged 18 or over who have little or no formal cybersecurity education. It teaches learners to inspect evidence, understand how phishing exploits trust, and choose safe responses after different levels of exposure.

## Requirements

- A current desktop browser such as Chrome, Edge, or Firefox
- No installation, account, external API, or internet connection

## Run the website

Open index.html in a modern browser. The website files are stored together in this folder and do not require a build process. If a browser applies restrictions to directly opened local files, the folder may instead be served with any ordinary local static web server.

## Website source boundary

The complete executable project source consists only of these five website files:

- index.html provides the page structure
- styles.css provides presentation and responsive layout
- script.js provides navigation, scoring, storage, reset, and Demo Mode behaviour
- content.js contains the bilingual questions, lessons, scenarios, and explanations
- i18n.js contains the bilingual interface text

No Markdown, Word, PDF, or PowerPoint file contains project source code or an executable script. Those files are supporting documentation only.

## Formal learning flow

Complete the sections in this order: Start, Pre-test, Learn, Inspect, Defend, Post-test, Results, and Feedback.

The pre-test and post-test each contain ten questions. The inspection activity contains three fictional emails, and the defence activity contains seven response decisions. Formal progress is stored only in the browser session. Reset and clear controls remove local results.

## Demonstration mode

Demo Mode is available in the top-right corner for a classroom presentation. It unlocks every section and can create clearly labelled temporary example scores. Demo values are separate from formal progress, are not participant evidence, and are cleared when the page is refreshed or Demo Mode is exited.

## Reproduce the functional checks

1. Open the website and confirm that formal navigation is initially sequential.
2. Attempt to submit each test with an unanswered question and confirm that a completion prompt appears.
3. Complete the ten-question pre-test, the learning section, all three inspection scenarios, all seven defence decisions, and the ten-question post-test.
4. Confirm that Results shows the two test scores, score change, scenario scores, defence score, topic review, and local-clear control.
5. Switch between English and Chinese on every section.
6. Enter Demo Mode, navigate freely, generate temporary demo values, exit, and confirm that formal results remain unchanged.
7. Reset the activity and confirm that answers, scores, and progress are cleared.
8. Open the browser developer console and confirm there are no errors or external network requests.

See TESTING-CHECKLIST.md for the latest functional review. Functional checks show that the software runs; they do not prove teaching effectiveness.

## Participant evaluation

Real participant testing is still required. Use testing-plan.md before recruitment, participant-feedback-template.md during the study, and test-results-template.md for anonymous results. Keep one activity version fixed during a test round. Do not copy Demo Mode scores into participant evidence.

## Submission files

- index.html, styles.css, script.js, content.js, and i18n.js: complete local website
- Final Report_z5607056.docx and Final Report_z5607056.pdf: final report in editable and fixed-layout formats
- Project_z5607056.pptx: final presentation deck
- testing-plan.md: participant protocol
- participant-feedback-template.md: anonymous feedback questions
- test-results-template.md: blank result tables
- reflection-log.md: project progression and student reflection prompts
- TESTING-CHECKLIST.md: functional test record
- AI-ACKNOWLEDGEMENT.md: disclosure of AI assistance and student responsibility

## Ethics and privacy

All organisations, domains, messages, links, login pages, and attachments are fictional and inert. The activity does not connect to email, open external links, execute attachments, request credentials, collect direct identifiers, use analytics, or send data outside the browser. Participants should be informed of the educational purpose, told not to enter personal information, and allowed to stop at any time.

The immediate post-test measures short-term performance. It does not establish long-term retention or real-world behaviour.
