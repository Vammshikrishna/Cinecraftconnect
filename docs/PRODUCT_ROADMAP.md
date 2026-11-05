# CineCraft Connect: upcoming feature proposals

This document proposes the next features for the whole app, each explained twice: what it means for the person using it, and what it means for the business. It builds on what already exists (profiles, network, projects, jobs, pitch, marketplace, vendors, discussions, ratings, messages). Feed-only ideas are in [FEED_ROADMAP.md](FEED_ROADMAP.md) and are not repeated here.

**How to read the ratings.** Effort (S, M, L) and impact (Low, Medium, High) are my judgement from reading the code, not measured data. Check them against real usage numbers before committing. Revenue figures are deliberately not given, because I have no pricing or traffic data.

## 1. The idea in one paragraph

The app already helps people find each other and talk. The biggest gap is the step after that: **getting a film made and getting paid**. Most of the proposals below close that gap (contracts, payments, call sheets, hiring), or make the first meeting easier (portfolio, showreel, discovery). They also create natural, fair reasons to charge (for Pro and Studio accounts, fees on bookings), which the app does not have today.

## 2. Summary table

| # | Feature | Who benefits most | User value | Business value | Effort | Priority |
|---|---|---|---|---|---|---|
| 1 | Contracts and e-signatures | Pro, Studio | High | High | M | **Now** |
| 2 | Payments and escrow for bookings and gigs | Pro, Studio, vendors | High | **Very high** | L | **Now** |
| 3 | Smart match: roles and jobs to people | Pro, Studio | High | High | M | **Now** |
| 4 | Showreel and portfolio pages with a public link | Pro | High | Medium | S | **Now** |
| 5 | Call sheets and shoot schedule | Studio, Pro | High | Medium | M | Next |
| 6 | Verified credits (IMDb-style) | Pro | High | High | M | Next |
| 7 | Pro and Studio subscription tiers | Pro, Studio | Medium | **Very high** | M | Next |
| 8 | Talent and crew directory for studios (search by availability) | Studio | High | High | M | Next |
| 9 | Festival and funding calendar | Pro, Fan | Medium | Medium | S | Next |
| 10 | Casting calls with self-tape upload | Actors, Studio | High | High | L | Later |
| 11 | Events and meetups (online and in person) | All | Medium | Medium | M | Later |
| 12 | Mentorship matching | New Pros, Fans | Medium | Medium | M | Later |
| 13 | Education and course listings | Fans, new Pros | Medium | Medium | M | Later |
| 14 | Crowdfunding and sponsorship for projects | Pro, Studio | Medium | High | L | Later |

Why this order: items marked **Now** unlock money or remove the main reason people leave after the first conversation. **Next** builds trust and deepens use. **Later** widens the audience and needs more moderation or legal work.

## 3. Proposals in detail

### 3.1 Contracts and e-signatures (Now)

**What it is.** From a project space, a job or a booking, a person can create a short agreement (role, dates, pay, usage rights, cancellation) from a template, send it, and both sides sign inside the app. A signed copy is stored and can be downloaded as PDF.

**User point of view.**
- Freelancers stop chasing "can you send something in writing?" by email.
- A clear template protects both sides and shows what is normal (day rate, overtime, credit).
- Everything for a job stays in one place: the chat, the schedule and the agreement.

**Business point of view.**
- Moves the app from "where people meet" to "where work is agreed", which raises how often and how long people use it.
- Gives a safe place to start charging (for example free for one contract a month, paid above that).
- Builds a record that supports payments (3.2) and verified credits (3.6).
- Risk: contracts are a legal area. Offer templates as a convenience, state they are not legal advice, and have a lawyer review them for the countries you launch in.

**Fits with.** Existing NDA signing and record in Pitch, project roles and invitations, date holds.

**Rough scope.** Template tables, a signing record (who, when, version), a signed PDF in private storage, notifications. Reuse the NDA record pattern.

### 3.2 Payments and escrow (Now)

**What it is.** Money for marketplace rentals, vendor quotes, and gigs agreed in a contract is paid through the app. The money is held until the job is marked complete, then released to the seller. A small fee is kept by the platform.

**User point of view.**
- Renters and clients: confidence that money is only released when the equipment arrived or the work was delivered.
- Sellers and freelancers: confidence that the client has really paid before they start.
- A clear receipt and history, with refunds handled through a visible dispute step.

**Business point of view.**
- The most direct revenue source: a percentage fee on every completed transaction, with no change to the free sign-up.
- Keeps deals on the platform instead of moving to WhatsApp after the first chat, which is the usual reason marketplaces leak value.
- Risk: it brings compliance work (payment provider onboarding, tax, payouts, chargebacks). Use a hosted provider so card data never touches our servers, and start with one country and one currency.

**Fits with.** My Bookings and My Quotes already have the status flow (Accept, Mark completed, Cancel). Payment hooks into those same steps.

**Rough scope.** Payment provider integration, an edge function for webhooks, a ledger table, payout onboarding, dispute states, admin refund tools. This is the largest item on the list.

### 3.3 Smart match: people for roles, jobs for people (Now)

