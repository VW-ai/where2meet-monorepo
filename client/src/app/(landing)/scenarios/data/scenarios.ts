/**
 * Scenario content data
 *
 * This file contains all scenario page content.
 * Content will be added in phases:
 * - Phase 1: Detailed outlines (300-400 words)
 * - Phase 2: Full content (1000-1500 words per scenario)
 */

import type { ScenarioContent, ScenarioMetadata } from './types';
import { createContentMetadata } from '@/lib/seo/types/content';

/**
 * Scenario metadata registry
 * Used for SEO strategy and keyword tracking
 */
export const SCENARIO_METADATA: Record<string, ScenarioMetadata> = {
  'friends-group-dinner-spot': {
    slug: 'friends-group-dinner-spot',
    layer: 'layer1-everyday',
    primaryKeywords: [
      'fair restaurant for friends',
      'central dinner location group',
      'where to eat with friends different neighborhoods',
    ],
    audience: 'Friend groups in same city, social organizers',
    searchVolume: 'medium',
    competition: 'medium',
  },

  'date-night-equal-distance': {
    slug: 'date-night-equal-distance',
    layer: 'layer1-everyday',
    primaryKeywords: [
      'fair date location',
      'equal distance date spot',
      'date night meeting in middle',
    ],
    audience: 'Dating couples, people in early relationships',
    searchVolume: 'medium',
    competition: 'low',
  },

  'coworkers-lunch-spot': {
    slug: 'coworkers-lunch-spot',
    layer: 'layer1-everyday',
    primaryKeywords: [
      'team lunch location',
      'coworkers lunch spot fair',
      'where to eat with coworkers',
    ],
    audience: 'Office workers, team leads, social committees',
    searchVolume: 'medium',
    competition: 'medium',
  },

  'group-weekend-hangout': {
    slug: 'group-weekend-hangout',
    layer: 'layer1-everyday',
    primaryKeywords: [
      'weekend meetup location',
      'where to hang out with friends group',
      'central spot for group',
    ],
    audience: 'Friend groups planning activities',
    searchVolume: 'medium',
    competition: 'low',
  },

  'family-reunion-location-finder': {
    slug: 'family-reunion-location-finder',
    layer: 'layer1-everyday',
    primaryKeywords: [
      'family reunion location planner',
      'fair venue extended family',
      'family gathering location finder',
    ],
    audience: 'Families spread across regions, reunion organizers',
    searchVolume: 'low',
    competition: 'low',
  },

  'remote-team-offsite-planning': {
    slug: 'remote-team-offsite-planning',
    layer: 'layer2-pain-heavy',
    primaryKeywords: [
      'remote team offsite location',
      'distributed team retreat planning',
      'remote team gathering venue',
    ],
    audience: 'Remote-first companies, HR managers, team leads',
    searchVolume: 'low',
    competition: 'low',
  },

  'cross-city-client-meetings': {
    slug: 'cross-city-client-meetings',
    layer: 'layer2-pain-heavy',
    primaryKeywords: [
      'client meeting between cities',
      'business meeting location two cities',
      'fair client meeting venue',
    ],
    audience: 'B2B sales professionals, account managers, consultants',
    searchVolume: 'very-low',
    competition: 'low',
  },

  'long-distance-friends-reunion': {
    slug: 'long-distance-friends-reunion',
    layer: 'layer2-pain-heavy',
    primaryKeywords: [
      'meeting friends from different cities',
      'long distance friends meetup',
      'central city for friends',
    ],
    audience: 'Long-distance friendships, college friends spread out',
    searchVolume: 'low',
    competition: 'low',
  },
};

/**
 * Scenario content registry
 * Full 1000-1500 word content for each scenario
 */
