import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  collectionsTable,
  collectionMembersTable,
  notesTable,
  noteTagsTable,
  noteRevisionMetadataTable,
  activityEventsTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";

const SEED_USERS = [
  {
    id: "seed-user-alice",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Chen",
    profileImageUrl: null,
    role: "admin",
    password: "password123",
  },
  {
    id: "seed-user-bob",
    email: "bob@example.com",
    firstName: "Bob",
    lastName: "Martinez",
    profileImageUrl: null,
    role: "user",
    password: "password123",
  },
  {
    id: "seed-user-carol",
    email: "carol@example.com",
    firstName: "Carol",
    lastName: "Nguyen",
    profileImageUrl: null,
    role: "user",
    password: "password123",
  },
];

interface CollectionSeed {
  name: string;
  description: string;
  ownerIdx: number;
  visibility: string;
  sharedWith?: { userIdx: number; role: string }[];
}

const SEED_COLLECTIONS: CollectionSeed[] = [
  {
    name: "Engineering Handbook",
    description: "Architecture decisions, coding standards, and onboarding guides",
    ownerIdx: 0,
    visibility: "shared",
    sharedWith: [
      { userIdx: 1, role: "editor" },
      { userIdx: 2, role: "viewer" },
    ],
  },
  {
    name: "Product Roadmap Q2",
    description: "Feature planning, user research findings, and sprint goals",
    ownerIdx: 0,
    visibility: "shared",
    sharedWith: [{ userIdx: 1, role: "editor" }],
  },
  {
    name: "Bob's Personal Notes",
    description: "Quick thoughts, reading lists, and daily reflections",
    ownerIdx: 1,
    visibility: "private",
  },
  {
    name: "Design System",
    description: "Component documentation, style guides, and design tokens",
    ownerIdx: 2,
    visibility: "shared",
    sharedWith: [
      { userIdx: 0, role: "editor" },
      { userIdx: 1, role: "viewer" },
    ],
  },
  {
    name: "Research Library",
    description: "Academic papers, book notes, and article summaries",
    ownerIdx: 2,
    visibility: "shared",
    sharedWith: [{ userIdx: 0, role: "viewer" }],
  },
  {
    name: "Team Retrospectives",
    description: "Sprint retros, action items, and process improvements",
    ownerIdx: 0,
    visibility: "shared",
    sharedWith: [
      { userIdx: 1, role: "editor" },
      { userIdx: 2, role: "editor" },
    ],
  },
];

interface NoteSeed {
  title: string;
  body: string;
  collectionIdx: number;
  authorIdx: number;
  tags: string[];
  archived?: boolean;
}