**What it is.** When someone posts a job or a project role, the app suggests the best-fitting people (craft, skills, city, availability, past credits). In the other direction, Pros see a "Jobs for you" list ranked by fit with a short reason ("Matches your craft and city").

**User point of view.**
- Employers get a shortlist in seconds instead of scrolling through applicants.
- Pros hear about the right work without searching every day.
- The reason shown ("why this match") builds trust and lets people correct their profile.

**Business point of view.**
- Faster hires means more successful jobs, which is what brings employers back.
- Employers can pay to "invite top matches" or promote a job (a fair, optional upsell).
- Needs no new data: it uses profile, availability, skills and credits that already exist, like the existing "why am I seeing this" approach in the feed.
- Risk: bias and wrong matches. Always show the reason, let people hide a suggestion, and never rank by anything sensitive.

**Fits with.** Network Discover reasons, availability fields, the job pipeline, the feed's explainable ranking.

### 3.4 Showreel and portfolio pages (Now)

**What it is.** A clean public page per Pro (for example a short link like cinecraft.example/name) with showreel video, best work, credits, contact button and availability. It can be shared outside the app and does not need the viewer to log in.

**User point of view.**
- A professional portfolio without building a website.
- One link to put in emails, bios and festival forms.
- Visitors can contact them or check availability in one tap, and are invited to join.

**Business point of view.**
- Every shared link is free advertising and a way for new people to find the app (search engines can index public pages).
- Pros keep their profile current because it is their public face, which improves data quality for matching (3.3).
- Premium option: custom domain, removal of branding, more media.
- Risk: privacy. Everything on the page must follow the existing "who can see this" settings, and the page must respect hidden sections.

**Fits with.** The redesigned profile, hidden sections, Portfolio tab, share profile.

### 3.5 Call sheets and shoot schedule (Next)

**What it is.** Inside a project space, the producer builds a daily call sheet (date, location, call times per person, scenes, notes, weather) and publishes it. Each crew member sees only their own times, gets a reminder, and can confirm. It can be exported as a PDF.

**User point of view.**
- Everyone knows where to be and when, without a spreadsheet and a group chat.
- Confirmations tell the producer who is ready.
- Changes notify the people affected.

**Business point of view.**
- Makes the project space the daily tool of a production, which creates habit and keeps teams on the platform for months.
- Natural premium feature for Studios (more shoot days, more members, export).
- Low risk; mostly product design.

**Fits with.** Project spaces already list schedule and call sheet as tools; this deepens them.

### 3.6 Verified credits (Next)

**What it is.** A credit on a profile ("Cinematographer on X, 2024") can be confirmed by the production, the director, or another credited person. Confirmed credits show a tick and count toward the profile completeness and ranking. Optionally link to the public listing of the work.

**User point of view.**
- A trustworthy career record that cannot be faked.
- Easier to be hired because proof is on the profile.
- Fans see real credits and can follow the work.

**Business point of view.**
- Trust is the product in a hiring network; this is a strong reason to choose this platform over a generic one.
- Can be tied to paid verification for Studios and companies.
- Feeds better matching (3.3) and recommendations.
- Risk: disputes about who worked on what. Provide a clear "dispute this credit" and a moderator step.

**Fits with.** Credits tab, the confirmation flow that already exists for collaborators on posts, profile completeness.

### 3.7 Subscription tiers (Next)

**What it is.** Keep a generous free level. Add a paid Pro and Studio plan with extra capacity and tools, not by removing what free users have today.

Suggested split (to be tested):
| Free | Pro plan | Studio plan |
|---|---|---|
| Profile, feed, network, messages, apply to jobs, basic portfolio | Showreel page with custom link, priority in search, advanced analytics, more storage, contracts beyond the free limit | Team seats, bulk hiring tools, pitch inbox exports, unlimited active calls and postings, branded company page |

**User point of view.**
- Nothing they rely on today is taken away. They pay only for tools that save time or help them be seen.
- Studios pay once for the whole team.

**Business point of view.**
- Predictable monthly revenue, which payments (3.2) alone do not give.
- Plans should be priced against the value, for example one hire or one booking pays for months.
- Risk: charging too early reduces growth. Introduce the paid plans after the free network has enough activity, and run a trial period.

**Fits with.** Account types already exist (fan, creator, studio) and platform flags already switch features on and off.

### 3.8 Studio talent search (Next)

**What it is.** A search tool for Studios: filter by craft, skills, gear, languages, city, day rate range and **available on these dates**. Save searches, shortlist people, invite many to apply at once.

**User point of view.**
- Pros who keep their availability current get contacted more.
- Studios find who is free for a shoot date in minutes.

**Business point of view.**
- The core value for the Studio side, and a strong reason to keep a paid Studio plan.
- Gives Pros a concrete reason to keep their calendar updated.
- Everything needed (availability, rate, cities, shortlists) is already stored, so effort is mainly search and interface.
- Respect the existing visibility choice (everyone or connections only) so nobody is shown against their wishes.

### 3.9 Festival and funding calendar (Next)

**What it is.** A calendar of festival deadlines, grants, labs and markets. Users can save an item, get a reminder, and mark that they submitted. Staff or partners add entries; users can suggest one.