export const SCENARIOS: Record<string, ScenarioContent> = {
  'friends-group-dinner-spot': {
    slug: 'friends-group-dinner-spot',
    seo: {
      title: 'Fair Restaurant for Friends – Find Central Dinner Locations',
      description:
        "Stop forcing one friend to travel twice as far. Find fair restaurant locations where everyone's commute is balanced. Compare travel times and discover equitable dinner spots.",
      keywords: [
        'fair restaurant for friends',
        'central dinner location',
        'group dinner planning',
        'where to eat with friends',
      ],
      tags: ['friends', 'dinner', 'restaurants', 'group planning'],
    },
    hero: {
      h1: 'Fair Restaurant for Friends – Compare Travel Times & Find Central Dinner Locations',
      subheading:
        'Planning group dinners where someone always gets stuck with the long commute? Find restaurants that are actually fair for everyone.',
      problemStatement:
        "Geographic midpoints don't account for traffic, transit, or how people actually get around your city. A restaurant equidistant on a map can mean a 15-minute drive for Sarah and a 45-minute bus ride for Tom. That's not fair—and your friends notice.",
    },
    problem: {
      heading: 'Why Finding a Fair Dinner Spot Is So Hard',
      painPoints: [
        'One friend always volunteers to travel farther "because it\'s easier for me" (but it really isn\'t)',
        'The group picks restaurants close to whoever suggested them, creating subtle resentment',
        'Public transit users get stuck with 3x longer commutes than drivers',
        'You waste 20 minutes in a group chat debating locations without real data',
        '"Central" restaurants turn out to be unfair once people actually travel there',
      ],
      realWorldExamples: [
        'Your friend group spans downtown, suburbs, and neighborhoods across the metro. You pick a "central" spot based on the map. But Alex (downtown, near trains) gets there in 12 minutes while Jamie (suburbs, driving through traffic) spends 38 minutes. Jamie shows up frustrated, and next time suggests somewhere close to their place. The cycle repeats.',
        'You\'re coordinating dinner for 6 friends across different neighborhoods. After 40 messages debating "what about this place?" and "how far is that from you?", someone just picks a spot. Half the group arrives late because they underestimated travel time. One friend cancels last-minute because "it\'s too far."',
      ],
      whyMidpointFails:
        'A geographic midpoint calculates equal distance, not equal travel time. If the midpoint is 5 miles from everyone but accessible via highway for half your group and side streets for the other half, some friends will spend double the time getting there. Distance ≠ fairness.',
      whyManualFails:
        "Manually checking Google Maps for each friend to each restaurant is exhausting. You'd need to test dozens of combinations, account for transportation modes (driving vs transit vs biking), and coordinate feedback from everyone. Most groups give up and just pick somewhere familiar—which is rarely fair.",
      emotionalImpact:
        'When one person always travels farther, it erodes group dynamics. They feel undervalued. Others feel guilty. Eventually, someone stops showing up.',
    },
    solution: {
      heading: 'How Where2Meet Finds Fair Restaurants with Balanced Travel Times',
      introduction:
        "Where2Meet calculates real travel times for each person to potential restaurants—accounting for driving, public transit, biking, or walking. Our algorithm finds dining spots where everyone's commute is roughly equal, so no one person bears an unfair burden.",
      benefits: [
        "See each friend's actual travel time (not just distance) to every restaurant option",
        'Compare routes side-by-side on an interactive map with real traffic and transit data',
        'Filter by transportation mode: driving, public transit, biking, or walking',
        'Vote as a group on the fairest option—everyone can see the tradeoffs',
        'Discover new restaurants in neighborhoods that work for everyone',
      ],
      beforeAfterExample: {
        before:
          '6 friends spend 30 minutes texting back and forth: "What about this place?" "How far is that?" "I can\'t get there by 7pm." Someone picks a spot. Two friends arrive 20 minutes late. One person drove 5 minutes; another spent 40 minutes on two buses.',
        after:
          '6 friends use Where2Meet. Everyone adds their location. The map shows 3 restaurant options where travel times range from 18-22 minutes for everyone. The group votes on their favorite cuisine. Everyone arrives on time, and nobody feels like they got the short end of the stick.',
      },
      walkthrough:
        "Create an event, add each friend's starting location (home, office, or wherever they're coming from), and choose the transportation mode. Where2Meet queries real routing data to calculate travel times, then shows you restaurants where commutes are balanced. You see everyone's route on the map, vote together, and pick a spot that's genuinely fair.",
      transportationNote:
        'Pro tip: If your group uses mixed transportation (some drive, some take transit), set the mode to "public transit" to ensure accessibility for everyone. This prevents picking car-friendly spots that strand transit users.',
    },
    stepByStep: {
      heading: 'How to Find a Fair Restaurant in 3 Minutes',
      steps: [
        {
          stepNumber: 1,
          title: 'Create Your Dinner Event',
          description:
            'Enter event details: "Friday Dinner with Friends" and the meetup time (e.g., 7:00 PM). Share the link with your group via text or group chat.',
          tip: 'Set the meeting time to when you actually want to eat, not when people should leave. Where2Meet calculates arrival times based on travel duration.',
        },
        {
          stepNumber: 2,
          title: 'Everyone Adds Their Location',
          description:
            'Each friend enters their starting point—home address, work, or current location. Choose the transportation mode: driving, public transit, biking, or walking.',
          tip: 'For mixed groups, ask everyone to select "public transit" so the algorithm finds spots accessible to everyone, not just drivers.',
        },
        {
          stepNumber: 3,
          title: 'Review Fair Restaurant Options',
          description:
            'Where2Meet shows you restaurant suggestions with travel times for each person. The map displays routes, and you can see which spots minimize commute imbalance.',
          tip: "Look for options where the longest and shortest travel times are within 10 minutes of each other—that's the fairness sweet spot.",
        },
        {
          stepNumber: 4,
          title: 'Vote & Finalize',
          description:
            'The group votes on restaurant options. Everyone can see travel time tradeoffs and comment on preferences (cuisine, ambiance, price). Pick the winner and confirm!',
          tip: "Use the voting feature instead of another group chat debate. It's faster, transparent, and everyone's input is visible.",
        },
      ],
    },
    bestPractices: {
      heading: 'Pro Tips for Fair Group Dinners',
      tips: [
        {
          title: 'Set Transportation Mode Early',
          description:
            'Ask the group upfront: driving, transit, biking, or mixed? If anyone relies on public transit, set that as the default to ensure accessibility.',
        },
        {
          title: 'Consider Time of Day',
          description:
            "Rush hour traffic drastically changes travel times. If your dinner is at 6 PM on a weekday, Where2Meet's real-time data will account for traffic jams.",
        },
        {
          title: 'Explore New Neighborhoods',
          description:
            "Fair meeting points often reveal neighborhoods you wouldn't have considered. You might discover great restaurants in areas that work well for the whole group.",
        },
        {
          title: 'Use Filters for Preferences',
          description:
            'Once you have fair options, filter by cuisine type, price range, or ratings to narrow down choices without sacrificing fairness.',
        },
      ],
      commonMistakes: [
        {
          mistake: 'Picking the geographic midpoint without checking routes',
          why: 'The midpoint might be equidistant but inaccessible—located on a highway, in an area with no parking, or far from transit stops',
          fix: 'Always verify travel times, not just distance. Where2Meet does this automatically.',
        },
        {
          mistake: 'Forgetting about parking or transit access',
          why: 'A restaurant might be "close" but impossible to reach if there\'s no parking or the nearest train station is 15 minutes away',
          fix: 'Check the map view for parking lots and transit stops near restaurant suggestions',
        },
        {
          mistake: 'Not accounting for mixed transportation modes',
          why: 'Drivers can reach suburban spots quickly; transit users might need an hour with transfers',
          fix: 'Set transportation mode to the least flexible option (usually public transit) to ensure inclusivity',
        },
      ],
    },
    faq: {
      heading: 'Frequently Asked Questions',
      questions: [
        {
          question: 'What if my friends are coming from different cities?',
          answer:
            'Where2Meet works great for cross-city meetups. It will find restaurants in between cities or suggest central locations (like a city along the route between both) where travel times are balanced.',
        },
        {
          question: 'Can I filter restaurants by cuisine or price?',
          answer:
            'Yes. Where2Meet integrates with restaurant data so you can filter fair options by cuisine type, price range, ratings, and more—without sacrificing travel time fairness.',
        },
        {
          question: 'What if someone is running late?',
          answer:
            'You can update starting locations in real-time. If a friend is coming from a different spot (e.g., leaving work instead of home), they can update their location and Where2Meet recalculates.',
        },
        {
          question: 'How does Where2Meet handle parking availability?',
          answer:
            'The map view shows parking lots and street parking near suggested restaurants. For transit users, it displays nearby stops and stations so you can verify accessibility.',
        },
        {
          question: 'Can I save favorite restaurants for future meetups?',
          answer:
            'Yes. Once you find a fair spot that works well, you can save it for future events with the same group—no need to recalculate every time.',
        },
      ],
    },
    cta: {
      heading: 'Stop Making One Friend Travel Twice as Far',
      description:
        'Find fair restaurants in under 3 minutes. Compare travel times, see routes on a map, and let the group vote on where to eat.',
      buttonText: 'Plan Your Group Dinner',
    },
    contentMetadata: createContentMetadata('scenario', 'quarterly'),
    relatedScenarios: [
      'date-night-equal-distance',
      'coworkers-lunch-spot',
      'group-weekend-hangout',
    ],
  },

  'date-night-equal-distance': {
    slug: 'date-night-equal-distance',
    seo: {
      title: 'Fair Date Location – Equal Distance Date Spots for Couples',
      description:
        'Meeting someone new? Find date locations that are equally convenient for both of you. Compare travel times and show consideration from the first date.',
      keywords: [
        'fair date location',
        'equal distance date spot',
        'date night meeting in middle',
        'fair first date location',
      ],
      tags: ['dating', 'couples', 'first date', 'romance'],
    },
    hero: {
      h1: 'Fair Date Location – Find Equal Distance Date Spots That Show You Care',
      subheading:
        "Meeting someone new? Picking a date spot that's equally convenient shows respect and consideration—setting the right tone from the start.",
      problemStatement:
        'Suggesting a place near your apartment on a first date sends the wrong message. Making them travel 40 minutes while you walk 10 feels inconsiderate. Fair date planning builds trust.',
    },
    problem: {
      heading: 'Why Date Location Fairness Matters',
      painPoints: [
        'Suggesting a spot near you feels selfish; suggesting one near them feels try-hard',
        'You waste time in the "you pick" / "no, you pick" loop',
        'One person ends up traveling significantly farther, creating imbalance from the start',
        'Transit users get stuck commuting an hour while drivers arrive in 15 minutes',
        'The awkwardness of realizing mid-date that one person made way more effort',
      ],
      realWorldExamples: [
        'You match with someone who lives across the city. They suggest a coffee shop "in the middle"—but it\'s a 15-minute drive for them and a 45-minute bus ride for you. You go anyway, arriving flustered and late. The date starts on the wrong foot.',
        "You're excited about a first date and suggest a trendy spot you love. You walk there in 10 minutes. They drive 35 minutes in traffic. Midway through drinks, they mention the commute. You feel guilty; they feel under-appreciated. The vibe shifts.",
      ],
      whyMidpointFails:
        "A geographic midpoint between two addresses might look fair on a map—but if it's near a highway exit for one person and requires two bus transfers for the other, it's not actually equal. True fairness is about time and effort, not miles.",
      whyManualFails:
        "Manually coordinating date locations means: (1) admitting you don't know the area well, (2) making the other person do the research, or (3) spending 20 minutes looking up routes for each suggestion. Most people just pick somewhere familiar—which is rarely fair.",
      emotionalImpact:
        "First impressions matter. Picking a date spot that's convenient for you but burdensome for them signals a lack of thoughtfulness. Conversely, choosing a truly fair location shows you value their time and want to start things equitably.",
    },
    solution: {
      heading: 'How Where2Meet Finds Fair Date Locations with Equal Travel Times',
      introduction:
        'Where2Meet calculates real travel times from both locations and suggests date spots—restaurants, coffee shops, bars, parks—where commutes are balanced. You both see the routes and agree on a fair meeting point before the date.',
      benefits: [
        'Show consideration from the first message by suggesting a fair location',
        'See actual travel times for both people, not just distance',
        'Discover new date spots in neighborhoods neither of you frequent',
        'Filter by ambiance: coffee shops, cocktail bars, casual dining, parks',
        'Avoid the awkward "you pick" back-and-forth with transparent data',
      ],
      beforeAfterExample: {
        before:
          'You: "Want to meet for drinks?" Them: "Sure, where?" You: "How about [place near you]?" Them: "That\'s kind of far for me..." You: "Oh, sorry. Where works for you?" [10 messages later, you compromise on somewhere neither of you loves]',
        after:
          'You: "Want to meet for drinks?" You share a Where2Meet link. Both add locations. The map shows 3 bars where you\'d each travel 18-20 minutes. You both vote on the one with the best vibe. Easy, fair, and no awkwardness.',
      },
      walkthrough:
        'Create a date event, add both starting locations (your place and theirs), and set transportation preferences (driving, transit, biking). Where2Meet shows you venues where travel times are equal—coffee shops for casual first dates, restaurants for dinner, bars for drinks. You share the link, they see the options, and you pick together.',
      transportationNote:
        'If one person drives and the other uses transit, Where2Meet shows separate travel times for each mode. You can filter to find spots accessible by both methods.',
    },
    stepByStep: {
      heading: 'How to Plan a Fair Date in 2 Minutes',
      steps: [
        {
          stepNumber: 1,
          title: 'Create Your Date Event',
          description:
            'Set the event: "Coffee Date" or "Dinner Friday" with the time you want to meet. Add your starting location.',
        },
        {
          stepNumber: 2,
          title: 'Share the Link',
          description:
            'Send the event link to your date via text or app. They add their location and transportation preference (driving, transit, etc.).',
          tip: 'Frame it casually: "I found this cool tool that finds fair meeting spots—added my location, just add yours and we can pick a place together!"',
        },
        {
          stepNumber: 3,
          title: 'Review Fair Options Together',
          description:
            'Where2Meet shows venues where travel times are equal. Browse coffee shops, restaurants, or bars, and see each option on the map.',
          tip: 'Look for spots in neighborhoods neither of you frequent—it makes the date feel like an adventure for both.',
        },
        {
          stepNumber: 4,
          title: 'Pick a Spot & Confirm',
          description:
            "Vote on your favorite venue, confirm the time, and you're set. Both people arrive knowing the commute was fair.",
        },
      ],
    },
    bestPractices: {
      heading: 'Pro Tips for Fair Date Planning',
      tips: [
        {
          title: 'Suggest the Tool Early',
          description:
            'Use Where2Meet when setting up the date, not after you\'ve already debated locations. It avoids the "you pick" / "no, you pick" awkwardness.',
        },
        {
          title: 'Frame It as Thoughtful, Not Transactional',
          description:
            'Say: "I want to find somewhere that works equally well for both of us" instead of "I calculated optimal travel times." Romance > logistics.',
        },
        {
          title: 'Explore New Areas Together',
          description:
            'Fair meeting points often land in neighborhoods neither person knows well. Turn this into a positive: "Let\'s try somewhere new for both of us!"',
        },
      ],
      commonMistakes: [
        {
          mistake: 'Obsessing over exact minute-by-minute fairness',
          why: 'A 2-minute difference is negligible. Focus on balance, not perfection.',
          fix: "Look for options where travel times are within 5-10 minutes of each other. That's fair enough.",
        },
        {
          mistake: 'Picking a "fair" location in an unappealing area',
          why: "Fairness matters, but so does vibe. A central parking lot isn't a date spot.",
          fix: 'Filter by venue type (coffee, restaurants, parks) and pick the fairest option among appealing places.',
        },
      ],
    },
    faq: {
      heading: 'Frequently Asked Questions',
      questions: [
        {
          question: 'Is using a planning tool too formal for a first date?',
          answer:
            'Not if you frame it right. Position it as being thoughtful: "I want to pick somewhere fair for both of us." Most people appreciate the consideration—it shows you respect their time.',
        },
        {
          question: 'What if we live in completely different cities?',
          answer:
            'Where2Meet works for cross-city dates. It will suggest meeting spots between cities, often in a town or neighborhood along the route. You can also filter for places with good parking or transit access.',
        },
        {
          question: 'Can I suggest multiple options and let them choose?',
          answer:
            'Yes. Where2Meet shows several fair venues, and you can shortlist your favorites. Share the link and let them vote or add preferences.',
        },
        {
          question: "What if one person has a car and the other doesn't?",
          answer:
            "Set each person's transportation mode separately. Where2Meet will show venues accessible via both methods—e.g., places with parking AND near a train station.",
        },
      ],
    },
    cta: {
      heading: 'Start Your Date on the Right Foot',
      description:
        "Show consideration from the first meetup. Find fair date locations where both people's time is respected.",
      buttonText: 'Plan a Fair Date',
    },
    contentMetadata: createContentMetadata('scenario', 'quarterly'),
    relatedScenarios: ['friends-group-dinner-spot', 'long-distance-friends-reunion'],
  },

  'coworkers-lunch-spot': {
    slug: 'coworkers-lunch-spot',
    seo: {
      title: 'Fair Team Lunch Location – Where to Eat with Coworkers',
      description:
        "Find fair lunch spots for your team where everyone's commute is balanced. Compare travel times and discover restaurants that work for the whole office.",
      keywords: [
        'team lunch location',
        'coworkers lunch spot fair',
        'where to eat with coworkers',
        'office lunch planning',
      ],
      tags: ['work', 'teams', 'lunch', 'coworkers'],
    },
    hero: {
      h1: "Fair Team Lunch Location – Find Where to Eat with Coworkers That's Equal for Everyone",
      subheading:
        'Team lunches where the same people always travel farther kill morale. Find restaurants with balanced commutes for the whole team.',
      problemStatement:
        'When lunch spots favor people near the office or in specific neighborhoods, remote workers and off-site team members feel excluded. Fair lunch planning builds team cohesion.',
    },
    problem: {
      heading: 'Why Team Lunch Planning Is Harder Than It Should Be',
      painPoints: [
        "The same 2-3 restaurants get picked repeatedly because they're near the office",
        "Remote workers or hybrid team members can't join because everything's too far",
        'One person always volunteers their car, making others feel guilty',
        'Budget constraints clash with location constraints—cheap spots are often far',
        'The decision-making process wastes 15 minutes of meeting time every week',
      ],
      realWorldExamples: [
        'Your team of 8 works in a downtown office. The usual lunch spot is walkable for 6 people, but Sarah (works from a satellite office) and Tom (remote that day) would each need 30+ minutes to join. They stop coming. Team bonding suffers.',
        'You\'re organizing a team lunch for distributed coworkers. Half are downtown, half are in the suburbs. You pick a "central" restaurant. Downtown folks walk 10 minutes; suburban folks drive 25 minutes through traffic and struggle to find parking. The lunch feels unequal before anyone orders.',
      ],
      whyMidpointFails:
        'A geographic midpoint works if everyone drives and has similar traffic patterns. But if half your team walks and half drives, or if public transit access varies wildly, the midpoint becomes unfair. Some people get there in 5 minutes; others need 30.',
      whyManualFails:
        'Coordinating team lunches manually means: polling the team (15 minutes), looking up routes for each person (20 minutes), compromising on somewhere mediocre (always), and inevitable stragglers who underestimated travel time. Most teams just default to the same 3 spots.',
      emotionalImpact:
        'When team lunches consistently favor one group (office workers over remote, drivers over transit users, downtown over suburbs), it creates in-groups and out-groups. People stop participating, and the team-building purpose is lost.',
    },
    solution: {
      heading: 'How Where2Meet Finds Fair Team Lunch Spots',
      introduction:
        "Where2Meet calculates travel times from each team member's location—office, home, or current spot—and suggests lunch venues where everyone's commute is roughly equal. Hybrid and remote teams can join without feeling like an afterthought.",
      benefits: [
        'Include remote and hybrid workers by finding genuinely central locations',
        "See each person's travel time and route before committing to a spot",
        'Discover new restaurants in neighborhoods that work for the whole team',
        'Filter by budget, cuisine, or ambiance while maintaining fairness',
        "Vote as a team—everyone's voice is heard, and the decision is transparent",
      ],
      beforeAfterExample: {
        before:
          'Team lead: "Where should we grab lunch?" [10 suggestions in the chat] Team lead: "Let\'s just go to [usual spot]." 2 remote workers: "That\'s too far for me, I\'ll skip." Team lunch: 6 people instead of 8.',
        after:
          'Team lead shares Where2Meet link. All 8 team members add their locations. The map shows 3 restaurants where travel times range from 12-18 minutes. Team votes on their favorite. Everyone shows up. Morale: high.',
      },
      walkthrough:
        "Create a team lunch event, add each person's starting location (office, home, satellite office, remote), and set the transportation mode. Where2Meet shows restaurants where travel times are balanced. The team reviews options, votes, and picks a spot together.",
      transportationNote:
        'If your team uses mixed transportation (some walk, some drive, some take transit), set the filter to public transit to ensure everyone can access the location.',
    },
    stepByStep: {
      heading: 'How to Plan a Fair Team Lunch in 3 Minutes',
      steps: [
        {
          stepNumber: 1,
          title: 'Create the Event',
          description:
            'Set up "Team Lunch Thursday" with the time (e.g., 12:30 PM). Share the link in your team\'s Slack/Teams channel.',
          tip: 'Create a recurring event link if your team does weekly lunches—just update the date each time.',
        },
        {
          stepNumber: 2,
          title: 'Team Members Add Locations',
          description:
            'Everyone adds their starting point: main office, satellite office, home (for remote), or current location.',
          tip: "Encourage hybrid workers to add their location even if they're remote that day—Where2Meet will find spots that work for everyone.",
        },
        {
          stepNumber: 3,
          title: 'Review Fair Options',
          description:
            'Where2Meet shows restaurant suggestions with travel times for each person. Filter by budget, cuisine, or distance.',
          tip: 'Look for spots where the longest commute is ≤20 minutes—beyond that, people start dropping out.',
        },
        {
          stepNumber: 4,
          title: 'Vote & Confirm',
          description:
            'The team votes on their favorite option. Confirm the reservation and send a calendar invite with the address.',
        },
      ],
    },
    bestPractices: {
      heading: 'Pro Tips for Team Lunch Planning',
      tips: [
        {
          title: 'Plan Ahead for Remote Days',
          description:
            "If your team is hybrid, check who's remote before picking a location. Where2Meet automatically includes their home locations in the calculation.",
        },
        {
          title: 'Set a Budget Filter',
          description:
            "Use price range filters to avoid awkward moments where junior team members can't afford the spot seniors suggest.",
        },
        {
          title: 'Rotate Neighborhoods',
          description:
            'Fair meeting points often land in different neighborhoods week-to-week. Embrace the variety—your team will discover new spots.',
        },
      ],
      commonMistakes: [
        {
          mistake: 'Always picking the closest spot to the office',
          why: "This excludes remote workers, people working from satellite offices, or anyone who's not at HQ that day",
          fix: "Use Where2Meet to include everyone's actual location, not just the office",
        },
        {
          mistake: 'Ignoring parking or transit access',
          why: 'A restaurant might be "fair" distance-wise but inaccessible if there\'s no parking or it\'s far from transit',
          fix: 'Check the map view for parking lots and transit stops near suggestions',
        },
      ],
    },
    faq: {
      heading: 'Frequently Asked Questions',
      questions: [
        {
          question: 'What if team members have different dietary restrictions?',
          answer:
            'Where2Meet helps you find fair locations—once you have 2-3 fair options, you can filter by cuisine type or check menus to ensure dietary needs are met.',
        },
        {
          question: 'Can we use this for team dinners or happy hours too?',
          answer:
            'Absolutely. The same logic applies—create an event, add locations, find fair spots. It works for any team gathering.',
        },
        {
          question: 'What if someone is working from a client site that day?',
          answer:
            'They can add their current location (client site) instead of the office. Where2Meet recalculates to include them.',
        },
        {
          question: "How do we handle team members who don't want to share their home address?",
          answer:
            'They can use a nearby intersection or landmark instead of their exact address. The calculation is accurate enough with approximate locations.',
        },
      ],
    },
    cta: {
      heading: 'Make Team Lunches Fair for Everyone',
      description:
        'Stop excluding remote workers and favoring office proximity. Find lunch spots that work for the whole team.',
      buttonText: 'Plan Your Team Lunch',
    },
    contentMetadata: createContentMetadata('scenario', 'quarterly'),
    relatedScenarios: ['friends-group-dinner-spot', 'remote-team-offsite-planning'],
  },

  'group-weekend-hangout': {
    slug: 'group-weekend-hangout',
    seo: {
      title: 'Weekend Meetup Location – Fair Hangout Spots for Friend Groups',
      description:
        "Planning weekend activities with friends? Find fair meetup locations for coffee, parks, activities, or shopping where everyone's travel time is balanced.",
      keywords: [
        'weekend meetup location',
        'where to hang out with friends group',
        'central spot for group',
        'fair weekend plans',
      ],
      tags: ['friends', 'weekend', 'activities', 'social'],
    },
    hero: {
      h1: 'Weekend Meetup Location – Find Fair Hangout Spots for Friend Groups',
      subheading:
        'Planning weekend coffee, park visits, or activities? Stop defaulting to the same spot. Find locations that work equally well for everyone.',
      problemStatement:
        "Weekend plans shouldn't favor whoever lives closest to downtown. Fair meeting spots keep everyone engaged and prevent the same friends from always bearing the travel burden.",
    },
    problem: {
      heading: 'Why Weekend Planning Falls Into the Same Patterns',
      painPoints: [
        'The group defaults to the same 2-3 spots because planning feels exhausting',
        'Friends living farther out gradually stop suggesting ideas or showing up',
        'Someone always says "I don\'t care, anywhere works" (but they do care)',
        "Car-dependent friends can't join activities in urban areas; transit users struggle with suburban spots",
        'Weekend plans die in a group chat full of "what about here?" messages',
      ],
      realWorldExamples: [
        'Your friend group wants to grab weekend brunch. As usual, you pick a spot downtown because most people live nearby. But Emma (suburbs) and Jordan (different neighborhood) each spend 35+ minutes getting there while others walk 10. After a few weekends, Emma stops coming—"it\'s just too far every time."',
        "You're planning a Saturday park hangout. Half the group wants a park near downtown (easy for them); the other half wants a suburban park (more space, easier parking). You compromise on a spot. Both groups spend 30 minutes getting there. Nobody's happy.",
      ],
      whyMidpointFails:
        "A geographic midpoint for weekend activities might land in an industrial zone, a highway exit, or a residential area with nothing to do. Fairness isn't just about distance—it's about accessibility, things to do, and making the trip worthwhile.",
      whyManualFails:
        'Manually planning weekend meetups means: suggesting a spot, waiting for everyone to check their routes, getting pushback, suggesting another spot, repeating 5+ times, and eventually settling on the most convenient option (for whoever speaks up first).',
      emotionalImpact:
        'When weekend plans consistently favor one part of the group, others feel like an afterthought. Eventually, they stop suggesting ideas or just skip. The group shrinks, and the vibe changes.',
    },
    solution: {
      heading: 'How Where2Meet Finds Fair Weekend Hangout Spots',
      introduction:
        "Where2Meet calculates travel times from everyone's location and suggests meetup spots—coffee shops, parks, shopping areas, entertainment venues—where commutes are balanced. Discover new places while keeping the group together.",
      benefits: [
        'Find coffee shops, parks, or activity spots that are fair for everyone',
        'See actual travel times for each person, not just "it\'s kinda central"',
        "Discover neighborhoods and venues the group hasn't explored yet",
        'Filter by activity type: parks, cafes, shopping, museums, entertainment',
        'Vote as a group so everyone has input—no more defaulting to the same spot',
      ],
      beforeAfterExample: {
        before:
          'Group chat: "Where should we meet Saturday?" [8 suggestions, 20 messages] Someone: "Let\'s just do [usual spot] again." Two friends quietly don\'t show up because it\'s too far.',
        after:
          'Share Where2Meet link. Everyone adds their location. The map shows 4 options (coffee shop, park, shopping district) where travel times range from 15-20 minutes. Group votes on a park none of you have visited. Everyone shows up excited to explore somewhere new.',
      },
      walkthrough:
        "Create a weekend hangout event, add everyone's starting location (usually home on weekends), and choose the activity type (coffee, park, shopping, etc.). Where2Meet shows options where travel times are balanced. Review together, vote, and confirm.",
      transportationNote:
        'Weekend plans often involve mixed transportation. Some friends drive (easier parking on weekends), others take transit or bike. Set the filter to ensure your chosen spot is accessible by all methods.',
    },
    stepByStep: {
      heading: 'How to Plan a Fair Weekend Meetup in 3 Minutes',
      steps: [
        {
          stepNumber: 1,
          title: 'Create Weekend Hangout Event',
          description:
            'Set up "Saturday Coffee" or "Park Hangout" with the meetup time. Share the link in your group chat.',
          tip: 'Weekend plans are more flexible—add a time range (e.g., 2-4 PM) so people can see arrival options.',
        },
        {
          stepNumber: 2,
          title: 'Everyone Adds Home Locations',
          description:
            "Friends add their home addresses (or wherever they're coming from on the weekend). Choose transportation mode.",
          tip: 'Most people have more flexibility on weekends—ask if anyone wants to explore a new neighborhood.',
        },
        {
          stepNumber: 3,
          title: 'Review Fair Options by Activity',
          description:
            'Where2Meet shows coffee shops, parks, or activity venues where travel times are balanced. Filter by type.',
          tip: 'Look for options in neighborhoods nobody knows well—it makes the hangout feel like an adventure.',
        },
        {
          stepNumber: 4,
          title: 'Vote & Explore Together',
          description:
            'Group votes on the best option. Confirm and share any parking/transit tips. Show up and enjoy!',
        },
      ],
    },
    bestPractices: {
      heading: 'Pro Tips for Weekend Group Hangouts',
      tips: [
        {
          title: 'Rotate Neighborhoods',
          description:
            'Instead of defaulting to downtown, use Where2Meet to discover neighborhoods that work for different parts of your group. Everyone gets to explore new areas.',
        },
        {
          title: 'Consider Parking on Weekends',
          description:
            'Weekend parking availability changes everything. Check the map for parking lots or street parking near your chosen spot.',
        },
        {
          title: 'Combine Activities',
          description:
            "Find a fair location with multiple options nearby (coffee + park + shops) so the group can extend the hangout if everyone's having fun.",
        },
      ],
      commonMistakes: [
        {
          mistake: 'Always picking the most convenient spot for you',
          why: 'Your friends notice if weekend plans always favor your neighborhood—it feels selfish over time',
          fix: "Use Where2Meet to find genuinely fair spots, even if they're not near you",
        },
        {
          mistake: 'Picking activities that exclude car-free friends',
          why: 'Suburban malls and parks are great if you drive, but impossible for transit users',
          fix: 'Filter for spots accessible by multiple transportation modes',
        },
      ],
    },
    faq: {
      heading: 'Frequently Asked Questions',
      questions: [
        {
          question: 'What if we want to do multiple activities in one day?',
          answer:
            'Find a fair central neighborhood with multiple options nearby (parks, coffee, restaurants, shops). The group can move between activities without anyone needing to drive far.',
        },
        {
          question: 'Can we plan recurring weekend meetups?',
          answer:
            "Yes. Save the event and update it each week. Where2Meet remembers everyone's locations so you can quickly find new fair spots to explore.",
        },
        {
          question: 'What if someone wants to bring kids or pets?',
          answer:
            'Filter for parks with playgrounds or dog-friendly areas. Where2Meet helps you find fair locations, and you can refine by amenities.',
        },
        {
          question: 'How do we handle bad weather backups?',
          answer:
            'Create two events: one for outdoor plans (park) and one for indoor backup (coffee shop, mall). Share both links so the group can pivot if needed.',
        },
      ],
    },
    cta: {
      heading: 'Stop Defaulting to the Same Spot Every Weekend',
      description:
        'Discover new neighborhoods and keep everyone in the group engaged. Find fair hangout locations in minutes.',
      buttonText: 'Plan Your Weekend Hangout',
    },
    contentMetadata: createContentMetadata('scenario', 'quarterly'),
    relatedScenarios: ['friends-group-dinner-spot', 'date-night-equal-distance'],
  },

  'family-reunion-location-finder': {
    slug: 'family-reunion-location-finder',
    seo: {
      title: 'Family Reunion Location Planner – Fair Venues for Extended Family',
      description:
        "Planning a family reunion across cities or states? Find fair central venues where everyone's travel burden is balanced. Compare travel times for extended family.",
      keywords: [
        'family reunion location planner',
        'fair venue extended family',
        'family gathering location finder',
        'central family reunion spot',
      ],
      tags: ['family', 'reunion', 'gatherings', 'events'],
    },
    hero: {
      h1: 'Family Reunion Location Planner – Find Fair Venues for Extended Family Gatherings',
      subheading:
        'Stop making the same relatives travel hours while others drive 20 minutes. Find reunion venues that balance travel for everyone.',
      problemStatement:
        "Family reunions work best when nobody feels burdened by distance. Fair venue selection shows you value everyone's time—not just those who live closest to the organizer.",
    },
    problem: {
      heading: 'Why Family Reunion Planning Is So Stressful',
      painPoints: [
        'One branch of the family always hosts, making others travel farther every year',
        'Elderly relatives or those with young kids struggle with long drives',
        'Debates over location create family tension before the reunion even starts',
        'Someone always cancels because "it\'s just too far this time"',
        'The organizer feels guilty picking a spot that favors some relatives over others',
      ],
      realWorldExamples: [
        "Your extended family is spread across 3 states. Every year, Aunt Mary hosts at her place (convenient for her kids, 4-hour drive for others). After years of this, half the family stops coming. Mary feels hurt, but she didn't realize the burden she was placing on distant relatives.",
        "You're organizing a reunion for 30 family members across 5 cities. You pick a \"central\" location based on the map. But Grandma (doesn't drive) would need a 3-hour bus ride, while your cousins (driving) get there in 45 minutes. Grandma can't make it. The reunion feels incomplete.",
      ],
      whyMidpointFails:
        "A geographic midpoint between multiple cities might land in a small town with no suitable venues, limited hotels, or poor accessibility for elderly relatives. Central doesn't mean practical.",
      whyManualFails:
        "Manually coordinating a reunion means: creating a spreadsheet of everyone's locations, googling drive times for dozens of combinations, debating venues, and hoping you didn't miss anyone. It takes weeks and breeds resentment.",
      emotionalImpact:
        'When reunion locations consistently favor one part of the family, others feel undervalued. Attendance drops. Family bonds weaken. The organizer burns out from guilt and logistics.',
    },
    solution: {
      heading: 'How Where2Meet Finds Fair Family Reunion Venues',
      introduction:
        "Where2Meet calculates travel times from each family member's location and suggests venues—hotels, parks, event spaces, restaurants—where travel burden is balanced. Include everyone without exhausting the organizer.",
      benefits: [
        'See travel times for all family members before committing to a venue',
        'Find locations accessible by car, plane, train—crucial for elderly relatives',
        "Discover cities or towns in between that work better than anyone's hometown",
        'Filter by venue type: hotels with event space, parks, restaurants, community centers',
        'Share the link so family can vote—everyone feels heard, reducing pre-reunion tension',
      ],
      beforeAfterExample: {
        before:
          'Organizer emails: "Reunion at my place again?" 10 relatives: "That\'s too far for us." Organizer: "Where else?" [30 emails, no consensus, half the family doesn\'t respond]',
        after:
          'Organizer shares Where2Meet link. 30 family members add their locations. The map shows a city in between with 3 hotel venues where travel times range from 90-120 minutes. Family votes. Everyone commits. Attendance: highest in years.',
      },
      walkthrough:
        'Create a reunion event, share the link with all family members, and ask them to add their home locations. Where2Meet shows venues (hotels, parks, event spaces) where travel is balanced. Filter by amenities (parking, accessibility, kid-friendly) and let the family vote.',
      transportationNote:
        'Family reunions often require mixed transportation (driving, flying, train). Where2Meet helps you find venues near airports or with good highway access so everyone can get there.',
    },
    stepByStep: {
      heading: 'How to Plan a Fair Family Reunion in 4 Steps',
      steps: [
        {
          stepNumber: 1,
          title: 'Create Reunion Event & Share Link',
          description:
            'Set up "Family Reunion 2025" with potential dates. Email or text the link to all family branches.',
          tip: 'Include a note explaining fairness: "Let\'s find a spot that works equally well for everyone!"',
        },
        {
          stepNumber: 2,
          title: 'Family Members Add Locations',
          description:
            'Each household adds their home city/address. Choose transportation mode (driving, flying, etc.).',
          tip: "For elderly relatives or those who don't drive, have someone help them add their location.",
        },
        {
          stepNumber: 3,
          title: 'Review Fair Venue Options',
          description:
            'Where2Meet shows hotels, parks, or event venues where travel times are balanced. Filter by amenities.',
          tip: 'Look for venues with kid-friendly areas, accessibility for elderly relatives, and nearby hotels.',
        },
        {
          stepNumber: 4,
          title: 'Family Votes & Books',
          description:
            'Let the family vote on top 2-3 options. Once decided, book the venue and send details to everyone.',
          tip: 'Share hotel recommendations near the venue for out-of-town relatives.',
        },
      ],
    },
    bestPractices: {
      heading: 'Pro Tips for Family Reunion Planning',
      tips: [
        {
          title: 'Rotate Fairness Across Years',
          description:
            "Use Where2Meet to find a different fair location each year, so no one branch always travels farther. This year's reunion might favor the east coast; next year, the midwest.",
        },
        {
          title: 'Consider Accessibility Needs',
          description:
            'Filter for venues with wheelchair access, nearby hotels, and minimal walking for elderly relatives or those with young kids.',
        },
        {
          title: 'Plan Around Major Holidays',
          description:
            'Avoid holiday weekends when travel is expensive. Where2Meet helps you find fair spots year-round.',
        },
      ],
      commonMistakes: [
        {
          mistake: "Always hosting at the same relative's place",
          why: "Convenience for the host doesn't mean fairness for everyone else—distant relatives stop coming",
          fix: 'Rotate locations based on fair travel times, not familiarity',
        },
        {
          mistake: 'Picking a venue without checking accessibility',
          why: "Elderly relatives or those with disabilities can't participate if the venue isn't accessible",
          fix: 'Check map view for parking, nearby hotels, and accessibility features',
        },
      ],
    },
    faq: {
      heading: 'Frequently Asked Questions',
      questions: [
        {
          question: 'What if family members are flying in from far away?',
          answer:
            'Set their transportation mode to "flying" and Where2Meet will prioritize venues near airports. You can see which cities work best for both drivers and flyers.',
        },
        {
          question: 'Can we find venues with lodging for out-of-town family?',
          answer:
            'Yes. Filter for hotels with event spaces, or find a central location and share nearby hotel recommendations.',
        },
        {
          question: "How do we handle family members who can't travel at all?",
          answer:
            "Focus on finding the fairest venue for those who can attend. For those who can't, share photos/video during the reunion to keep them included.",
        },
        {
          question: 'What if the family is split across the entire country?',
          answer:
            'Where2Meet will suggest central cities (e.g., Chicago for east/west coast families, Dallas for north/south). You might discover a city nobody considered that works for everyone.',
        },
      ],
    },
    cta: {
      heading: 'Bring the Whole Family Together—Fairly',
      description:
        'Stop making the same relatives travel hours while others barely leave home. Find reunion venues that work for everyone.',
      buttonText: 'Plan Your Family Reunion',
    },
    contentMetadata: createContentMetadata('scenario', 'quarterly'),
    relatedScenarios: ['remote-team-offsite-planning', 'long-distance-friends-reunion'],
  },

  'remote-team-offsite-planning': {
    slug: 'remote-team-offsite-planning',
    seo: {
      title: 'Remote Team Offsite Location – Fair Venues for Distributed Teams',
      description:
        "Planning a remote team offsite or retreat? Find fair central locations where everyone's travel time is balanced. Compare routes for distributed teams.",
      keywords: [
        'remote team offsite location',
        'distributed team retreat planning',
        'remote team gathering venue',
        'hybrid team meetup spot',
      ],
      tags: ['remote work', 'teams', 'offsites', 'business'],
    },
    hero: {
      h1: 'Remote Team Offsite Location – Find Fair Venues for Distributed Teams',
      subheading:
        "Quarterly offsites shouldn't favor team members near HQ. Find retreat venues where everyone's travel burden is equal—building team cohesion, not resentment.",
      problemStatement:
        'Remote teams thrive on in-person connection, but unfair offsite locations undermine that goal. Fair venue selection shows you value all team members equally, regardless of where they live.',
    },
    problem: {
      heading: 'Why Remote Team Offsites Miss the Mark',
      painPoints: [
        'HQ-centric locations require remote workers to fly cross-country while locals drive 30 minutes',
        "International team members can't attend because venues are always in one country",
        'Budget gets blown on travel instead of the actual offsite experience',
        'Team members arrive exhausted from long journeys, killing the collaborative energy',
        'The planning process takes months and still ends up unfair',
      ],
      realWorldExamples: [
        'Your 20-person remote team spans San Francisco, Austin, and New York. The offsite is always in SF (near HQ). SF-based folks drive 20 minutes; Austin/NY folks fly 5+ hours and arrive jetlagged. The "team bonding" feels forced when half the team is exhausted.',
        "You're planning a hybrid team retreat. 10 people work from the office in Seattle; 10 are fully remote across the US. You pick a Seattle venue (easy for office workers). Remote folks spend $800+ on flights and full travel days. Two people can't afford it and don't come. Team cohesion suffers.",
      ],
      whyMidpointFails:
        'A geographic midpoint for a distributed team might land in a random city with no airport, limited hotels, or zero team-friendly venues. Central location ≠ practical offsite venue.',
      whyManualFails:
        "Manually planning team offsites means: polling everyone's locations, researching venues in multiple cities, comparing flight costs, and still ending up with complaints. Most teams default to HQ and exclude remote workers.",
      emotionalImpact:
        'When offsites consistently favor one location (usually HQ), remote workers feel like second-class team members. Attendance drops. The team-building investment is wasted.',
    },
    solution: {
      heading: 'How Where2Meet Finds Fair Remote Team Offsite Venues',
      introduction:
        "Where2Meet calculates travel times from each team member's location—accounting for flights, drives, and trains—and suggests offsite venues where travel burden is balanced. Build a cohesive team without burning remote workers out.",
      benefits: [
        'Include all team members by finding genuinely central locations',
        'See travel times (and costs) for each person before booking',
        "Discover cities that work better than HQ or anyone's hometown",
        'Filter by venue type: hotels with meeting space, retreat centers, coworking spaces',
        'Reduce travel budget waste by minimizing total team travel time',
      ],
      beforeAfterExample: {
        before:
          'HR: "Offsite at HQ again?" Remote team: "That\'s a 6-hour flight for half of us..." HR: "Where else?" [No good answer. Offsite happens at HQ. Attendance: 60%.]',
        after:
          'HR shares Where2Meet link. 20 team members add locations. The map shows Denver as a fair central location (2-3 hour flights for everyone). Book a retreat center. Attendance: 95%. Team morale: all-time high.',
      },
      walkthrough:
        'Create an offsite event, share with the team, and have everyone add their home location. Where2Meet shows cities and venues where travel times (by plane, train, or car) are balanced. Filter by budget and amenities, then book.',
      transportationNote:
        'For distributed teams, set transportation mode to "flying" for accurate offsite planning. Where2Meet will prioritize cities with good airport access.',
    },
    stepByStep: {
      heading: 'How to Plan a Fair Team Offsite in 4 Steps',
      steps: [
        {
          stepNumber: 1,
          title: 'Create Offsite Event',
          description:
            'Set up "Q2 Team Offsite" with potential dates (2-3 day window). Share the link with all team members.',
          tip: 'Add a budget note so the team knows approximate travel cost limits.',
        },
        {
          stepNumber: 2,
          title: 'Team Adds Home Locations',
          description:
            'Each team member adds their home city/airport. Choose "flying" as transportation mode for accurate results.',
          tip: 'For international teams, note time zones so you can plan arrival days accordingly.',
        },
        {
          stepNumber: 3,
          title: 'Review Fair Venue Cities',
          description:
            'Where2Meet shows cities where total team travel time is minimized. Filter by venue type and amenities.',
          tip: 'Look for cities with direct flights from most team member locations—reduces travel time and cost.',
        },
        {
          stepNumber: 4,
          title: 'Book & Coordinate',
          description:
            'Once the team agrees on a city, book the venue and share travel booking deadlines. Coordinate airport pickups if needed.',
        },
      ],
    },
    bestPractices: {
      heading: 'Pro Tips for Team Offsite Planning',
      tips: [
        {
          title: 'Rotate Locations Annually',
          description:
            'Use Where2Meet to find a different fair location each year. This year might favor west coast; next year, east coast. Fairness over time matters.',
        },
        {
          title: 'Budget for Travel Equity',
          description:
            "If one person still has a significantly longer journey, offer to cover their extra travel costs. Fairness isn't just about time—it's about respect.",
        },
        {
          title: 'Plan 3-6 Months Ahead',
          description:
            'Fair offsite locations often require advance booking (hotels, venues). Plan early so team members can book affordable flights.',
        },
      ],
      commonMistakes: [
        {
          mistake: 'Always holding offsites at or near HQ',
          why: 'This alienates remote workers and makes them feel less valued than in-office employees',
          fix: 'Use Where2Meet to find fair central locations, rotating annually',
        },
        {
          mistake: 'Ignoring international team members',
          why: 'If your team spans multiple countries, always picking US venues excludes international colleagues',
          fix: 'Occasionally plan offsites in international-friendly locations (e.g., Mexico City for US/LATAM teams)',
        },
      ],
    },
    faq: {
      heading: 'Frequently Asked Questions',
      questions: [
        {
          question: 'What if our team spans multiple countries?',
          answer:
            'Where2Meet can show fair locations across borders. For US/Europe teams, consider cities like London or Lisbon. For US/LATAM, consider Mexico City or Austin.',
        },
        {
          question: "How do we handle team members who can't travel?",
          answer:
            "Focus on fairness for those who can attend. For those who can't, offer virtual participation options (live stream key sessions).",
        },
        {
          question: 'Can we combine the offsite with a client visit?',
          answer:
            "Yes. Use Where2Meet to find a fair location that's also near key clients. Multi-purpose offsites maximize ROI.",
        },
        {
          question: 'How do we balance cost and fairness?',
          answer:
            "Where2Meet shows travel times; you'll need to check flight costs separately. But by minimizing total travel time, you usually reduce costs too.",
        },
      ],
    },
    cta: {
      heading: 'Build a Cohesive Remote Team with Fair Offsites',
      description:
        'Stop excluding remote workers with HQ-centric offsites. Find retreat venues that show you value everyone equally.',
      buttonText: 'Plan Your Team Offsite',
    },
    contentMetadata: createContentMetadata('scenario', 'quarterly'),
    relatedScenarios: ['coworkers-lunch-spot', 'family-reunion-location-finder'],
  },

  'cross-city-client-meetings': {
    slug: 'cross-city-client-meetings',
    seo: {
      title: 'Client Meeting Between Cities – Fair Business Meeting Locations',
      description:
        'Meeting clients from different cities? Find fair central business meeting locations where travel time is balanced. Show respect from the first meeting.',
      keywords: [
        'client meeting between cities',
        'business meeting location two cities',
        'fair client meeting venue',
        'professional meeting midpoint',
      ],
      tags: ['business', 'clients', 'meetings', 'professional'],
    },
    hero: {
      h1: 'Client Meeting Between Cities – Find Fair Business Meeting Locations',
      subheading:
        "Meeting a client from another city? Picking a venue that respects both parties' time builds trust and shows professionalism from the start.",
      problemStatement:
        'Asking a client to travel 3 hours while you drive 30 minutes sends the wrong message. Fair business meeting locations demonstrate that you value their time as much as your own.',
    },
    problem: {
      heading: 'Why Cross-City Client Meetings Feel Unbalanced',
      painPoints: [
        'You suggest your city (convenient for you, burdensome for them)—feels presumptuous',
        'They suggest their city (convenient for them, costly for you)—you feel undervalued',
        'The "let\'s meet in the middle" conversation drags on for days',
        'Someone ends up traveling 2x farther, creating subtle power imbalance from day one',
        'Travel costs and time eat into the ROI of the meeting',
      ],
      realWorldExamples: [
        'You\'re an account manager in Austin meeting a new client in Dallas (3.5-hour drive). They suggest Dallas. You suggest Austin. After 5 emails, you "compromise" on Dallas—meaning you drive 3.5 hours while they drive 15 minutes. The meeting starts with you exhausted and them relaxed. Not a great dynamic.',
        "You're pitching a partnership to a company in another city. You suggest meeting halfway. You pick a random town based on the map. It's 90 minutes for you (easy drive) and 2 hours for them (rural roads, no hotels if the meeting runs long). They agree but arrive frustrated. The pitch doesn't land.",
      ],
      whyMidpointFails:
        'A geographic midpoint between cities might be a small town with no professional venues, limited dining options, and poor highway access. "Central" doesn\'t mean appropriate for business.',
      whyManualFails:
        "Manually coordinating client meetings means: suggesting locations, checking their calendar, debating travel logistics, and hoping nobody feels slighted. Most people just default to whoever has more power—which doesn't build partnership.",
      emotionalImpact:
        'When one party consistently travels farther for business meetings, it signals a power imbalance. Clients feel undervalued. Sales reps feel like supplicants. Fair meeting locations set the tone for an equitable relationship.',
    },
    solution: {
      heading: 'How Where2Meet Finds Fair Client Meeting Locations',
      introduction:
        'Where2Meet calculates travel times from both cities and suggests professional meeting venues—hotels with conference rooms, coworking spaces, restaurants—where commutes are balanced. Build client relationships on mutual respect.',
      benefits: [
        'Show professionalism by suggesting a genuinely fair location',
        'See actual travel times for both parties before proposing a venue',
        'Discover cities in between with better business amenities than either hometown',
        'Filter by venue type: hotel conference rooms, coworking spaces, upscale restaurants',
        "Demonstrate respect for the client's time—building trust from the first interaction",
      ],
      beforeAfterExample: {
        before:
          'You: "Want to meet in Austin?" Client: "That\'s far for me..." You: "Dallas then?" Client: "That\'s far for you..." [Week of emails, no decision, meeting gets pushed back]',
        after:
          'You share Where2Meet link. Both add locations. The map shows a city midway with 2 hotel venues where you\'d each drive 90 minutes. You propose it. Client responds: "Perfect—shows you value my time." Meeting confirmed.',
      },
      walkthrough:
        "Create a meeting event, add both locations (your office/city and client's office/city), and choose transportation mode. Where2Meet shows cities and venues where travel is balanced. Share options with the client and confirm.",
      transportationNote:
        'For cross-city meetings, some people drive, others fly. Where2Meet lets you set different modes per person to find venues accessible by both methods.',
    },
    stepByStep: {
      heading: 'How to Plan a Fair Client Meeting in 3 Minutes',
      steps: [
        {
          stepNumber: 1,
          title: 'Create Meeting Event',
          description:
            'Set up "Q1 Partnership Meeting" with proposed dates/times. Add your city/office location.',
        },
        {
          stepNumber: 2,
          title: 'Share Link with Client',
          description:
            'Send the event link via email: "I\'d love to find a location that works equally well for both of us." They add their location.',
          tip: 'Frame it as courtesy: "I want to be respectful of your time" builds goodwill immediately.',
        },
        {
          stepNumber: 3,
          title: 'Review Fair Venue Options Together',
          description:
            'Where2Meet shows professional venues (hotels, coworking spaces) where travel times are balanced. Filter by amenities.',
          tip: 'Look for venues with good WiFi, AV equipment, and nearby dining for post-meeting meals.',
        },
        {
          stepNumber: 4,
          title: 'Confirm & Book',
          description:
            'Once both parties agree, book the conference room and send calendar invites with venue details.',
        },
      ],
    },
    bestPractices: {
      heading: 'Pro Tips for Client Meeting Planning',
      tips: [
        {
          title: 'Suggest Fairness Upfront',
          description:
            "Don't wait for the client to suggest a location. Proactively offer Where2Meet to show you value their time. This builds trust.",
        },
        {
          title: 'Consider Overnight Options',
          description:
            'If the meeting is early morning or full-day, find a city with good hotels so both parties can arrive the night before refreshed.',
        },
        {
          title: 'Follow Up with Hospitality',
          description:
            'If the client still travels slightly farther, offer to cover their meal or parking. Small gestures reinforce fairness.',
        },
      ],
      commonMistakes: [
        {
          mistake: 'Always suggesting your city for client meetings',
          why: "Clients notice if you never meet them halfway—it signals you don't value their time",
          fix: 'Use Where2Meet to find fair locations, alternating if you meet regularly',
        },
        {
          mistake: 'Picking fair locations with terrible amenities',
          why: "A midpoint diner might be fair, but it's not professional—venue quality matters",
          fix: 'Filter for business-appropriate venues: hotels, coworking spaces, upscale restaurants',
        },
      ],
    },
    faq: {
      heading: 'Frequently Asked Questions',
      questions: [
        {
          question: 'What if the client insists on meeting at their office?',
          answer:
            "Some clients prefer their turf—that's fine. But for initial meetings or ongoing partnerships, suggesting a fair location shows initiative and respect.",
        },
        {
          question: 'Can we find venues with conference room amenities?',
          answer:
            'Yes. Filter for hotels with business centers or coworking spaces with meeting rooms. Many offer day passes for professional meetings.',
        },
        {
          question: 'What if one person is flying and the other driving?',
          answer:
            "Set each person's transportation mode separately. Where2Meet will prioritize cities with airports and good highway access.",
        },
        {
          question: 'How do we handle multiple stakeholders from each company?',
          answer:
            'Add all locations for your team and their team. Where2Meet calculates based on total travel time for all participants.',
        },
      ],
    },
    cta: {
      heading: 'Build Client Relationships on Mutual Respect',
      description:
        'Stop asking clients to bear the travel burden. Find fair meeting locations that show you value their time.',
      buttonText: 'Plan Your Client Meeting',
    },
    contentMetadata: createContentMetadata('scenario', 'quarterly'),
    relatedScenarios: ['remote-team-offsite-planning', 'date-night-equal-distance'],
  },

  'long-distance-friends-reunion': {
    slug: 'long-distance-friends-reunion',
    seo: {
      title: 'Meeting Friends from Different Cities – Fair Reunion Locations',
      description:
        "Reuniting with friends across cities or states? Find fair central locations where everyone's travel time is balanced. Plan long-distance friend meetups easily.",
      keywords: [
        'meeting friends from different cities',
        'long distance friends meetup',
        'central city for friends',
        'friend reunion location',
      ],
      tags: ['friends', 'reunions', 'travel', 'long-distance'],
    },
    hero: {
      h1: 'Meeting Friends from Different Cities – Find Fair Reunion Locations',
      subheading:
        'College friends scattered across the country? Childhood friends in different states? Find reunion locations that are actually fair for everyone.',
      problemStatement:
        'Long-distance friendships survive when everyone makes equal effort. Reunion locations that favor some friends over others slowly erode those bonds.',
    },
    problem: {
      heading: 'Why Long-Distance Friend Reunions Are So Hard to Plan',
      painPoints: [
        'The friend with the "coolest" city always hosts, making others travel 5+ hours every time',
        "Someone always can't afford the flight to wherever you picked",
        'Coordinating across time zones and schedules feels impossible',
        'Group chats devolve into "I can\'t make it there" messages',
        'Reunions stop happening because planning feels too hard',
      ],
      realWorldExamples: [
        'Your college friend group is spread across SF, Chicago, Boston, and Austin. Every reunion is in SF (coolest city, where most people want to visit). But Austin/Chicago friends spend $400+ on flights and travel days. After 3 reunions, they stop coming. The group fractures.',
        "You're planning a reunion for 6 childhood friends now living in 6 different states. Someone suggests their hometown. Others protest—it's a $600 flight and 8 hours of travel. You compromise on a \"central\" city. Three people can afford it; three can't. Reunion attendance: 50%.",
      ],
      whyMidpointFails:
        'A geographic midpoint for friends across the country might land in the middle of nowhere—no airport, limited hotels, nothing to do. Fair location ≠ fun reunion destination.',
      whyManualFails:
        'Manually planning cross-country reunions means: polling availability, checking flight costs, debating cities, and inevitable dropouts. Most friend groups give up and just meet whoever can make it to [popular city].',
      emotionalImpact:
        'When reunions consistently favor the same friends (those in big cities, those with money, those with flexible schedules), others feel left behind. The group shrinks. Friendships fade.',
    },
    solution: {
      heading: 'How Where2Meet Finds Fair Long-Distance Reunion Locations',
      introduction:
        "Where2Meet calculates travel times (flights + drives) from each friend's city and suggests reunion destinations where travel burden is balanced. Keep the whole group together without favoring anyone.",
      benefits: [
        "Find cities where everyone's flight + travel time is roughly equal",
        'Discover new reunion destinations nobody would have thought of',
        'See actual travel options (direct flights, drive times) before committing',
        'Filter by activities: beach cities, mountain towns, cultural hubs',
        'Vote as a group so nobody feels excluded from the decision',
      ],
      beforeAfterExample: {
        before:
          'Group chat: "Let\'s reunite!" [50 messages] "SF again?" "Too expensive for me..." "How about Chicago?" "I can\'t get time off for that flight..." [Reunion doesn\'t happen]',
        after:
          'Share Where2Meet link. 6 friends add locations. The map shows Nashville as a fair midpoint (2-3 hour flights for everyone, direct flights from all cities, affordable Airbnbs). Group votes yes. Reunion happens. Attendance: 100%.',
      },
      walkthrough:
        'Create a reunion event, share the link with all friends, and have everyone add their city. Where2Meet shows cities where total travel time (flights + ground transport) is balanced. Filter by vibe (beach, city, mountains) and vote together.',
      transportationNote:
        'For long-distance reunions, most people fly. Set transportation mode to "flying" and Where2Meet will prioritize cities with good airport access and affordable flight options.',
    },
    stepByStep: {
      heading: 'How to Plan a Long-Distance Reunion in 4 Steps',
      steps: [
        {
          stepNumber: 1,
          title: 'Create Reunion Event',
          description:
            'Set up "College Reunion 2025" with flexible date range (helps with flight booking). Share link with the group.',
          tip: 'Lead with: "Let\'s find somewhere fair for everyone!"—sets collaborative tone.',
        },
        {
          stepNumber: 2,
          title: 'Everyone Adds Their City',
          description:
            'Friends add their home cities/airports. Choose "flying" as transportation mode.',
          tip: 'Have someone collect responses if not everyone is active in the group chat.',
        },
        {
          stepNumber: 3,
          title: 'Review Fair Reunion Cities',
          description:
            'Where2Meet shows cities where total travel time is minimized. Filter by vibe, budget, and activities.',
          tip: 'Look for cities with affordable Airbnbs and fun group activities (food tours, hiking, nightlife).',
        },
        {
          stepNumber: 4,
          title: 'Vote, Book, & Coordinate',
          description:
            'Group votes on top 2-3 options. Once decided, book lodging and coordinate flight booking deadlines.',
        },
      ],
    },
    bestPractices: {
      heading: 'Pro Tips for Friend Reunion Planning',
      tips: [
        {
          title: 'Rotate Locations to Stay Fair Over Time',
          description:
            "Use Where2Meet to find a different fair city each reunion. This year's location might favor east coast; next year, west coast.",
        },
        {
          title: 'Consider Budget Diversity',
          description:
            'If some friends have more money than others, pick cities with a range of accommodation options (hostels + hotels).',
        },
        {
          title: 'Build in Arrival/Departure Flexibility',
          description:
            'Some friends will want to arrive early or stay late. Pick cities with enough to do so extra days feel worth it.',
        },
      ],
      commonMistakes: [
        {
          mistake: 'Always picking the "coolest" city',
          why: 'Cool cities (NYC, SF, LA) are expensive and far for most people—favor friends who live there',
          fix: 'Use Where2Meet to find fair cities, even if they\'re less "cool"—the reunion matters, not the destination',
        },
        {
          mistake: 'Ignoring flight costs when picking locations',
          why: 'A city might be fair travel-time-wise but unaffordable flight-wise for some friends',
          fix: 'After finding fair cities on Where2Meet, check flight costs separately before finalizing',
        },
      ],
    },
    faq: {
      heading: 'Frequently Asked Questions',
      questions: [
        {
          question: 'What if friends are spread across multiple countries?',
          answer:
            'Where2Meet can help find international reunion spots. For US/Europe friends, consider cities like London or Reykjavik. For US/Asia, consider Hawaii or West Coast cities.',
        },
        {
          question: "How do we handle friends who can't afford to travel?",
          answer:
            'Pick an affordable fair location, and consider group-funding travel for friends who need help. Some friend groups create a reunion fund everyone contributes to.',
        },
        {
          question: 'Can we plan recurring reunions with the same fair system?',
          answer:
            'Yes. Save the event and rotate cities each year based on fairness. Where2Meet remembers locations so planning future reunions is faster.',
        },
        {
          question: 'What if some friends want to bring partners or kids?',
          answer:
            "Add their locations too if they're traveling separately. Filter for family-friendly cities with parks, attractions, and spacious Airbnbs.",
        },
      ],
    },
    cta: {
      heading: 'Keep Long-Distance Friendships Alive',
      description:
        'Stop letting geography fracture your friend group. Find reunion locations that work for everyone.',
      buttonText: 'Plan Your Friends Reunion',
    },
    contentMetadata: createContentMetadata('scenario', 'quarterly'),
    relatedScenarios: ['family-reunion-location-finder', 'date-night-equal-distance'],
  },
};

/**
 * Get scenario content by slug
 */
export function getScenario(slug: string): ScenarioContent | undefined {
  return SCENARIOS[slug];
}

/**
 * Get all scenario slugs
 */
export function getAllScenarioSlugs(): string[] {
  return Object.keys(SCENARIO_METADATA);
}

/**
 * Get scenarios by layer
 */
export function getScenariosByLayer(layer: ScenarioMetadata['layer']): ScenarioMetadata[] {
  return Object.values(SCENARIO_METADATA).filter((scenario) => scenario.layer === layer);
}
