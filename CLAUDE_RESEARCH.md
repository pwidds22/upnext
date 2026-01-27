# TV tracking app best practices for UpNext's "simpler Goodreads for TV" positioning

**UpNext has a significant market opportunity.** TV Time—the dominant player with **12+ million users**—is plagued by documented complaints about slow performance, feature bloat, and aggressive data collection that fuels its B2B data-selling business. Meanwhile, Letterboxd has proven the "Goodreads for [media]" positioning works spectacularly, growing from **1.8 million to 20+ million users** since 2020 by emphasizing simplicity, speed, and community over features. The path forward for UpNext is clear: build a fast, focused, privacy-respecting TV tracker that solves TV Time's most complained-about problems while copying Letterboxd's strategic playbook.

---

## The optimal rating system balances familiarity with nuance

The research strongly supports a **5-star system with half-star increments**—matching Letterboxd's beloved approach rather than Goodreads' more limited whole-star-only system. Netflix's 2017 switch to thumbs up/down increased engagement by **200%**, but that binary approach serves algorithmic training, not the "Goodreads-like" community UpNext wants where users express nuanced opinions. The 5-star scale remains the most familiar rating paradigm, while half-stars address Goodreads users' top complaint: "My most difficult rating decision is when I have to choose between 3 or 4 stars."

**The show vs. episode rating question has a clear answer.** TV Time's biggest UX gap is its lack of show-level ratings—users can only rate individual episodes, forcing excessive engagement for what should be simple tracking. IMDb handles this correctly with separate ratings at series, season, and episode levels, none of which are auto-averaged. This independence matters critically for the "terrible final seasons" problem: Game of Thrones maintains a **9.3 series rating** despite Season 8 averaging 7.85 because users rate the series holistically based on its overall legacy. For UpNext, show-level rating should be primary and prominent, season-level optional for power users, and episode-level kept lightweight through emoji reactions rather than requiring star ratings for every episode watched.

Research from Letterboxd's 2023 algorithm update shows weighted averages with anti-manipulation measures work better than simple means. The key insight: **let users rate shows manually rather than auto-calculating from episode averages**, but display season/episode trends visually so viewers can see quality trajectories. Consider adding a "completed with reservations" indicator for shows like Dexter or How I Met Your Mother where fans appreciate the whole despite disliking the ending.

---

## TV Time collects extensive data because selling it is their core business

TV Time's revenue model centers on **TVLytics**, their B2B analytics platform that sells viewing insights to studios, networks, streaming services, and talent agencies. This explains why they ask for emotional reactions, favorite characters, where you watched, and detailed polls—it's not primarily for recommendations. Per TechCrunch: "What TV Time could provide was emotional data on how users responded to shows." United Talents Agency signed a data access deal, and Variety cited TVLytics data as one reason Netflix paid **$100 million** to keep "Friends."

The privacy policy reveals TV Time collects approximate location, email, device identifiers, IP addresses, entertainment apps on your device, and clickstream data beyond the explicit user inputs. After GDPR disclosures, TV Time reported users actually engaged more when they understood they were "affecting the creation of TV shows"—but this doesn't mean users prefer this model over a privacy-respecting alternative.

**A functional recommendation engine requires surprisingly little data.** Collaborative filtering—the approach Netflix uses—needs only three data points per interaction: User ID, Item ID, and a rating or watch signal. Everything else enhances accuracy but isn't essential. For UpNext's "minimum viable rating experience," the essentials are: watched status (binary), rating (5-star), watchlist status, and currently-watching indicator. Emotional reactions, favorite character votes, watch location, and detailed polls can all be eliminated without sacrificing recommendation quality. Content metadata for content-based filtering can come from public sources like TMDB or TVDB rather than user harvesting.

---

## Privacy positioning can work financially, but requires clear execution

User sentiment data validates the privacy angle: **84% of consumers** care about data privacy, **32%** have switched providers over data practices, and approximately **54%** would pay $1-3/month to keep personal information from being sold. Importantly, users who view tech providers as both innovative and data-responsible spend **62% more annually** on tech devices.

Trakt demonstrates privacy-focused monetization works for TV tracking. They explicitly state "We don't sell your data and respect your privacy" and fund entirely through VIP memberships at **$60/year** (recently doubled from $30, causing some backlash). Trakt VIP includes ad-free experience, Year in Review statistics, unlimited lists, calendar integration, and advanced filtering. DuckDuckGo proves the broader principle: profitable since 2014 with **$100M+ annual revenue** through contextual ads and affiliate partnerships rather than behavioral tracking.

**The affiliate model presents an underexplored opportunity.** JustWatch generates 80% of revenue from B2B trailer advertising to studios while providing "where to watch" links that earn commission on rentals and purchases. For UpNext, affiliate links to platforms offering rentals/purchases (Apple TV, Amazon Prime Video, Google Play) could generate revenue without selling user data—though subscriptions-only services like Netflix don't offer affiliate programs.

### Recommended monetization structure for UpNext

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Core tracking, 3-5 lists, basic stats, social features |
| **Premium** | $4.99/month or $49.99/year | Statistics/Year in Review, unlimited lists, cloud sync, ad-free, calendar integration |
| **Lifetime** | $99 one-time | Permanent premium access |

Expected freemium conversion is **2-5%** for self-serve products, though entertainment apps can achieve higher with compelling statistics features. Student discounts at $2.99/month build future paying customers.

---

## TV Time's documented weaknesses create clear opportunities

