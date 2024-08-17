## Fina

Fina (*Fina Is Not an Administrator*) is a multi-purpose Discord bot developed in late 2021 and early 2022, written in Discord.js v13 (initially with v13-dev). Deployed as **Fina** (openly), **Slammer** (the Dead Cells Discord (formerly)) and **Charon** (the Arcaea Community Tounaments Discord). As the Dead Cells Discord bot, it was the successor/rewrite of **Hammer**, the bot which used to handle community feedback.

### Design

Fina was built exclusively with slash commands in mind (although context menus were added later, soon after their introduction), and features a robust framework for creating them, predating Discord.JS's command builder. New commands could be dropped into the `src/commands` directory and were independent from each other
(see [facepalm.ts](src/commands/misc/facepalm/Facepalm.ts) for the most basic example). Each command is supposed to send a response (wrapped in a nice embed by default), and any uncaught exception sends an ephemeral error embed instead.

Command list could be configured per-guild in the database (and with the rudimentary `/admin` command), predating Discord's built-in command permission system.

In contrast with traditional general-purpose Discord bots, Fina generally does not require any special Discord permissions, hence *Fina Is Not an Administrator*.

### Features

#### Polls
![poll1](res/gh/poll1.png)
![poll2](res/gh/poll2.png)
![poll3](res/gh/poll3.png)
![poll4](res/gh/poll4.png)
![poll5](res/gh/poll5.png)
![poll6](res/gh/poll6.png)
![poll7](res/gh/poll7.png)

#### Games

Twenty questions, Rock-Paper-Scissors (with image generation); more were planned.

![games1](res/gh/games1.png)
![games2](res/gh/games2.png)
![games3](res/gh/games3.png)
![games4](res/gh/games4.png)

#### Tournament handling

Tournament automation for the mobile game Arcaea. Featured OCR for score fetching, although it was disabled in favor of official and officious APIs (which are all dead now).

![arc1](res/gh/arc1.png)
![arc2](res/gh/arc2.png)
![arc3](res/gh/arc3.png)

#### Misc

Modmail, wiki scraping (including wiktionary), avatar and profile lookup, unit conversion, and many other such things.

![define1](res/gh/define1.png)
![define2](res/gh/define2.png)

### Archival

Development largely stopped in 2022 due to frustration with the way Discord and Discord.js were headed. Many problems Fina solved were solved later on in Discord.js v14, or within Discord itself (like polls). Since then I've mostly moved over to Matrix and haven't had motivation to continue working on a Discord "app".

No setup instructions are provided (maybe one day), and the code is uploaded mainly for archival/reference. It does not reflect my current TypeScript non-skill.

By the way, I also made a [music bot](https://github.com/wolftender/pantofel-v2).

### License

Code is AGPLv3.

Assets are from various sources (most of them are gitignored) and are uploaded as-is; probably don't copy them.