**User point of view.**
- One place to track deadlines instead of many bookmarks.
- Fans and new Pros learn what opportunities exist.

**Business point of view.**
- Cheap to build and brings regular reasons to open the app.
- Partners (festivals, funds) can sponsor or promote an entry.
- Risk: stale data. Show "last updated" and let users flag a wrong date.

**Fits with.** Announcements, saved items, notifications and reminders (the pitch deadline reminder is the same pattern).

### 3.10 Casting calls with self-tape upload (Later)

**What it is.** Studios post casting calls (role, description, deadline). Actors submit a self-tape (video upload or link) and a short note. The studio reviews, rates, shortlists and replies, like the pitch review inbox.

**User point of view.**
- Actors can apply from anywhere and be seen on merit.
- Studios compare tapes side by side.

**Business point of view.**
- Opens a large audience (actors) that the app serves less today.
- Reuses the pitch call, submission and review design, so the product logic is known.
- Cost and risk: video storage and bandwidth are expensive, and minors and safety need clear rules. Cap size and length, compress, and set a retention period.

### 3.11 Events and meetups (Later)

**What it is.** Hosts create events (screening, workshop, networking night, online Q and A), people RSVP, get reminders, and see who is going. Event chat and photos afterwards.

**User point of view.** Turns online contacts into real relationships.

**Business point of view.** Ticketed events and sponsorship are an additional revenue line. Risk: event moderation and safety.

### 3.12 Mentorship matching (Later)

**What it is.** Experienced Pros opt in as mentors; newcomers request a mentor by craft and goal. A simple structure (a few sessions, goals, check-ins).

**User point of view.** Practical guidance for people starting out, and a way for experienced people to give back.

**Business point of view.** Builds loyalty and goodwill and supplies steady new content. A paid mentorship option can be added later. Needs a code of conduct and easy reporting.

### 3.13 Education and course listings (Later)

**What it is.** Verified trainers list courses and workshops. Users browse, bookmark and review, much like vendor services.

**User point of view.** Find trustworthy training and see real reviews.

**Business point of view.** Listing fees or commission, and a way to serve fans who want to enter the industry.

### 3.14 Crowdfunding and sponsorship (Later)

**What it is.** A project can open a funding page with goals, rewards and updates. Supporters pay through the platform.

**User point of view.** Filmmakers get a way to fund small projects among people who already follow them.

**Business point of view.** A fee on funds raised. The highest legal and compliance burden (rules differ by country), so only after payments (3.2) is stable and proven.

## 4. Suggested sequence

1. **Quarter 1:** showreel and portfolio pages (3.4), smart match (3.3), contracts (3.1). These are mostly built on data and patterns that already exist, and they make each other better.
2. **Quarter 2:** payments and escrow (3.2) with a single country, then call sheets (3.5) and verified credits (3.6).
3. **Quarter 3:** subscriptions (3.7) and Studio talent search (3.8), once there is enough activity to show value.
4. **After that:** the "Later" items, in the order the data shows demand.

Dependencies to respect: payments need contracts to feel complete; subscriptions need something worth paying for (3.1, 3.4, 3.8); smart match and talent search work better once credits are verified.

## 5. How to know it is working

| Feature | Measure of success |
|---|---|
| Portfolio pages | Share of Pros with a public page; visits from outside the app; sign-ups from page visits |
| Smart match | Applications per job; time from job posted to first hire; how often a suggestion is hidden |
| Contracts | Share of project roles that end with a signed agreement |
| Payments | Number of completed paid bookings; dispute rate; share of deals that stay in the app |
| Call sheets | Share of active projects that publish a call sheet; confirmation rate |
| Verified credits | Share of credits confirmed; hiring rate of profiles with confirmed credits |
| Subscriptions | Free to paid conversion; monthly cancellations; revenue per Studio |
| Talent search | Searches per Studio per month; invitations sent; response rate |

Set a baseline for each before launching, so improvements can be seen and not guessed.

## 6. Risks that cut across all items

- **Legal and compliance:** contracts, payments, crowdfunding and minors in casting each need local legal review.
- **Trust and safety:** more money and more contact means more scams. Keep reporting, blocking and moderator tools ahead of each launch.
- **Cold start:** features that need two sides (casting, mentorship, events) feel empty until enough people join. Launch them in one craft or city first.
- **Complexity:** the app already has many areas. Prefer adding depth to existing places (project space, profile, pitch) over adding new top-level menu items.
- **Cost:** video, storage and payment fees grow with use. Put limits in place and price accordingly.

## 7. Decisions needed from you

1. Is earning from transaction fees acceptable to your users, or do you prefer subscriptions first?
2. Which country and currency to launch payments in?
3. Which one of the "Now" features to start with? My recommendation is portfolio pages (3.4), because it is small, shareable and improves data for the rest.
4. Whether Studios or individual Pros are the main paying group.

Each accepted feature should get its own short design document in `/docs` (like [PITCH.md](PITCH.md)) before building, with the database changes added as numbered parts in `supabase/manual/` and listed in `DEPLOY_CHECKLIST.md`.