Analysis of thousands of user reviews across App Store, Google Play, Trustpilot, and Reddit reveals consistent pain points. Performance dominates complaints: "Every API call takes 10-20 seconds. I am basically sitting in loading screens for minutes so that I can spend 10 seconds to mark an episode watched." Users describe the web version as "almost inoperable" and cite constant crashes, sync failures, and black screens on startup.

UI changes have frustrated users who preferred earlier, simpler designs: "Please bring back the list option from before! It was so much more convenient... The new gridline option is even more terrible than scrolling forever." Adding movies to a TV-focused app backfired: "This app actually became less useful when they added movies to it." The recommendation algorithm receives particular criticism: "The suggestions it gives for what to watch are the most absolute generic... no personalized algorithm."

**Data lock-in creates switching friction that UpNext should exploit.** "NO EXPORT OPTION OF YOUR DATA!!!" appears in multiple reviews—users feel trapped because they can't migrate their viewing history. Offering easy export from day one builds trust and reduces signup friction from users worried about another dead end.

What users love about TV Time should be preserved in any competitor: episode tracking core functionality, air date notifications, progress indicators showing unwatched episodes, and calendar views for planning. These are table stakes.

### Feature categorization for TV tracking apps

**Must-have features** include episode tracking, watchlist management, air date notifications, quick episode check-off, comprehensive show database, cross-device sync, and progress indicators. **Nice-to-have features** include episode-level ratings, custom lists, basic social following, calendar views, streaming service indicators, and detailed statistics. **Bloat to avoid** includes heavy social feeds, meme/GIF features, movie tracking in a TV app, complex discovery algorithms that don't deliver, and heavy graphics that slow performance.

---

## Letterboxd's success proves the playbook works

Letterboxd grew from **1.8 million users** in March 2020 to over **20 million** today by executing exactly the positioning UpNext is pursuing. Founder Matthew Buchanan explicitly used "Goodreads for movies" from launch. The platform's success stems from several transferable principles.

**Simplicity trumped features.** "Astonishingly little has changed since the service's early days. The home page revolves around carousels of scrollable movie posters." Letterboxd's founders noted: "Ironically, the key to running a pro-social network is omitting typical social media features like DMs and birthday notifications." They built for passionate cinephiles first, then expanded—not the reverse.

**Speed and reliability matter.** Unlike TV Time's performance complaints, Letterboxd works smoothly. Search, editing, and navigation feel instant. This isn't glamorous product differentiation, but it's decisive—Things 3 won against OmniFocus partly because users described it as beautiful to use rather than functional to configure.

**Community over features drives retention.** User-generated content—reviews, lists, ratings—powers discovery rather than algorithms. "The content isn't pushed on them; it's created by them." Letterboxd embraced film culture rather than film consumption as transaction.

Letterboxd also benefited from competitor missteps: IMDb shut down its message boards in 2017, forcing film discussion communities to find new homes. TV Time's ongoing performance issues and the November 2024 App Store removal drama create similar switching momentum.

---

## Specific recommendations for UpNext's rating system

**Primary rating:** 5-star scale with half-star increments for show-level ratings. Display averages with one decimal (4.3, not 4.27).

**Rating levels:** Show rating required and prominent. Season rating optional for power users. Episode rating kept lightweight—quick emoji reactions (loved it, meh, disappointed) rather than forcing full star ratings for every episode.

**Aggregation approach:** Manual show rating that doesn't auto-calculate from episodes or seasons. Display season/episode trends visually through sparklines or color-coded grids so users see quality trajectories, but let them rate the show holistically.

**Additional signals worth considering:** A binary "Would you recommend?" alongside star ratings. A "completed with reservations" indicator for shows with divisive endings. Peak rating vs. current rating display for shows that declined significantly.

---

## Warnings and pitfalls to avoid

**Don't add movies.** TV Time users explicitly complained this diluted focus and introduced bugs. Partner with Letterboxd for movie discovery rather than competing—they're considering TV but will move slowly.

**Don't prioritize features over speed.** TV Time's performance is the top complaint. Every interaction should feel instant. Technical excellence is product differentiation in this space.

**Don't gate core tracking features.** Freemium works when the free tier is genuinely useful. Gate statistics, unlimited lists, and advanced features—not basic watchlist and tracking functionality.

**Don't collect data you don't need.** The temptation to build TV Time's data collection model will be strong, especially when fundraising. But Trakt proves subscription-only works, and the privacy positioning is most credible when executed fully. Every unnecessary data field collected undermines the differentiation.

**Don't ignore data portability.** Offer import from TV Time, Trakt, and Simkl immediately. Offer export prominently. This builds trust and removes the biggest barrier to switching.

**Don't compete with JustWatch on "where to watch."** Their data partnerships and API integrations are extensive. Instead, integrate their data through partnership like Letterboxd does.

**Don't launch with social features as the focus.** Build utility first, community second. Users need the tracker to work perfectly before they'll engage socially around it. Letterboxd's lesson: "If there was no social aspect, I'd still use the app for its utility."

---

## The path forward

UpNext's "simpler, Goodreads for TV" positioning is validated by Letterboxd's trajectory and TV Time's documented failures. The market is ready for a fast, focused, privacy-respecting TV tracker. The business model—freemium with premium statistics, ad-free experience, and expanded list capabilities at $50/year—is proven by Trakt and sustainable without selling user data.

The critical success factors: exceptional speed and reliability, show-level ratings that TV Time lacks, data portability that builds trust, and the discipline to stay focused on TV shows while resisting feature creep. Execute these, and UpNext can capture the growing segment of users frustrated with TV Time's bloat and data practices—the same way Letterboxd captured cinephiles frustrated with IMDb and Rotten Tomatoes.