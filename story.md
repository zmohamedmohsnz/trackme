
## What I want to build ?
I want to build a personal tracking system using my own requirements.

## Why not just use an already exist app ?
There are a lot of exist systems, but none of them provide exactly what I expect.

## What are features ?
I actually don't have an imagination about a full complete system. I want to build it incrementally based on my needs.

When I feel that I need to add a new feature, edit a current one, remove a current one, or anything, I will ask you to implement it feature.

This approach makes me add only the features I currently need and with time the system will be built.

## Initial Needs
I will tell you what I currently doing in my life as a story with some direct requirements so you who guess the feature, not me. Let's start:

1. I currently have three big tasks (or areas) through days: Software, English, Business.
2. Sometimes Software is 4h and each one of English and Business is 2h per a day. But sometimes I change the time or remove an area at all.
3. Inside English, I have a sub daily task which is "Study Anki". It is for 15 min.
4. I want these tasks displayed in a calendar view (can switch between Month, Week).
5. For the task progress tracking, I don't have 100% surely approach, but at least I want to can mark a task as done which means I finished the all the task time. Also I should have the ability to enter the time as I sometimes set a task to study for 4h, then I only study for 2h.
6. Completing 15 minutes of Anki contributes 15 minutes to English, leaving 1h 45m / 2h. Task is complete when its combined direct time and subtask time reaches two hours—or when you explicitly mark the whole focus area complete.

## Out of Scope (Future Features)

- Manual Timer.
- Mobile Phone App.

## Development
1. I want to can access this web app from PC and Phones. But in your considerations that I will create a mobile app that interacts with our backend. But this is a future feature.
2. You should make the data model multi-user from day one, but build the experience for a single user now.
3. For the week start day, I want it to be settings that can be configured and the default is 'Saturday'.

## Status

TrackMe v1 is complete and deployed. The implemented scope includes the responsive bilingual web application, Supabase authentication and database, Vercel Preview and Production environments, production SMTP configuration, and the documented verification coverage.

