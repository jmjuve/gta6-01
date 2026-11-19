# LOWTIDE — Port Solmar floods twice a day

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jmjuve/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jmjuve/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Port Solmar floods twice a day — and the whole game changes with the water: streets become rivers, cruisers become boats, and the best getaway in the city is the tide itself.**

You are **Rae Calloway**, a getaway driver who swore off the life — until her brother's debt to the fixer **Marlowe Voss** pulls her back for one last score. Steal cars, outrun the PSPD on streets that become rivers, and pull the Golden Hour heist as the highest tide of the year drowns the Boulevard.

An original open-world crime game in the spirit of GTA 6, built for make.fun **gta6-01**. Every city, character, vehicle, name, story, texture and sound is original — no Rockstar names, characters, maps, art or music.

## Play

Serve `game/` with any static server (or `node serve.ts`) and open `game/index.html` in a desktop browser. No network request, no build step.

- **WASD** drive / walk · **Space** brake · **Shift** boost · **E** enter or steal a vehicle · **F** swap car/boat at the water's edge · **Click** shoot on foot · **J** job board + shop · **H** horn · **M** mute · **Esc** pause

## The tide (the game's verb)

- **Low tide:** streets open, cars are king, shortcuts through the underpass.
- **Rising tide:** low streets flood; cars slow and stall, boats launch from the canals, police switch from cruisers to patrol boats.
- **High tide:** the Boulevard is a river. The fastest escape is by boat through the flooded avenue, under neon reflected in the water.
- The HUD tide gauge shows the level and time to the next high/low water; the minimap tints blue as streets flood.

## Systems

- On foot and by car: walk, run, enter/exit any car (E), steal parked cars, carjack moving ones (raises wanted).
- Boats: stealable at the Marina and canals; faster than cars at high tide.
- Traffic and pedestrians: cars cruise the road grid and slow in flood; peds walk the sidewalks, flee crashes, and crowd high ground when the water rises.
- Wanted level 0–5: foot patrol, cruisers, roadblocks + helicopter searchlight at 3+, patrol boats at high tide. Heat decays when unseen; hiding in the canals at high tide breaks line of sight faster. Busted = lose half your cash, respawn at the safehouse.
- Combat: on-foot pistol with hitscan, muzzle flash, police units that can be disabled.
- Missions + story: Act 1 — M1 First Fare, M2 Borrowed Wheels, M3 The Canal Run — plus a job board with taxi fares and deliveries.
- HUD + minimap: health, cash, wanted stars, current job, tide gauge, dispatch radio, minimap with water tint, police and objective markers.
- Start and save: title screen ("Port Solmar, 6:47 PM"), Continue / New Game, localStorage save (cash, cars, boats, upgrades, missions, tide charts).
- Economy: cash from jobs; buy 6 cars + boats + upgrades (tuned engine, armor, wet-grip tires) at the job board; owned rides wait at the safehouse.
- Polish: dusk sun + neon, wet-asphalt reflections, flood spray, screen shake, procedural engine/waves/siren audio and an original synthwave driving loop (all synthesized live, no audio files).

## Layout

- `game/index.html` + `game/style.css` — the page and HUD
- `game/src/config.js` — districts, vehicles, missions, palette
- `game/src/tide.js` — the living tide cycle
- `game/src/city.js` — Port Solmar: island, canals, bridges, neon, stilt houses, safehouse, vault
- `game/src/vehicles.js` — car/boat meshes + arcade driving + flood physics
- `game/src/traffic.js` — NPC cars and pedestrians
- `game/src/police.js` — wanted system, cruisers, patrol boats, roadblocks, helicopter
- `game/src/missions.js` — story missions + side jobs
- `game/src/hud.js` — HUD + minimap
- `game/src/audio.js` — procedural WebAudio (engine, waves, sirens, synthwave)
- `game/src/input.js`, `game/src/save.js` — keyboard/mouse, localStorage save
- `game/vendor/three.module.min.js` — three.js r160 (vendored library)
- `main.ts` — the make.fun entry program; `vendor/makefun-game.ts` — the kit's library, unchanged

## Screenshots

Staged with `?shot=hero|heist|canal|board` — real renders of the game's own code in desktop Chrome:

1. `1-hero.jpg` — car-to-boat chase across the flooded Boulevard at dusk
2. `2-heist.jpg` — on-foot heist outside the Meridian Vault, wanted 3, helicopter searchlight
3. `3-canal.jpg` — boat escape through the Stilt Quarter canals at high tide
4. `4-board.jpg` — job board + safehouse at low tide, morning light

## License

MIT — see `LICENSE`.