const SEED_NOTES: NoteSeed[] = [
  { title: "API Design Guidelines", body: "All public APIs should follow RESTful conventions. Use plural nouns for resource collections (e.g., /users, /notes). Always version your APIs using URL path prefixes (/v1/, /v2/). Return consistent error shapes with { error: string, code: string } format.\n\nHTTP Methods:\n- GET for reads (idempotent)\n- POST for creates\n- PATCH for partial updates\n- PUT for full replacements\n- DELETE for removals\n\nPagination should use cursor-based pagination for large datasets. Include Link headers for discoverability.", collectionIdx: 0, authorIdx: 0, tags: ["api", "standards"] },
  { title: "Database Migration Checklist", body: "Before running any migration in production:\n\n1. Test migration on a copy of production data\n2. Ensure migration is reversible (write both up and down)\n3. Check for table locks that could cause downtime\n4. Verify indexes are created concurrently when possible\n5. Run EXPLAIN ANALYZE on affected queries post-migration\n6. Update the schema documentation\n7. Notify the on-call team before deploying\n\nNever alter column types without a multi-step migration plan.", collectionIdx: 0, authorIdx: 0, tags: ["database", "ops"] },
  { title: "Onboarding Guide: Week 1", body: "Welcome to the team! Here is your first week plan:\n\nDay 1: Set up development environment, get access to GitHub, Slack, and the staging server. Read the architecture overview document.\n\nDay 2: Pair with your buddy on a small bug fix. Get familiar with the PR review process.\n\nDay 3: Attend the team standup. Start working on your onboarding project.\n\nDay 4-5: Continue onboarding project. Schedule 1:1s with team leads to understand each domain.\n\nKey contacts: Alice (Engineering Lead), Bob (Backend), Carol (Frontend/Design)", collectionIdx: 0, authorIdx: 0, tags: ["onboarding", "team"] },
  { title: "Error Handling Patterns", body: "We use a layered error handling approach:\n\n1. Domain errors: Custom error classes that extend BaseError\n2. Service layer: Catches domain errors, logs context, rethrows as service errors\n3. Route handlers: Express error middleware converts to HTTP responses\n\nExample:\n```\nclass NotFoundError extends BaseError {\n  constructor(resource: string, id: string) {\n    super(`${resource} ${id} not found`, 404);\n  }\n}\n```\n\nNever expose internal error details to clients. Log full stack traces server-side only.", collectionIdx: 0, authorIdx: 1, tags: ["patterns", "backend"] },
  { title: "Code Review Standards", body: "Every PR should be reviewed within 24 hours. Reviewers should focus on:\n\n- Correctness: Does the code do what it claims?\n- Security: Are there any injection or auth bypass risks?\n- Performance: Any N+1 queries or unnecessary loops?\n- Readability: Could someone new understand this in 6 months?\n- Tests: Are edge cases covered?\n\nKeep comments constructive. Use 'nit:' prefix for style-only feedback. Block PRs only for genuine issues, not preference differences.", collectionIdx: 0, authorIdx: 1, tags: ["standards", "team"] },
  { title: "Caching Strategy", body: "Our caching layers:\n\n1. Browser cache: Static assets with long TTLs, content-hashed filenames\n2. CDN: Page-level caching for public content (5 min TTL)\n3. Application cache: Redis for frequently-read database queries\n4. Database: PostgreSQL query plan cache (automatic)\n\nCache invalidation rules:\n- Write-through for user-specific data\n- TTL-based expiry for aggregate data\n- Event-driven invalidation for shared resources\n\nKnown gap: Collection membership changes don't immediately invalidate cached note lists for other members.", collectionIdx: 0, authorIdx: 0, tags: ["caching", "architecture"] },
  { title: "Monitoring and Alerting Setup", body: "We monitor the following metrics:\n\n- API response times (p50, p95, p99)\n- Error rates by endpoint\n- Database connection pool utilization\n- Memory and CPU usage per service\n- Queue depth for background jobs\n\nAlert thresholds:\n- P95 latency > 500ms for 5 minutes\n- Error rate > 1% for 3 minutes\n- DB connections > 80% for 10 minutes\n\nOn-call rotation: Weekly, starting Monday 9am. Handoff doc required.", collectionIdx: 0, authorIdx: 2, tags: ["ops", "monitoring"] },
  { title: "Feature: Smart Search", body: "User Story: As a user, I want to search across all my notes so that I can quickly find relevant information.\n\nAcceptance Criteria:\n- Search matches title and body content\n- Results are ranked by relevance\n- Search supports filtering by collection and tag\n- Results show a snippet with highlighted match context\n- Search is fast (< 200ms for typical queries)\n\nTechnical approach: Start with PostgreSQL ILIKE for MVP. Plan to add full-text search with tsvector in v2. Consider Elasticsearch for v3 if data volume warrants it.", collectionIdx: 1, authorIdx: 0, tags: ["feature", "search"] },
  { title: "Feature: Real-time Collaboration", body: "Future feature: Allow multiple users to edit a note simultaneously.\n\nResearch notes:\n- WebSocket or SSE for real-time updates\n- Operational transforms (OT) vs. CRDTs for conflict resolution\n- Consider Yjs or Automerge libraries\n- Start with presence indicators (who is viewing) before full co-editing\n\nComplexity: High. Estimated 4-6 sprint effort. Defer to Q3.", collectionIdx: 1, authorIdx: 0, tags: ["feature", "collaboration"] },
  { title: "Sprint 14 Goals", body: "Sprint duration: April 7-20\n\nCommitted:\n1. Dashboard redesign (Alice) - 5 pts\n2. Search improvements (Bob) - 3 pts\n3. Collection sharing flow (Carol) - 5 pts\n4. Bug: Note editor losing focus on mobile (Bob) - 2 pts\n\nStretch:\n5. Activity feed performance optimization - 3 pts\n6. Tag autocomplete - 2 pts\n\nTotal committed: 15 pts (velocity: 16 avg)\n\nRisks: Carol is out Thursday-Friday for a conference.", collectionIdx: 1, authorIdx: 0, tags: ["sprint", "planning"] },
  { title: "User Research: Note Organization", body: "Interviewed 8 users about how they organize notes.\n\nKey findings:\n- 6/8 users create fewer than 5 collections\n- Most users rely on search rather than browsing collections\n- Tags are underutilized; only 2/8 users tag consistently\n- Users want a 'favorites' or 'pinned' concept\n- Mobile users want faster note creation (1-tap from home screen)\n\nRecommendations:\n1. Add a 'Quick Note' button on the dashboard\n2. Consider auto-tagging based on content (deferred - no AI)\n3. Add a 'Starred' section to the sidebar\n4. Improve search discoverability with keyboard shortcuts", collectionIdx: 1, authorIdx: 0, tags: ["research", "ux"] },
  { title: "Competitor Analysis", body: "Reviewed 5 competing note apps:\n\n1. Notion - Powerful but complex. Users feel overwhelmed.\n2. Obsidian - Great for power users. Markdown-first.\n3. Bear - Beautiful design. Limited collaboration.\n4. Roam Research - Excellent linking. Steep learning curve.\n5. Apple Notes - Simple but limited sharing.\n\nOur differentiation:\n- Simplicity of Apple Notes with the collaboration of Notion\n- No lock-in (plain text export)\n- Clean, calm design that does not try to be everything", collectionIdx: 1, authorIdx: 0, tags: ["strategy", "competition"] },
  { title: "Q2 OKR Draft", body: "Objective: Become the go-to tool for small team note collaboration\n\nKR1: Reach 1,000 active users (currently: 340)\nKR2: Average session duration > 8 minutes (currently: 4.2 min)\nKR3: Collection sharing used by 40% of users (currently: 12%)\nKR4: NPS score > 50 (currently: 38)\n\nKey initiatives:\n- Redesign onboarding to showcase collaboration\n- Add email notifications for shared collection updates\n- Improve mobile experience\n- Launch public templates gallery", collectionIdx: 1, authorIdx: 0, tags: ["okr", "strategy"] },
  { title: "Reading: Deep Work by Cal Newport", body: "Core argument: The ability to perform deep work is becoming increasingly rare and increasingly valuable.\n\nKey strategies:\n1. Schedule deep work in advance (time blocking)\n2. Create rituals and routines to minimize decision fatigue\n3. Quit social media or severely restrict it\n4. Drain the shallows - reduce shallow work obligations\n\nPersonal takeaway: I have been scheduling 2-hour deep work blocks each morning. The first week was hard but by week 3 I noticed a significant difference in my output quality.", collectionIdx: 2, authorIdx: 1, tags: ["books", "productivity"] },
  { title: "Cooking: Thai Green Curry", body: "Ingredients:\n- 2 tbsp green curry paste\n- 1 can coconut milk (400ml)\n- 500g chicken thigh, sliced\n- 1 cup Thai basil\n- 2 kaffir lime leaves\n- 1 tbsp fish sauce\n- 1 tsp palm sugar\n- Bamboo shoots, Thai eggplant\n\nMethod:\n1. Fry curry paste in coconut cream (thick part) until fragrant\n2. Add chicken, cook 5 minutes\n3. Add remaining coconut milk, lime leaves, fish sauce, sugar\n4. Simmer 15 minutes\n5. Add basil, serve with jasmine rice\n\nNotes: Fresh curry paste is much better than jarred. The Thai grocery on 5th street has it.", collectionIdx: 2, authorIdx: 1, tags: ["recipe", "cooking"] },
  { title: "Guitar Practice Log", body: "Week of March 31:\n\nMonday: Practiced chord transitions (G-C-D) for 20 min. Getting smoother.\nTuesday: Learned intro to Blackbird. Fingerpicking is challenging.\nWednesday: Skipped (late meeting)\nThursday: 30 min scales practice. Tried pentatonic in A minor.\nFriday: Worked on strumming patterns. Down-up-down-up-down with muted strum.\n\nGoal for next week: Play through Blackbird at 60% tempo without stopping.", collectionIdx: 2, authorIdx: 1, tags: ["hobbies", "music"] },
  { title: "Home Improvement Ideas", body: "Projects ranked by priority:\n\n1. Fix the leaky kitchen faucet (this weekend)\n2. Paint the bedroom accent wall - thinking sage green\n3. Build floating shelves for the office\n4. Replace the bathroom light fixture\n5. Organize the garage (summer project)\n\nBudget notes: Shelves materials ~$80, paint ~$45, light fixture ~$120\n\nNeed to research: Do I need a permit for the bathroom electrical work?", collectionIdx: 2, authorIdx: 1, tags: ["personal", "home"] },
  { title: "Daily Gratitude - Week 14", body: "Monday: Grateful for the quiet morning coffee before everyone woke up.\nTuesday: The team demo went really well. Everyone was supportive.\nWednesday: Found a shortcut through the park for my commute. Beautiful path.\nThursday: Had a great debugging session with Carol. We solved a nasty race condition.\nFriday: Pizza night with the family. Simple pleasures.\n\nReflection: This week felt more balanced than last week. The morning routine is making a difference.", collectionIdx: 2, authorIdx: 1, tags: ["personal", "reflection"] },
  { title: "Trip Planning: Portland", body: "Dates: May 15-18 (long weekend)\n\nMust visit:\n- Powell's City of Books\n- Japanese Garden\n- Food carts on Hawthorne\n- Multnomah Falls (day trip)\n\nRestaurants to try:\n- Pok Pok (Thai)\n- Screen Door (brunch)\n- Salt & Straw (ice cream)\n\nAccommodation: Looking at Airbnb in the Pearl District or hotel near downtown.\nBudget: ~$800 total (flights are $220 round trip if booked this week)", collectionIdx: 2, authorIdx: 1, tags: ["travel", "planning"] },
  { title: "Component Library: Button", body: "Button component specification:\n\nVariants: primary, secondary, outline, ghost, destructive\nSizes: sm (h-8 px-3), md (h-10 px-4), lg (h-12 px-6)\nStates: default, hover, active, disabled, loading\n\nDesign tokens:\n- Border radius: var(--radius)\n- Font weight: 500\n- Transition: all 150ms ease\n\nAccessibility:\n- Must have visible focus ring\n- Loading state should use aria-busy\n- Disabled buttons should not be focusable\n\nImplementation note: Use class-variance-authority for variant management.", collectionIdx: 3, authorIdx: 2, tags: ["components", "button"] },
  { title: "Component Library: Card", body: "Card component specification:\n\nStructure: Card > CardHeader > CardTitle + CardDescription, CardContent, CardFooter\n\nDesign decisions:\n- Default border: 1px solid var(--border)\n- Background: var(--card)\n- Padding: 24px (adjustable via prop)\n- Border radius: var(--radius)\n- No shadow by default (add via className)\n\nVariations:\n- Interactive card: hover state with subtle elevation\n- Compact card: reduced padding for list views\n- Highlighted card: colored left border for status indication", collectionIdx: 3, authorIdx: 2, tags: ["components", "card"] },
  { title: "Color System", body: "Our color system uses HSL values with CSS custom properties.\n\nPrimary palette:\n- Primary: hsl(25, 55%, 48%) — warm terracotta\n- Primary foreground: hsl(0, 0%, 100%)\n\nNeutral palette:\n- Background: hsl(30, 25%, 97%)\n- Foreground: hsl(25, 15%, 15%)\n- Muted: hsl(30, 15%, 93%)\n- Muted foreground: hsl(25, 10%, 45%)\n\nSemantic colors:\n- Destructive: hsl(0, 65%, 50%)\n- Success: hsl(142, 70%, 40%)\n- Warning: hsl(38, 90%, 50%)\n\nAll colors must meet WCAG AA contrast ratios (4.5:1 for normal text).", collectionIdx: 3, authorIdx: 2, tags: ["design-tokens", "color"] },
  { title: "Typography Scale", body: "Base font size: 16px (1rem)\nLine height: 1.5 for body, 1.2 for headings\n\nScale (using a 1.25 ratio):\n- xs: 0.75rem (12px)\n- sm: 0.875rem (14px)\n- base: 1rem (16px)\n- lg: 1.125rem (18px)\n- xl: 1.25rem (20px)\n- 2xl: 1.5rem (24px)\n- 3xl: 1.875rem (30px)\n- 4xl: 2.25rem (36px)\n\nFont families:\n- Headings: serif (Georgia, Cambria, serif)\n- Body: system-ui, sans-serif\n- Code: monospace\n\nAccessibility: Never go below 12px. Ensure text resizing works up to 200%.", collectionIdx: 3, authorIdx: 2, tags: ["design-tokens", "typography"] },
  { title: "Spacing and Layout Grid", body: "Spacing scale (based on 4px grid):\n- 0: 0px\n- 1: 4px\n- 2: 8px\n- 3: 12px\n- 4: 16px\n- 5: 20px\n- 6: 24px\n- 8: 32px\n- 10: 40px\n- 12: 48px\n- 16: 64px\n\nLayout grid:\n- Max content width: 1200px\n- Sidebar width: 256px (w-64)\n- Gutter: 24px\n- Card gap: 16px\n\nResponsive breakpoints:\n- sm: 640px\n- md: 768px\n- lg: 1024px\n- xl: 1280px", collectionIdx: 3, authorIdx: 2, tags: ["design-tokens", "layout"] },
  { title: "Form Patterns", body: "Standard form patterns for the design system:\n\n1. Inline validation: Show errors after field blur, not on change\n2. Submit button: Disable during submission, show loading spinner\n3. Error summary: Show at top of form for accessibility\n4. Required fields: Mark with * and use aria-required\n5. Help text: Below input, use FormDescription component\n\nField types:\n- Text input with label\n- Textarea with character count\n- Select dropdown\n- Checkbox group\n- Radio group\n- Switch toggle\n- Date picker\n\nAll form components should work with react-hook-form.", collectionIdx: 3, authorIdx: 2, tags: ["components", "forms"] },
  { title: "Paper: Attention Is All You Need", body: "Authors: Vaswani et al., 2017\n\nKey contribution: Introduced the Transformer architecture, replacing recurrent and convolutional layers entirely with self-attention mechanisms.\n\nCore ideas:\n- Self-attention allows modeling dependencies regardless of distance in sequence\n- Multi-head attention provides multiple representation subspaces\n- Positional encoding adds sequence order information\n- Scaled dot-product attention: softmax(QK^T / sqrt(d_k)) * V\n\nResults: State-of-the-art on machine translation benchmarks with significantly less training time than recurrent models.\n\nImpact: Foundation for BERT, GPT, and virtually all modern language models.", collectionIdx: 4, authorIdx: 2, tags: ["papers", "ml"] },
  { title: "Book: Designing Data-Intensive Applications", body: "Author: Martin Kleppmann\n\nPart I - Foundations:\n- Reliability: Systems should work correctly even with faults\n- Scalability: Describe load, measure performance, cope with growth\n- Maintainability: Operability, simplicity, evolvability\n\nPart II - Distributed Data:\n- Replication: Leader-follower, multi-leader, leaderless\n- Partitioning: Key range, hash, composite\n- Transactions: ACID, isolation levels, serializability\n\nPart III - Derived Data:\n- Batch processing: MapReduce, dataflow engines\n- Stream processing: Message brokers, event sourcing, change data capture\n\nThis is the best systems design book I have read. Essential reading for backend engineers.", collectionIdx: 4, authorIdx: 2, tags: ["books", "systems"] },
  { title: "Article: The Twelve-Factor App", body: "Source: 12factor.net\n\nA methodology for building modern SaaS applications.\n\nFactors most relevant to us:\n1. Codebase: One codebase, many deploys (we use this with staging/prod)\n2. Dependencies: Explicitly declare and isolate (pnpm workspace)\n3. Config: Store in environment (we use env vars and secrets)\n4. Backing services: Treat as attached resources (PostgreSQL)\n5. Build, release, run: Strictly separate stages\n6. Processes: Stateless processes (our API is stateless except sessions)\n7. Port binding: Export services via port binding (Express)\n8. Concurrency: Scale via process model\n9. Disposability: Fast startup, graceful shutdown\n10. Dev/prod parity: Keep environments similar\n11. Logs: Treat as event streams (pino logger)\n12. Admin processes: Run as one-off processes", collectionIdx: 4, authorIdx: 2, tags: ["articles", "architecture"] },
  { title: "Paper: MapReduce", body: "Authors: Dean & Ghemawat, Google, 2004\n\nProblem: Processing large datasets across commodity hardware clusters.\n\nSolution:\n- Map: Apply a function to each input record, producing key-value pairs\n- Shuffle: Group by key, distribute to reducers\n- Reduce: Aggregate values for each key\n\nKey insights:\n- Abstraction hides distributed systems complexity\n- Fault tolerance through re-execution of failed tasks\n- Data locality: Move computation to data, not data to computation\n\nHistorical significance: Inspired Hadoop, Spark, and the entire big data ecosystem. Though now somewhat dated, the paper elegantly shows how to think about distributed computation.", collectionIdx: 4, authorIdx: 2, tags: ["papers", "systems"] },
  { title: "Reading List: To Read", body: "Books:\n- Staff Engineer by Will Larson\n- A Philosophy of Software Design by John Ousterhout\n- The Art of PostgreSQL by Dimitri Fontaine\n- Fundamentals of Software Architecture by Richards & Ford\n\nPapers:\n- Raft: In Search of an Understandable Consensus Algorithm\n- Dynamo: Amazon's Highly Available Key-value Store\n- Spanner: Google's Globally Distributed Database\n\nArticles:\n- How We Scaled to 100K Users by Alex Xu\n- Building a Second Brain by Tiago Forte", collectionIdx: 4, authorIdx: 2, tags: ["reading-list"] },
  { title: "Sprint 12 Retrospective", body: "What went well:\n- Shipped the collection sharing feature on time\n- Good collaboration between frontend and backend\n- Automated tests caught a regression before production\n\nWhat could improve:\n- Too many context switches between projects\n- Standup meetings running long (aim for 10 min max)\n- Need better documentation for the API endpoints\n\nAction items:\n1. Alice: Set up a documentation template for new endpoints (due: next sprint)\n2. Bob: Timebox standups to 10 minutes, use parking lot for longer discussions\n3. Carol: Create a shared Figma library for common patterns\n\nTeam mood: 7.5/10 (up from 6.8 last sprint)", collectionIdx: 5, authorIdx: 0, tags: ["retro", "sprint-12"] },
  { title: "Sprint 13 Retrospective", body: "What went well:\n- Dashboard redesign received positive feedback from beta users\n- New team member onboarded smoothly using the handbook\n- Reduced deploy time from 8 min to 3 min\n\nWhat could improve:\n- Search performance degrades with large note bodies\n- Some API responses include unnecessary data (over-fetching)\n- Mobile responsive design needs attention\n\nAction items:\n1. Bob: Investigate search indexing options for next sprint\n2. Alice: Audit API responses for data minimization\n3. Carol: Create mobile breakpoint designs for key pages\n\nTeam mood: 8.2/10 (highest this quarter!)", collectionIdx: 5, authorIdx: 0, tags: ["retro", "sprint-13"] },
  { title: "Process: Incident Response", body: "When an incident occurs:\n\n1. DETECT: Automated alerts or user report\n2. RESPOND: Acknowledge in Slack #incidents channel\n3. TRIAGE: Severity assessment\n   - P0: System down, all users affected\n   - P1: Major feature broken, many users affected\n   - P2: Minor feature broken, workaround exists\n4. COMMUNICATE: Update status page and notify stakeholders\n5. RESOLVE: Fix the issue, verify fix in staging, deploy\n6. REVIEW: Write post-mortem within 48 hours\n\nPost-mortem format:\n- Timeline of events\n- Root cause analysis (5 Whys)\n- Action items with owners and due dates\n- Lessons learned", collectionIdx: 5, authorIdx: 1, tags: ["process", "incidents"] },
  { title: "Meeting Cadence", body: "Current team meeting schedule:\n\nDaily:\n- Standup: 9:30am, 10 min max, async-first (post in Slack, sync only if needed)\n\nWeekly:\n- Sprint planning: Monday 10am (1 hour)\n- Design review: Wednesday 2pm (30 min)\n- Tech debt review: Thursday 3pm (30 min, biweekly)\n\nBiweekly:\n- Sprint retrospective: Every other Friday 3pm (45 min)\n- 1:1s with manager: Varies by person\n\nMonthly:\n- All-hands: First Monday 11am (30 min)\n- Architecture review: Last Thursday 2pm (1 hour)\n\nRule: No meetings on Tuesday and Friday mornings (deep work time).", collectionIdx: 5, authorIdx: 0, tags: ["process", "meetings"] },
  { title: "Onboarding Feedback: New Hire Survey", body: "Compiled feedback from last 3 new hires:\n\nWhat worked:\n- The Engineering Handbook was very helpful\n- Buddy system made the first week less overwhelming\n- Good documentation for local dev setup\n\nWhat needs improvement:\n- Architecture overview is outdated (still mentions old monolith)\n- Not clear which Slack channels to join\n- Would appreciate a glossary of internal terms/acronyms\n\nAction items:\n1. Update architecture docs to reflect current microservice setup\n2. Create a Slack channel guide in the handbook\n3. Start an internal glossary wiki page\n4. Add 'meet the team' section with photos and roles", collectionIdx: 5, authorIdx: 2, tags: ["feedback", "onboarding"] },
  { title: "Testing Strategy Update", body: "Current testing pyramid:\n\nUnit tests: ~400 tests, 85% coverage on business logic\nIntegration tests: ~60 tests covering API endpoints\nE2E tests: ~15 tests for critical user flows\n\nGaps identified:\n- No tests for WebSocket/real-time features (future)\n- Missing edge cases in collection permission logic\n- Frontend component tests are sparse\n\nProposed changes:\n1. Add Playwright tests for top 5 user flows\n2. Increase integration test coverage for auth flows\n3. Add visual regression tests for key pages\n4. Set up test data factories for consistent seed data\n\nBudget: Will increase CI time by ~2 minutes. Acceptable trade-off.", collectionIdx: 0, authorIdx: 1, tags: ["testing", "quality"] },
  { title: "Performance Benchmarks", body: "Latest performance measurements (March 2026):\n\nAPI Response Times:\n- GET /api/notes: p50=45ms, p95=120ms, p99=280ms\n- GET /api/search: p50=85ms, p95=350ms, p99=890ms\n- POST /api/notes: p50=32ms, p95=90ms, p99=150ms\n\nFrontend Metrics:\n- First Contentful Paint: 1.2s\n- Largest Contentful Paint: 2.1s\n- Time to Interactive: 2.8s\n- Cumulative Layout Shift: 0.05\n\nAreas for improvement:\n- Search p99 is too high, investigate query optimization\n- LCP could be improved with lazy loading\n- Consider preloading dashboard data", collectionIdx: 0, authorIdx: 0, tags: ["performance", "metrics"] },
  { title: "Feature: Email Notifications", body: "Specification for email notification system:\n\nTriggers:\n- Someone shares a collection with you\n- A note you authored is edited by someone else\n- You are mentioned in a note (future: @mentions)\n- Weekly digest of activity in your collections\n\nUser controls:\n- Global on/off toggle in settings\n- Per-collection notification preferences (future)\n- Frequency: immediate, daily digest, weekly digest\n\nTechnical approach:\n- Use a background job queue (BullMQ or similar)\n- Email templates with Handlebars\n- SendGrid or Resend for delivery\n- Unsubscribe link in every email", collectionIdx: 1, authorIdx: 0, tags: ["feature", "notifications"] },
  { title: "Dark Mode Design Tokens", body: "Dark mode color overrides:\n\nBackground: hsl(25, 12%, 10%)\nForeground: hsl(30, 15%, 90%)\nCard: hsl(25, 10%, 14%)\nCard border: hsl(25, 8%, 20%)\nMuted: hsl(25, 8%, 18%)\nMuted foreground: hsl(30, 10%, 55%)\nPrimary: hsl(25, 50%, 55%) — slightly lighter for dark bg\nSidebar: hsl(25, 10%, 8%)\n\nNotes:\n- Reduce contrast slightly to avoid eye strain\n- Use opacity for subtle layering effects\n- Test with actual dark mode screenshots, not just in Figma\n- Ensure focus rings are visible in dark mode", collectionIdx: 3, authorIdx: 2, tags: ["design-tokens", "dark-mode"] },
  { title: "Icon Guidelines", body: "We use Lucide icons throughout the application.\n\nSize standards:\n- Inline with text: 16px (w-4 h-4)\n- Button icons: 16px with 8px gap\n- Navigation icons: 18px (w-4.5 h-4.5)\n- Empty state illustrations: 48px (w-12 h-12)\n\nColor:\n- Default: currentColor (inherits text color)\n- Muted: text-muted-foreground\n- Primary: text-primary (for active states)\n\nDo not:\n- Mix icon libraries\n- Use icons without labels in navigation\n- Use filled variants (stick to outline)\n- Animate icons without purpose", collectionIdx: 3, authorIdx: 2, tags: ["components", "icons"] },
  { title: "Accessibility Audit Results", body: "Audit conducted: March 2026\nTool: axe-core automated scan + manual keyboard testing\n\nPassed:\n- All form inputs have associated labels\n- Color contrast ratios meet AA standards\n- Focus management works for dialogs\n- Skip navigation link present\n\nFailed:\n- Some dropdown menus lack proper ARIA roles (priority: high)\n- Toast notifications are not announced by screen readers (priority: medium)\n- Tab order in the note editor needs adjustment (priority: medium)\n- Missing alt text on user avatars (priority: low)\n\nRemediation plan:\n1. Fix ARIA roles on dropdown menus (Sprint 15)\n2. Add aria-live region for toast notifications\n3. Review and fix tab order in editor\n4. Add descriptive alt text for all images", collectionIdx: 3, authorIdx: 2, tags: ["accessibility", "audit"] },
];

export async function runSeedData() {
  const [existing] = await db
    .select({ count: count() })
    .from(collectionsTable);

  if (existing.count > 0) return;

  const users = [];
  for (const userData of SEED_USERS) {
    const passwordHash = await bcrypt.hash(userData.password, 12);
    const [user] = await db
      .insert(usersTable)
      .values({
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        role: userData.role,
        passwordHash,
        emailVerified: true,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { updatedAt: new Date() },
      })
      .returning();
    users.push(user);
  }

  const collections = [];
  for (const colData of SEED_COLLECTIONS) {
    const [collection] = await db
      .insert(collectionsTable)
      .values({
        name: colData.name,
        description: colData.description,
        ownerId: users[colData.ownerIdx].id,
        visibility: colData.visibility,
      })
      .returning();
    collections.push(collection);

    if (colData.sharedWith) {
      for (const share of colData.sharedWith) {
        await db
          .insert(collectionMembersTable)
          .values({
            collectionId: collection.id,
            userId: users[share.userIdx].id,
            role: share.role,
          })
          .onConflictDoNothing();
      }
    }

    await db.insert(activityEventsTable).values({
      type: "collection_created",
      actorId: users[colData.ownerIdx].id,
      entityId: collection.id,
      entityType: "collection",
      entityTitle: collection.name,
      collectionId: collection.id,
      metadata: {},
    });
  }

  for (const noteData of SEED_NOTES) {
    const [note] = await db
      .insert(notesTable)
      .values({
        title: noteData.title,
        body: noteData.body,
        collectionId: collections[noteData.collectionIdx].id,
        createdById: users[noteData.authorIdx].id,
        archived: noteData.archived || false,
      })
      .returning();

    if (noteData.tags.length > 0) {
      await db.insert(noteTagsTable).values(
        noteData.tags.map((tag) => ({ noteId: note.id, tag }))
      );
    }

    await db.insert(noteRevisionMetadataTable).values({
      noteId: note.id,
      editedById: users[noteData.authorIdx].id,
      editSummary: "Created note",
    });

    await db.insert(activityEventsTable).values({
      type: "note_created",
      actorId: users[noteData.authorIdx].id,
      entityId: note.id,
      entityType: "note",
      entityTitle: note.title,
      collectionId: collections[noteData.collectionIdx].id,
      metadata: {},
    });
  }
}

export async function seedDataForUser(userId: string) {
  const existingCollections = await db
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.ownerId, userId));

  if (existingCollections.length > 0) return;

  await runSeedData();

  const sharedCollections = await db
    .select({ id: collectionsTable.id })
    .from(collectionsTable)
    .where(eq(collectionsTable.visibility, "shared"));

  for (const col of sharedCollections) {
    await db
      .insert(collectionMembersTable)
      .values({
        collectionId: col.id,
        userId,
        role: "viewer",
      })
      .onConflictDoNothing();
  }
}
