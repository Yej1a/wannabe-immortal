Original prompt: ?????????????????????????3 ???????????????????????10 ?????????????????
2026-03-18

- 已整理正式设计文档到 `GAME_DESIGN_DOC.md`
- ??????????????
- ??????????????Canvas ?????? HUD ??????????
- ???????
  - ?? 3 ??????
  - ???? 1 ?????? + 1 ???????
  - ????????
  - 单边满槽时可选化身或暂不选择
  - 双边满槽时必须二选一定道
  - 化身后开启二阶段槽并统一掉落颜色
- 下一步：
  - 实现玩家、敌人、掉落和升级系统
  - ?? 4 ?????
  - ????????Boss ???

2026-03-18 update

- Implemented first playable prototype in `index.html`, `styles.css`, and `app.js`
- Current playable systems:
  - player movement
  - auto attack and 4 active skills scaffold
  - enemy spawning, elites, drops, XP, level-up modal
  - black/white dual path bars with 1/3 and 2/3 effects
  - transform modal and second-stage path handling
  - boss spawn and ending flow
  - `window.r`render_game_to_text``
  - `window.advanceTime`
- Verification:
  - `node --check app.js` passed
  - local server started successfully on `http://127.0.0.1:4173`
  - Playwright client run completed and produced screenshots/state JSON
  - additional browser check with Playwright found no runtime console/page errors in tested flow
- Fixed bug:
  - start button kept focus after game start, pressing `Space` could reset the game unexpectedly
  - added modal keyboard shortcuts to make repeated testing easier
  - added arrow-key movement support for automated gameplay checks
  - fixed boss targeting gaps so player attacks can hit boss

2026-03-18 balance pass 1

- Moved combat tuning into `balance.js`
- Difficulty pass goals from user:
  - monsters should hit harder
  - ranged enemies should create more dodge pressure
  - boss should be stronger and less repetitive
  - tuning should be editable through tables/config, not scattered in logic
- Applied changes:
  - raised enemy base HP, damage, and wave multipliers
  - increased ranged projectile speed and fire rate
  - increased melee pressure and charger threat
  - upgraded boss HP, damage, projectile counts, phase thresholds, and summon behavior
- Verification:
  - `node --check app.js` passed
  - browser check showed the player can now die early if standing still
  - Playwright client run completed after the balance update

2026-03-18 reincarnation pass 1

- User chose the third long-term growth direction: `轮回继承机制`
- Implemented the smallest viable meta loop instead of a full save/build carryover system
- Added local persistent save via browser `localStorage`
- Added `轮回点` settlement after each run
- Added minimal permanent upgrades:
  - max HP bonus
  - XP gain bonus
  - pickup range bonus
  - white point gain bonus
  - black point gain bonus
  - starter extra skill choice
- Added post-run reincarnation panel for spending points immediately
- Moved reincarnation tuning into `balance.js` so future cost/effect adjustments stay table-driven

2026-03-18 reincarnation UI pass 1

- Upgraded the reincarnation screen from a generic modal into a dedicated settlement UI
- Added summary cards for:
  - result

2026-03-24 right panel layout pass

- Reworked the former right-side single stack into a two-part layout via CSS only.
- Current structure:
  - left sub-column: white/black slots on top, inspect details below
  - right sub-column: white/black slot explanation panel spanning the full column height
- Kept `index.html` structure intact and moved the composition into `styles.css` to avoid touching the existing encoded text block.
- Verification:
  - Playwright screenshot captured at `output/web-game/right-panel-layout-check/layout-full-2.png`

2026-03-24 main play area enlarge pass

- Increased desktop shell max width and reduced outer padding to free more space for the center stage.
- Narrowed left HUD and right-side composite panel widths and reduced column gaps.
- Reduced `center-stage` container padding so the canvas occupies more of the available panel area.
- Verification:
  - Playwright screenshot captured at `output/web-game/layout-after-enlarge.png`

2026-03-24 main play area enlarge pass 2

- Further narrowed the left HUD and the two right-side sub-columns.
- Reduced layout gaps and panel inner spacing again so the center battle canvas gets more horizontal area.
- Verification:
  - Playwright screenshot captured at `output/web-game/layout-after-enlarge-2.png`
  - gained reincarnation points
- current point total
- kills
- survival time
- total runs
- Restyled inheritance choices as larger cards for a more formal roguelite meta-progression feel
- Verified the new reincarnation UI with a fresh death-flow screenshot

2026-03-19 destiny-board design pass 1

- Added a formal `命盘` system section into `GAME_DESIGN_DOC.md`
- Locked terminology:
  - system name: `命盘`
  - single unit: `命格`
  - type split: `??? / ???`
  - tier split: `凡命 / 真传 / 天命`
- Locked design philosophy:
  - each `命格` is unique, not part of a linear rarity upgrade chain
  - low tier focuses on stability, high tier focuses on rule-changing mechanics
  - build skeleton is `??? -> ??? -> ???`
- Locked black/white direction:
  - white path = stable growth + settlement/reincarnation value
  - black path = extreme combat + risk-for-power
  - mixed path stays weak by default and is unlocked by one apex mixed `天命`
- Added first commandable destiny-board package:
  - white build: `福缘护生流`
  - black build: `燃命杀伐流`
  - mixed build: `逆命双修流`
- Added first batch of example `命格` entries and resonance rules into the design doc
- Next likely implementation step:
  - define save data shape for owned/equipped `命格`
  - define settlement/shop acquisition rules
  - integrate resonance bonuses into runtime stats/balance tables

2026-03-19 destiny-board economy pass 1

- Extended `GAME_DESIGN_DOC.md` with:
  - destiny acquisition rules
  - settlement shop loop
  - rarity odds and price bands
  - refresh/lock rules
  - destiny board slot rules
  - run-prep flow
  - suggested save-data fields
- Current recommended first implementation shape:
  - settlement shop shows 4 offers
  - first refresh is free
  - one `天命` max equipped
  - board size starts at 4
  - owned/equipped/unlocked destiny IDs should be stored separately
2026-03-19 path-meter structure pass 1

- Updated design direction so black/white meters are no longer only a transformation gate
- Locked new role of path meters:
  - act as long-run alignment meters
  - influence post-stage destiny offers
  - still feed final transformation and endgame direction
- Added document rules for:
  - per-stage destiny selection after each mini-boss
  - full-meter states increasing matching destiny refresh weights
  - white/black bias affecting offer tables
  - separating `small-stage destiny choice` from `full settlement shop`
- Minimal intended loop is now:
  - small stage
  - mini-boss
  - "??????" feedback
  - 3-offer destiny pick
  - next stage
  - final big boss decides `成仙 / 化魔`

2026-03-19 path-meter weighting pass 1

- Refined destiny refresh weighting rules in `GAME_DESIGN_DOC.md`
- Locked weighting philosophy:
  - black/white meter = light guidance
  - equipped same-path destiny count = strong guidance
- Locked first-pass values:
  - full white/black meter => matching destiny weight x1.1
  - 2 same-path destinies equipped => matching destiny weight x1.25
  - 4 same-path destinies equipped => matching destiny weight x1.6
- Kept neutral destiny weight at normal baseline when neither white nor black build is clearly formed

2026-03-19 mvp data-shape pass 1

- Added concrete MVP implementation shapes into `private_docs/GAME_DESIGN_DOC.md`
- Covered:
  - run/stage state machine for `3 small + 1 boss` per run
  - 3-run overall flow
  - permanent destiny ownership/equip structure
  - black/white meter polarity override flow
  - post-mini-boss 3-offer destiny pick
  - end-of-run shop tabs for buy/upgrade/stat-upgrade
  - minimal save-data shape
- Locked suggested implementation order:
  - stage/run state
  - post-stage destiny pick
  - persistent destiny storage
  - meter-to-polarity override
  - run-end shop

2026-03-19 mvp implementation pass 1

- Started landing the new campaign structure in `app.js`
- Added foundational runtime/meta structures for:
  - 3-run campaign flow
  - per-run stage state
  - persistent destiny storage
  - run-end shop scaffolding
  - polarity-weighted destiny offers
- Replaced old fixed timer HUD with run-stage style display
- Removed fixed `time >= duration => boss` trigger from active update loop
- Added first smoke verification:
  - `node --check app.js` passed
  - local server booted on `http://127.0.0.1:4173`
  - browser check confirmed start flow works and `r`render_game_to_text`` returns live stage state
- Known incomplete / likely next fixes:
  - old single-run / transformation code paths still exist and should be cleaned or fully bypassed
  - small-boss -> destiny reward -> next stage needs a fuller traversal test
  - run-end shop and final result flow need end-to-end validation in browser

2026-03-23 destiny first-batch validation + full first-wave runtime

- Reviewed `private_docs/GAME_DESIGN_DOC.md` sections for:
  - first-wave destiny rule rewriters
  - runtime hook table
  - implementation order
  - acceptance criteria
  - truth-layer conflict table
  - cross-system extension boundaries
- Verified existing runtime coverage before editing:
  - white / black / mixed rule rewriters were already largely implemented in `modules/destiny-runtime.js`
  - sword destiny rewrites were already wired in `app.js`
  - thunder / flame / guard destiny rewrites still needed live combat wiring
- Added runtime/debug support:
  - `modules/runtime-state.js`: `debugSpawnSuppressed`
  - `modules/debug-tools.js`: spawn suppression toggle, player-state setter, richer runtime snapshot fields/logs
- Wired remaining skill behavior rewriters into live combat:
  - `app.js`: thunder / flame / guard rewrite profiles and active/auto skill integration
  - `modules/systems/combat-update.js`: thunderstorm opener multiplier, flame burn durations, pulse data propagation
- Filled a missing black rule rewriter hook:
  - `app.js`: `凡命·险中求利` now buffs elite / high-threat enemy HP and damage on spawn without double-applying
- Tightened guard rewrite synchronization:
  - `app.js`: `真传·玄罡护身` max shield now syncs immediately on loadout change, guard learn, and route lock
- Validation:
  - minimal batch revalidated first: `真传·万剑潮生 / 真传·巨阙镇场 / 凡命·清心护元 / 凡命·血战成狂`
  - after minimal batch passed, validated the remaining current first-wave destinies
  - browser validation outputs saved to:
    - `output/destiny-batch-validation/summary.json`
    - `output/destiny-batch-validation/full-summary.json`
  - additional targeted reruns confirmed thunder / flame / guard signature-layer actives with correct active-slot routing
- Local checks:
  - `node --check app.js`
  - `node --check modules/debug-tools.js`
  - `node --check modules/runtime-state.js`
  - `node --check modules/systems/combat-update.js`

2026-03-19 level-up pool fix pass 1

- Reworked level-up offer selection so learned skills get their own upgrade presence instead of sword-focus monopolizing the top 3 choices.
- Verified in browser that after learning thunder/flame/guard, their upgrade entries can appear; before learning, their upgrade entries stay unavailable because canTake still gates them.
- Validation:
node --check app.js passed
  - Playwright client smoke run completed on http://127.0.0.1:4173
  - targeted browser checks showed example offers like thunder-chain, flame-radius, and guard-strong only after those skills were unlocked.


2026-03-19 vfx pass 1

- Added a lightweight zig-zag lightning render for thunder hits using source-to-target pulse lines.
- Replaced sword projectiles' plain dots with a small rotated blade shape based on projectile velocity.
- Validation:
node --check app.js passed
  - browser smoke check captured updated combat screenshots with thunder chain and sword projectile visuals.


2026-03-19 flame wave vfx pass 1

- Changed flame pulses from a simple ring stroke to an outward-traveling fire wave with flame tongues around the ring.
- Extended flame pulse lifetime slightly so the outward propagation reads more clearly in motion.
- Reduced the always-on flame aura around the player to a small ember glow so the traveling wave remains the main visual.
- Validation:
node --check app.js passed
  - browser smoke check captured the updated fire-wave effect during combat.


2026-03-19 death-flow fix pass 2

- Fixed a modal flow conflict where death settlement upgrades reused the run-end shop refresh path and could wrongly send the player into `?????` instead of restarting the campaign.
- Death settlement now always refreshes back into the reincarnation modal, and pending run-shop state is cleared on death and on full reset.
- Validation:
node --check app.js passed
  - targeted browser tests confirmed death -> Enter stays on death settlement, and death -> `????` restarts at run 1 stage 1 instead of advancing to run 2.


2026-03-19 flame-center fix pass 1

- Player-cast flame pulses now follow the player's current center while expanding, so the fire ring no longer drifts off and appears detached when moving.
- Targeted checks showed mini-boss kill -> destiny choice -> next stage keeps the current XP value instead of wiping it.
- Validation:
node --check app.js passed
  - browser evaluation confirmed flame pulse center matches player position after movement and XP stayed unchanged across mini-boss stage advance.


2026-03-19 active-skill pass 1

- Added active skills for all four spell types. Active skills unlock at rank 6 and scale with `rank - 5`.
- Bound active casts to spell slots: current slot 1/2/3 use keyboard 1/2/3.
- Implemented first-pass actives:
  - Thunder: half-screen lightning strike
  - Sword: homing sword burst (`????` style)
  - Guard: damaging knockback shockwave
  - Flame: meteor rain
- Added cooldown/readiness text to the skill bar for each learned spell slot.
- Validation:
node --check app.js passed
  - browser checks confirmed slot skills can fire, start cooldowns, and spawn the expected projectile/pulse types for sword, thunder, guard, and flame.


2026-03-19 legacy-cleanup pass 1

- Removed active runtime dependence on the old `avatar`/transformation path by stripping `avatar`-based damage, drop, and score bonuses from live code paths.
- Re-overrode `fillPath`, `refreshPhase`, `updateHud`, and `renderGameToText` near the runtime tail so the game now uses the new campaign/path-meter presentation instead of old stage/avatar HUD logic.
- Simplified run-point calculation to only use current run time, kills, and final boss clear bonus.
- Validation:
  - node --check app.js passed
  - browser smoke check confirmed gameplay still starts normally and `render_game_to_text` no longer emits an `avatar` field.

- Follow-up verification: Playwright smoke run still starts correctly after the legacy cleanup overrides, and the emitted text state now omits `avatar` entirely.


2026-03-19 cleanup and aoe pass 1

- Physically removed the major dead transformation / old HUD / old phase residue blocks that were previously only bypassed at runtime.
- Restored `app.js` syntax after an encoding-related edit break and re-stabilized the runtime tail (`fillPath`, `refreshPhase`, `updateHud`, `renderGameToText`, loop bindings).
- Changed active thunder into a 2-second thunderstorm zone that keeps striking enemies inside the area instead of a one-shot screen nuke.
- Added a persistent flame radius ring around the player so the fire aura range is readable at a glance.
- Validation:
node --check app.js passed
  - Playwright smoke run completed successfully
  - targeted browser check confirmed `thunderstorm` persists for about 2 seconds and then expires, while the flame radius remains visible.


- 2026-03-19??? `index.html` / `balance.js` / `app.js` ??????????????????????HUD ????????? `app.js` ?????

- 2026-03-19????????????? 3 ????? 0.7 ???????? 2.1 ?????? Boss ?????????????

- 2026-03-19??? Boss ?????? 1000???????? Boss ???????????????

- 2026-03-19???? Boss ???????????????????????????????????

- 2026-03-19?????????? `?? / ?? / ???Be Human?`?????????????? Boss / ? Boss ???????

- 2026-03-19??? Boss ????????????????????????????????? / ??????????

- 2026-03-19??? Boss ???????????? + ?????????????????????? / ????????

- 2026-03-19???? Boss ???????????????? `pendingMiniBossReward` ????????????????????

- 2026-03-19????????????????????????????????????????


- 2026-03-20?????????????????? `20 / 40 / 60` ????????? / ?????Q/E ?????Boss ????????? Playwright ???????

- 2026-03-20????????????????? 200????? 1000???????????????

- 2026-03-20??? Boss ???????????????? -> ???????????? `advanceCampaign()` ???? `stage-prep`???? `stage-confirm`?

- 2026-03-20????????????????????????????????????????????????????????? / ???

- 2026-03-20????????????????????????????????????????????
 
- 2026-03-20: Added a dedicated post-pointify result modal. After dao pointify, the game now shows before/after destiny cards, preserved level, remaining infusion points, and a preview of what equipping the new destiny would change. Verified with node --check app.js, node --check balance.js, the Playwright smoke run, and a targeted browser check covering mini-boss reward > dao pointify > pointify result > next destiny offer. Screenshot saved at output/pointify-result-check/pointify-result.png.
 
- 2026-03-20: Changed dao pointify from weighted-alignment reroll to deterministic recoloring. White pointify now always creates a white-aligned destiny, black pointify always creates a black-aligned destiny, destiny instances now store their own current alignment, and pointify prefers a different destiny id before falling back to the original one. Verified with node --check app.js, node --check balance.js, and a targeted browser run for both white and black pointify. Results and screenshots saved under output/pointify-color-check.
 
- 2026-03-20: Added a top-right pause button next to restart. The game now tracks a separate manualPause state so button-based pause does not interfere with modal/shop pauses. Verified with node --check app.js, node --check balance.js, and a targeted browser check confirming the button shows 暂停 while running and switches to 继续 after pausing. Artifacts saved under output/pause-button-check.
 
- 2026-03-20: Performed a safe architecture cleanup pass. Removed duplicate r`refreshPhase`/updateHud definitions so only one live implementation remains, introduced shared gameplay state helpers for pause/input gating, and moved destiny bonus application out of the giant switch into DESTINY_BONUS_HANDLERS. Verified with node --check app.js, node --check balance.js, and a targeted browser smoke run covering pause toggle plus white pointify result flow. Artifacts saved under output/architecture-cleanup-check.
- 2026-03-20: Split the monolithic app bootstrap into browser-loaded modules. Added modules/game-data.js for shared tables and constants, modules/runtime-state.js for campaign/meta/state factories plus save helpers, and modules/destiny-helpers.js for destiny ownership, weighting, preview, and bonus logic. Slimmed app.js so it now orchestrates DOM, gameplay flow, and thin wrappers over the extracted modules. Verified with node --check on app.js, balance.js, and all three module files; ran the develop-web-game Playwright client against a local static server; and ran a targeted Playwright smoke on file:///.../index.html covering pause toggle plus white pointify to dao-pointify-result. Artifacts saved under output/module-split-check. 
- 2026-03-20: Continued modularization by extracting presentation and debug bootstrap code. Added modules/game-ui.js for modal/toast/overlay helpers, pause-button sync, HUD/status rendering, skill-bar rendering, path-stage labeling, and r`render_game_to_text` payload generation; added modules/debug-tools.js to install r`render_game_to_text`, advanceTime, and the mini-boss reward debug hook from a single place. Updated index.html to load the new modules and slimmed app.js further into gameplay orchestration plus thin wrappers. Verified with node --check on app.js, balance.js, and the new modules; reran the develop-web-game Playwright client; and reran the targeted pause plus white pointify to dao-pointify-result smoke. Artifacts saved under output/module-split-check-2. 
- 2026-03-20: Corrected dao pointify to use fixed-color destiny pools instead of recoloring destiny instances. Pointify now returns the selected unequipped destiny to the pool, draws a replacement only from the chosen white or black pool, preserves level only, and always uses the catalog-defined alignment for display and bonuses. Updated preview/result copy to describe pool redraw behavior. Verified with node --check on app.js and modules/destiny-helpers.js, plus targeted browser checks showing river(mixed) white pointify redraws into a fixed white destiny and black pointify redraws into a fixed black destiny. Artifacts saved under output/pointify-pool-check. 
- 2026-03-20: Simplified the destiny system to a 3-slot no-backpack model. Destiny slot cap is now 3, save migration keeps only up to 3 current destinies (equipped entries first), stage prep only shows currently slotted destinies, new destiny acquisition and shop purchases replace an existing slot when full instead of creating stash items, and dao pointify now targets currently slotted destinies and applies the redraw result immediately to that slot. Verified with node --check on app.js and modules, plus a targeted browser smoke under output/destiny-slot-check covering no-backpack UI and immediate slot replacement after pointify. 

2026-03-21 destiny reward timing update

- Moved destiny rewards off mini-boss flow: mini-boss drop settlement now only goes into post-boss pointify (if any) and stage prep.
- Added one starting destiny offer at new-run start, after starter spell choice if present.
- Big-boss destiny rewards now trigger only after boss clears for runs 1 and 2; run 3 boss clear goes straight to ending flow.
- Refactored `acquireDestiny` and destiny-offer modal to accept continuation callbacks so reward flow can route to prep, shop, or ending correctly.

2026-03-21 architecture boundary fix

- Added explicit destiny save separation: owned, equipped, and unlocked now coexist in meta save shape instead of normalizing everything down to equipped slots.
- Fixed destiny normalization so existing saves keep backpack destinies; equipped selection is filtered and preserved, but owned destinies are no longer truncated to slot count.
- Reward/shop acquire flow now keeps newly obtained destinies in owned inventory even when slots are full; replace modal only changes equipped slots and no longer deletes the displaced destiny from ownership.
- Ending result wrapper now normalizes legacy garbled alignment strings so ending UI and settlement use the same canonical result values (`?? / ?? / ???Be Human?`).
- Destiny weighting / ending resolution architecture tightened: runtime result no longer depends on battle-path residue as a tiebreak, and missing-destiny queries now respect unlocked instead of assuming all catalog IDs are always buyable/offerable.

2026-03-21 destiny flow rule update

- Destiny rules changed to a no-backpack model: current destiny ownership is now effectively limited to the 3 active slots; normalization drops extra stored destinies and keeps only the equipped set.
- Start flow now grants 1 destiny offer, each small-boss clear grants 1 destiny offer, and each big-boss clear also grants 1 destiny offer before continuing to next stage / shop / ending.
- When current destiny count is below 3, newly obtained destinies now open an explicit equip-or-abandon modal instead of auto-equipping.
- When current destiny count is 3, newly obtained destinies now open a replace-or-abandon modal; abandoning no longer leaves a hidden backpack copy behind.
- Removed remaining backpack-facing UI text / flow from active reward chain; stage prep now only reflects current equipped destinies plus pointify.
- Validation: 
  - node --check app.js, node --check modules/destiny-helpers.js, and Playwright regression covering start reward, small-boss reward, full-slot boss reward, and final-boss reward before ending all passed.

2026-03-21 shop replace confirmation update

- Shop purchase flow now warns before replacing when destiny slots are full.
- Clicking a shop buy at 3/3 no longer deducts points immediately; it first opens a replacement-confirm modal with stat preview and explicit wording that the purchase will replace a current destiny.
- Abandoning from that modal now cancels the purchase and returns to the run shop without consuming points.
- Validation: 
node --check app.js plus targeted Playwright shop regression confirmed `run-shop -> equip-destiny confirm -> cancel -> run-shop` with point total unchanged.

2026-03-21 clear save button

- Added a topbar `????` button that removes the game's browser save key (`wannabe-immortal-save`) and resets both meta/runtime state back to the initial menu in-place.
- Clearing save now updates the current session immediately: closes modals, restores start overlay, resets button text to `????`, and shows a toast so the user can restart without closing the browser.
- Validation: 
node --check app.js and a Playwright click-through confirmed the save key is removed, overlay returns, and the start screen is restored.

2026-03-21 pointify irreversibility warning

- Removed the destiny-offer fallback action that exchanged a destiny reward for reincarnation points; reward modals now only resolve by choosing a destiny or exiting through the normal continuation path when no offers exist.
- Added a dedicated `????` modal before executing pointify. Players now choose a target first, then see an explicit irreversible warning plus target/preview details before the reroll actually happens.
- Fixed pointify target modal state tracking by setting currentModal = 'dao-pointify-target', so back-navigation and test state now reflect the visible modal correctly.
- Validation: 
node --check app.js and Playwright flow checks confirmed reward offers have no action buttons and pointify now goes dao-pointify -> dao-pointify-target -> dao-pointify-confirm before execution.

2026-03-21 single button centering

- Modal rendering now tags single-choice rows and single-action rows with single-item helper classes.
- CSS now centers any modal row that contains only one button, with a capped width for the lone choice card so single-option dialogs no longer stick awkwardly to the left.
- Validation: 
node --check modules/game-ui.js and a Playwright screenshot on the single-choice destiny acquire modal confirmed both the lone choice and lone action rows are centered.

2026-03-21 UI follow-up verification

- Verified small-boss destiny offer now includes a direct abandon action button and captured `output/ui-followup-check/small-boss-offer-with-abandon.png`
- Verified the actual `stage-confirm` modal after the single-item centering CSS update and captured `output/ui-followup-check/actual-next-battle-confirm-centered.png`
- No new console or page errors were reported during the targeted Playwright check

2026-03-21 inspect panel update

- Added a persistent HUD inspect panel plus equipped destiny list in `index.html`
- Status pills, skill cards, and equipped destinies now support hover preview and click-to-pin inspection
- Added inspector-specific UI rendering and selection styling in `modules/game-ui.js`, `styles.css`, and `app.js`
- Verified with `node --check app.js`, `node --check modules/game-ui.js`, and a targeted Playwright check
- Captured screenshots: `output/inspect-ui-check/hover-status-panel.png`, `output/inspect-ui-check/click-skill-lock-panel.png`, `output/inspect-ui-check/click-destiny-lock-panel.png`

2026-03-21 path hint cleanup

- Removed white/black infusion counters and destiny alignment counters from the left status pill area
- Moved black/white full-path release explanations plus infusion-point usage text into the right-side hint panel
- Verified with `node --check app.js`, `node --check modules/game-ui.js`, and screenshot `output/path-hint-cleanup-check/status-and-path-hint.png`

2026-03-21 separate hint window layout

- Split the right side into two panels: path bars stay in `right-panel`, while hint text and inspect panel moved into a new far-right `info-panel`
- Rewrote `index.html` with clean Chinese text while preserving existing IDs and script entry points
- Expanded desktop layout to four columns and added a responsive fallback for narrower widths
- Verified with `node --check app.js`, `node --check modules/game-ui.js`, and screenshot `output/hint-panel-window-check/separate-hint-window.png`
2026-03-21 destiny upgrade removal

- Removed the destiny-level / destiny-upgrade concept from runtime data, shop choices, and UI copy
- Destiny ownership now stores alignment only; legacy level fields are normalized away in modules/destiny-helpers.js
- Run shop now only offers buying/replacing destinies, not upgrading them
- Pointify, destiny inspect cards, stage prep, and `render_game_to_text` no longer show Lv. or retained-level language
- Verified with 
node --check on app/destiny helper/game data/game UI/debug tools plus Playwright artifacts in `output/remove-destiny-upgrade-smoke`
2026-03-22 skill art pass 1

- Implemented first-pass in-game skill art resources based on the current four-skill visual rules.
- Added data-driven art palettes in modules/game-data.js for sword, thunder, flame, and guard.
- Upgraded HUD skill cards in modules/game-ui.js and styles.css with inline SVG icons and empty-slot icons.
- Upgraded canvas combat VFX in app.js:
  - sword: orbiting blade hints, stronger blade projectile silhouette, active sword burst cue
  - thunder: clearer strike flash and stronger thunderstorm field read
  - flame: hotter ring aura and fuller burn pulse read
  - guard: layered shield aura, dedicated guard shockwave, explicit shield-break pulse
- Added test-actions-skill-vfx.json for quick verification.
- Verification:
  - node --check app.js passed
  - node --check modules/game-ui.js passed
  - node --check modules/game-data.js passed
  - Playwright web-game run completed without captured console/page errors
  - reviewed screenshots in output/skill-vfx-check
- Follow-up:
  - show skill icons in level-up choices and inspect panel header
  - add route-specific VFX variants after route gameplay is implemented

2026-03-22 route-active skeleton pass 1

- Added explicit four-skill route metadata in modules/game-data.js, covering:
  - 飞剑：剑潮流 / 大剑流
  - 雷法：天罚流 / 连锁流
  - 火环：爆落流 / 封区流
  - 金钟：护体流 / 弹反流
- Extended runtime skill state in `app.js` / `modules/runtime-state.js`:
  - skills now track `baseUpgrades`, `route`, `routePoints`, and route-specific prototype bonus fields
  - player now tracks facing direction for future auto-cast placement logic
  - runtime now has `activeEffects` and `routeShiftNotice` placeholders for upcoming active-skill route logic
- Added first branch-choice layer to the level-up pool:
  - each skill still keeps current基础强化 entries
  - branch entries only appear after at least 2 base upgrades
  - first branch pick locks the route and prepares active-skill form switching
- Updated inspect / HUD / `render_game_to_text` to show current route and active-skill prototype identity
- Verification:
node --check app.js passed
node --check modules/game-data.js passed
node --check modules/runtime-state.js passed
node --check modules/game-ui.js passed
  - develop-web-game Playwright smoke run passed with screenshots in output/route-skeleton-smoke
  - reviewed output/route-skeleton-smoke/shot-1.png
  - reviewed output/route-skeleton-smoke/state-1.json
  - no new console/page error file was generated
- Next:
  - wire active cast dispatch to route-specific prototypes
  - implement 巨阙镇场 first and add debug helpers for deterministic route/elite validation
2026-03-22 route-active prototypes pass 2

- Wired route-specific active-skill dispatch into the real combat loop for all four missing branch actives:
  - 飞剑大剑流 巨阙镇场
  - 雷法连锁流 连锁雷暴
  - 火环范围流 留焰封区
  - 金钟弹反流 返天钟鸣
- Added reusable targeting helpers for:
  - 最近高威胁目标
  - 敌群中心
  - 玩家前方短距离落点
- Added `activeEffects`-based prototype systems in `app.js`:
  - moving/continuous lane pressure for giant sword
  - rapid chained target hopping for chain thunder
  - persistent burn zone with slow for flame area lock
  - guard counter window with projectile reflect / shock / finale burst
- Existing current-route actives remain available on their current routes:
  - 飞剑 万剑归宗
  - 雷法 掌心雷·天罚
  - 火环 陨火天坠
  - 金钟 金钟震荡
- Route lock is now tied to the first branch-level upgrade and changes the active prototype identity shown in HUD / inspect / `render_game_to_text`
- Added debug helpers for deterministic validation:
  - __debug_setup_route_active(skillId, routeId)
  - __debug_prepare_branch_choice(skillId)
  - __debug_apply_level_choice(choiceId)
- Verification runs completed and screenshots reviewed:
  - develop-web-game smoke after route skeleton: output/route-skeleton-smoke
  - 飞剑大剑流定向验证: output/sword-greatsword-check
  - 雷法连锁流定向验证: output/thunder-chain-check
  - 火环封区流定向验证: output/flame-zone-check
  - 金钟弹反流定向验证: output/guard-counter-check
  - final develop-web-game smoke regression: output/final-route-regression-smoke
  - current-route regression + branch-lock checks: output/route-regression-check
- Reviewed render/text state files during validation, including:
  - output/sword-greatsword-check/state-after.json
  - output/thunder-chain-check/state-after.json
  - output/flame-zone-check/state-after.json
  - output/guard-counter-check/state-mid.json
  - output/route-regression-check/branch-lock-sword-great.json
  - output/route-regression-check/branch-lock-guard-counter.json
- No new console/page error file was generated in the targeted route checks or the final regression checks

2026-03-22 flow refactor pass 1

- Split the run / reward / settlement flow layer out of `app.js` into:
  - `modules/flow/run-flow.js`
  - `modules/flow/destiny-flow.js`
  - `modules/flow/shop-flow.js`
  - `modules/flow/reincarnation-flow.js`
- Kept the existing browser-global module style and used dependency injection from `app.js` instead of introducing a new framework layer
- `app.js` now mainly keeps:
  - state/bootstrap wiring
  - combat logic
  - rendering
  - debug hook installation
- `app.js` line count dropped from about `4848` to `4060`
- Migrated these responsibilities out of `app.js`:
  - stage start / stage preparation / next-run transition
  - destiny acquisition / equip replace / pointify flow
  - run shop refresh / buy flow
  - reincarnation settlement / ending / finish-game branching
- Added script loading for the new flow modules in `index.html`
- Verification:
  - `node --check app.js`
  - `node --check modules/flow/run-flow.js`
  - `node --check modules/flow/destiny-flow.js`
  - `node --check modules/flow/shop-flow.js`
  - `node --check modules/flow/reincarnation-flow.js`
  - develop-web-game smoke run passed with output in `output/web-game/flow-refactor`
  - reviewed `output/web-game/flow-refactor/shot-0.png`
  - reviewed `output/web-game/flow-refactor/state-0.json`
  - targeted Playwright assertion confirmed:
    - start flow still opens `命格初定`
    - mini-boss reward flow still opens `道途点化`
    - no new console/page errors were produced
- Next recommended split:
  - combat update systems (`updateSpawn`, `updateEnemies`, `updateProjectiles`, `updateDrops`, `updateStatuses`)
  - render layer (`draw*` functions + `render()`)
- Known follow-up:
  - ???????????????????????? `render_game_to_text` ???????????????????????????????
  - 当前数值仍是原型带，后续再按路线词条与手感做平衡

2026-03-22 combat/render refactor pass 2

- Split combat update logic out of `app.js` into `modules/systems/combat-update.js`
- Split canvas rendering / fullscreen / resize logic out of `app.js` into `modules/render/game-renderer.js`
- `app.js` now keeps the shared helpers plus module wiring, while the main loop calls `update(dt)` and `render()` through the new module instances
- Removed the old duplicate `render()`, `resizeCanvas()`, and `toggleFullscreen()` implementations from `app.js`
- Fixed a hidden double-render path by keeping rendering in the main loop/debug hooks instead of calling `render()` from the combat update pass
- Fixed a render regression in the new renderer: `sword-chain` projectiles now use the dedicated sword projectile art instead of falling back to generic circles
- Added script loading for the combat and renderer modules in `index.html`
- Verification:
  - `node --check app.js`
  - `node --check modules/systems/combat-update.js`
  - `node --check modules/render/game-renderer.js`
  - develop-web-game smoke run passed with output in `output/web-game/combat-render-refactor`
  - reviewed `output/web-game/combat-render-refactor/shot-0.png`
  - reviewed `output/web-game/combat-render-refactor/shot-combat.png`
  - reviewed `output/web-game/combat-render-refactor/state-0.json`
  - reviewed `output/web-game/combat-render-refactor/state-combat.json`
  - targeted Playwright assertion confirmed:
    - start flow still opens `命格初定`
    - mini-boss reward flow still opens `道途点化`
    - no new console/page errors were produced
- Next recommended split:
  - inspect/HUD assembly helpers can move out of `app.js`
  - combat helper clusters (damage/status/skill-route calculations) can be grouped into smaller domain modules

2026-03-22 inspect/HUD refactor pass 3

- Kept the split at demo-friendly granularity: added one new module `modules/inspect-system.js` instead of breaking the HUD/inspect logic into many tiny helper files
- Moved these responsibilities out of `app.js` into `createInspectSystem(...)`:
  - inspect registry / hover / pin / panel rendering
  - status / skill / destiny inspect item builders
  - path hint HTML assembly
  - inspect container event binding
- Simplified `app.js` so `updateHud()` now asks the inspect system for a single HUD view model, then passes it to `modules/game-ui.js`
- Kept toast/modal/UI rendering in the existing `modules/game-ui.js` module to avoid over-splitting at this stage
- Added script loading for `modules/inspect-system.js` in `index.html`
- Verification:
  - `node --check app.js`
  - `node --check modules/inspect-system.js`
  - develop-web-game smoke run passed with output in `output/web-game/ui-inspect-refactor`
  - reviewed `output/web-game/ui-inspect-refactor/shot-0.png`
  - reviewed `output/web-game/ui-inspect-refactor/shot-inspect-full.png`
  - reviewed `output/web-game/ui-inspect-refactor/state-0.json`
  - reviewed `output/web-game/ui-inspect-refactor/inspect-check.json`
  - targeted browser check confirmed hovering the `飞剑诀` skill card updates the inspect panel correctly
  - no new console/page errors were produced
- Next recommended split:
  - if needed later, move combat helper clusters into one medium-grain gameplay module
  - stop here for demo stage unless app.js grows again

2026-03-22 gameplay helper refactor pass 4

- Followed the "demo-level, medium-grain" split plan and added a single new module: `modules/gameplay-helpers.js`
- Moved the broad shared gameplay helper cluster out of `app.js`, including:
  - destiny/status activity checks
  - skill route / active profile / branch-upgrade helpers
  - combat target selection helpers
  - status aggregation and combat stat calculators
  - barrier/heal/damage helper functions
- Kept the rest of the gameplay flow in `app.js` to avoid over-modularizing the prototype
- `app.js` now wires `createGameplayHelpers(...)` once and reuses the returned helpers across active skills, combat, reward logic, and inspect UI
- Added script loading for `modules/gameplay-helpers.js` in `index.html`
- Verification:
  - `node --check app.js`
  - `node --check modules/gameplay-helpers.js`
  - develop-web-game smoke run passed with output in `output/web-game/gameplay-helper-refactor`
  - reviewed `output/web-game/gameplay-helper-refactor/shot-0.png`
  - reviewed `output/web-game/gameplay-helper-refactor/shot-full.png`
  - reviewed `output/web-game/gameplay-helper-refactor/state-0.json`
  - reviewed `output/web-game/gameplay-helper-refactor/checks.json`
  - targeted browser check confirmed:
    - start flow still opens `命格初定`
    - mini-boss reward flow still opens `道途点化`
    - inspect panel still updates correctly for `飞剑诀`
    - no new console/page errors were produced
- Demo-stage recommendation:
  - structure is now in a reasonable demo state
  - unless new systems are added, stop here instead of splitting more files

2026-03-22 skill vfx follow-up pass 2

- Continued the "技能特效写入代码" pass without changing the current module split.
- Wired a lightweight real-hit feedback layer into the actual combat chain:
  - added `markTargetHitFx(...)` in `modules/gameplay-helpers.js`
  - hooked it into thunder hits, sword projectile hits, greatsword lane ticks, flame-zone ticks, thunderstorm strikes, and guard counter shock/finale
- Upgraded `modules/render/game-renderer.js` so enemies and boss now visibly show:
  - burn / slow status overlays
  - short route-colored hit feedback for sword / thunder / flame / guard impacts
- Strengthened route readability in the renderer:
  - thunder storm route: stronger storm field ring/cloud read
  - thunder chain route: clearer tether + chain-node focus read
  - guard bulwark route: added a short-lived `bulwark-shell` active afterglow tied to the real cast
  - guard counter route: sharper block / reform / break visuals and clearer counter window read
  - sword greatsword route: heavier auto-cast cue instead of only a circular blade hint
- Kept the gameplay logic intact; changes are mainly presentation + trigger metadata on real skill hits.

- Verification:
  - `node --check app.js`
  - `node --check modules/gameplay-helpers.js`
  - `node --check modules/systems/combat-update.js`
  - `node --check modules/render/game-renderer.js`
  - develop-web-game smoke passed:
    - output in `output/web-game/skill-vfx-followup-smoke`
    - reviewed `output/web-game/skill-vfx-followup-smoke/shot-0.png`
    - no smoke `errors-*.json` file was generated
  - targeted Playwright validation passed with reviewed screenshots in `output/route-vfx-validation-2`:
    - thunder storm active: `thunder-storm-shot-0.png`
    - thunder chain active: `thunder-chain-shot-0.png`
    - sword greatsword active: `sword-greatsword-shot-0.png`
    - flame zone active: `flame-zone-shot-0.png`
    - guard bulwark active: `guard-bulwark-shot-0.png`
    - guard counter active: `guard-counter-shot-0.png`
    - reviewed matching `state-0.json` files during the checks
    - no `errors.json` file was generated

- Notes:
  - these are still demo-level combat effects; enemy rigs / sprites / bespoke animation timelines are not added
  - thunder storm and guard bulwark are still shaderless 2D canvas telegraphs, but they are now much easier to read in motion and in captured screenshots

2026-03-22 playable check

- Ran a fresh "can it be played normally right now?" validation pass with the develop-web-game workflow.
- Verified early-run start flow end-to-end:
  - menu -> click `开始试炼`
  - Enter through the opening reward / confirm flow
  - enter active gameplay successfully
- Targeted browser assertions passed:
  - `render_game_to_text` switched to `mode: playing`
  - movement input changed player position (`x +113`, `y +87` in the targeted check)
  - pause button toggled `暂停 -> 继续 -> 暂停`
  - resume returned cleanly to live combat
  - no console or page errors were captured
- Artifacts reviewed:
  - `output/playable-check-targeted/menu.png`
  - `output/playable-check-targeted/playing-before-move.png`
  - `output/playable-check-targeted/playing-after-move.png`
  - `output/playable-check-targeted/paused.png`
  - `output/playable-check-targeted/resumed.png`
  - `output/playable-check-targeted/summary.json`
- Additional develop-web-game smoke:
  - `output/web-game/playable-check-smoke`
  - no `errors-*.json` file was generated
- Longer smoke with real gameplay progression:
  - `output/web-game/playable-check-long-smoke-2`
  - run progressed into combat and then into a valid death/result flow (`mode: result`, `current_modal: reincarnation`) instead of crashing
  - reviewed `output/web-game/playable-check-long-smoke-2/shot-2.png`
  - no `errors-*.json` file was generated

- Current conclusion:
 - in the tested scope, the build is playable
 - I did not run a full boss-clear / shop / ending cycle in this check, so that full-run path still has residual regression risk

2026-03-22 branch timing aligned to current design doc

- Checked `private_docs/GAME_DESIGN_DOC.md` and aligned branch timing to the current repeated spec:
  - branch window now opens only after a skill completes `4` base upgrades
  - in design-doc terms, route choice now starts on the `5`th effective investment into that skill
  - active-skill unlock remains aligned by deriving `ACTIVE_UNLOCK_RANK` from the same threshold
- Added a small runtime branch-window order tracker instead of rewriting the upgrade system:
  - state now records `branchWindowCounter`
  - skills record `branchReadyOrder` the first time they reach the branch threshold
  - the level-up choice picker now guarantees `2` branch options for the earliest pending unbranched skill, matching the design-doc "next level-up reserves 2 route unlock options" rule
- Updated debug helpers so validation matches the real rule:
  - `__debug_prepare_branch_choice(skillId)` now prepares `4` base upgrades / `Rank 5`
  - `__debug_setup_route_active(skillId, routeId)` now seeds route-active setups with at least `4` base upgrades

- Verification:
  - `node --check app.js`
  - `node --check modules/game-data.js`
  - `node --check modules/runtime-state.js`
  - `node --check modules/gameplay-helpers.js`
  - `node --check modules/debug-tools.js`
  - develop-web-game smoke passed:
    - output in `output/web-game/branch-doc-align-smoke-2`
    - reviewed `output/web-game/branch-doc-align-smoke-2/shot-0.png`
    - no smoke `errors*.json` file was generated
  - targeted Playwright branch-window validation passed:
    - sword: with `3` base upgrades, no branch option appeared; with `4` base upgrades, the level-up window showed both sword routes
    - thunder: with `3` base upgrades, no branch option appeared; with `4` base upgrades, the level-up window showed both thunder routes
    - reviewed screenshots:
      - `output/branch-doc-align-targeted/sword-branch-window.png`
      - `output/branch-doc-align-targeted/thunder-branch-window.png`
    - saved assertion output in `output/branch-doc-align-targeted/summary.json`
    - no console/page errors were captured in the targeted validation

- Note:
  - `GAME_DESIGN_DOC.md` still contains an older "at least 2 basic-layer entries" table elsewhere; implementation now follows the repeated `4` base upgrades / `5`th investment wording used in the more explicit sections.

2026-03-22 mini-boss level-up priority

- Adjusted the small-boss post-kill modal order so pending skill upgrades are resolved before the follow-up reward flow.
- Kept the current reward chain intact; only changed the priority:
  - `maybeOpenPendingLevelUp()` no longer hard-blocks on `pendingMiniBossReward`
  - the mini-boss reward handoff now checks `pendingLevelUps` first once reward drops are collected
  - if a level-up is waiting, the level modal opens before `道途点化` / 命格后续界面
  - after the final level-up is chosen, the existing mini-boss reward flow continues on the next update tick

- Verification:
  - `node --check app.js`
  - `node --check modules/systems/combat-update.js`
  - targeted Playwright order validation passed:
    - used the mini-boss reward debug flow plus `1` pending level-up
    - confirmed the first modal after mini-boss reward collection was `level`
    - confirmed the follow-up modal after choosing the upgrade was `dao-pointify`
    - reviewed screenshots:
      - `output/mini-boss-level-priority-check/level-first.png`
      - `output/mini-boss-level-priority-check/followup-after-level.png`
    - saved summary in `output/mini-boss-level-priority-check/summary.json`
    - no console/page errors were captured
 - develop-web-game smoke passed:
    - output in `output/web-game/miniboss-level-priority-smoke`
    - reviewed `output/web-game/miniboss-level-priority-smoke/shot-0.png`
    - no smoke `errors*.json` file was generated

2026-03-23 unified active cooldown to 5s

- Unified the current active-skill base cooldowns to `5s` across all four skills and their routes.
- Kept the existing active-cooldown system structure intact; only normalized the data source:
  - all route `baseCooldown` values in `skillRouteTable` now point to the same `5s` constant
  - `activeSkillTable` fallback values are also `5s`
- This means current route actives no longer differ by base cooldown; later per-route tuning can still be reintroduced from the same data hook if needed.

- Verification:
  - `node --check modules/game-data.js`
  - targeted browser assertion passed:
    - `sword.swarm`, `sword.greatsword`, `thunder.storm`, `thunder.chain`, `flame.meteor`, `flame.zone`, `guard.bulwark`, `guard.counter` all reported `baseCooldown: 5`
    - `activeSkillTable` fallback entries for `sword / thunder / flame / guard` all reported `5`
    - saved summary in `output/active-cooldown-5s-check/summary.json`
    - no console/page errors were captured
 - develop-web-game smoke passed:
    - output in `output/web-game/active-cooldown-5s-smoke`
    - reviewed `output/web-game/active-cooldown-5s-smoke/shot-0.png`
    - no smoke `errors*.json` file was generated

2026-03-23 black-white path feedback and prompt pass

- Aligned the current combat implementation to the live design thresholds and drop values:
  - path cap `100`
  - thresholds `30 / 60 / 100`
  - path drops updated to the current design doc values for normal, ranged, charger, elite, mini-boss, and boss
- Strengthened combat readability for black/white path progression without changing Q/E base logic:
  - added distinct HUD tier states for `1/3`, `2/3`, and full charge
  - added route-colored ready cues, impact rings, and release toasts for white `Q` and black `E`
  - added player route aura rendering and execute markers for black tier-2 targets
- Reworked HUD and inspect text into fact-only presentation:
  - full-slot prompts now use direct state/result wording
  - status inspect is grouped into `gains / losses / fixed`
  - path hint copy now states thresholds and release facts only
- Updated the presentation layer:
  - route-aware toast tones
  - white/black status pill styles
  - inspect section layout for the new fact grouping

- Verification:
  - `node --check app.js`
  - `node --check modules/game-ui.js`
 - `node --check modules/inspect-system.js`
 - `node --check modules/render/game-renderer.js`
 - gameplay validation and feel check pending in this session after the implementation pass

2026-03-23 four schools graduation + active climax pass

- Goal for this pass:
  - make the 8 routes read as 8 distinct end states
  - make route actives feel like route-specific climax buttons instead of generic finishers
  - stay inside the existing design doc route rules, branch rules, and active specs
- Implementation:
  - added route graduation metadata to `modules/game-data.js`
    - route labels aligned to current wording (`数量流 / 大剑流 / 连锁流 / 落雷流 / 伤害流 / 范围流 / 厚盾流 / 弹反流`)
    - added `capstoneName / identityTags / activeClimaxText / graduationSummary`
  - added graduation helpers in `modules/gameplay-helpers.js`
    - route stage computation now distinguishes `prototype / branched / formed / graduated`
    - added capstone gating and graduation notice helpers
  - wired the 8 graduation upgrades into `app.js` level choices
    - `万剑齐发 / 巨阙镇场 / 连锁天雷 / 九霄雷池 / 烬狱轮转 / 焚身领域 / 不灭金钟 / 返天钟鸣`
    - graduation choices only become takeable after the corresponding route reaches formed state
    - pending capstones are force-injected into the choice pool so formed routes can actually graduate in-run
  - strengthened route-specific active behavior in `app.js` + combat/render modules
    - sword swarm: denser sword tide and stronger instant铺场
    - sword greatsword: longer/heavier field sword with stronger压线/Boss pressure
    - thunder chain: faster, more stable追链收割
    - thunder storm: true雷池-style area takeover with heavier opener on heavy targets
    - flame meteor: inner high-heat kill zone and local burnout follow-up
    - flame zone: larger leave-behind ember field for封区
    - guard bulwark: cast-time稳场 reset plus post-break last-stand reform
    - guard counter: longer stronger反制窗口 with higher反震/反弹 payoff
  - improved route readability in `modules/inspect-system.js`, `modules/game-ui.js`, and `styles.css`
    - skill cards now show route badge + stage badge + graduated capstone badge
    - skill cards now show route climax text directly on HUD
    - inspect skill entries now include route stage, capstone name, identity tags, and graduation summary
    - `render_game_to_text` now includes route stage, graduation fields, capstone info, and active pulses
  - improved debug validation in `modules/debug-tools.js`
    - added true graduated setup hook using the real capstone application path
    - tested route skill is now forced into slot 1 for deterministic active validation

- Verification:
  - syntax:
    - `node --check app.js`
    - `node --check modules/inspect-system.js`
    - `node --check modules/game-ui.js`
    - `node --check modules/debug-tools.js`
  - develop-web-game smoke:
    - ran Playwright client against `http://127.0.0.1:4173`
    - artifacts in `output/route-hud-smoke`
  - targeted route graduation validation:
    - artifacts in `output/route-graduation-validation`
    - reviewed screenshots for:
      - `sword-swarm-active.png`
      - `thunder-storm-active.png`
      - `flame-zone-active.png`
      - `guard-counter-active.png`
    - `summary.json` confirms all 8 route actives fired and route stage reported as graduated
    - `upgrade-flow-check.json` confirms all 8 routes follow:
      - capstone unavailable before branch
      - still unavailable after first branch pick
      - available after second branch pick
      - stage progression reads `prototype -> branched -> formed -> graduated`
    - no console/page errors captured in the targeted validation

- Current tuning notes:
  - `guard.counter` looks very explosive in the debug projectile scenario and should get another boss-pattern pass later to make sure it is not over-solving broad encounter types
  - the route validation used targeted graduated setups plus branch-flow checks; a fully natural long-form 3-run feel pass can still be done later if the user wants a deeper endurance check

2026-03-23 three-round boss first playable pass

- Goal for this pass:
  - replace the old shared-boss behavior with `3` different big-boss skill packages and pressure structures
  - keep the existing combat/enemy/runtime base, and only land a first playable version aligned to the current design doc
- Implementation:
  - `balance.js`
    - added `bossRoundTable` with `3` round-specific boss definitions
    - each boss now has its own role, phase thresholds, phase names, pressure sequence, and skill config
  - `app.js`
    - `spawnBoss()` now instantiates the correct round boss instead of scaling one shared template
    - boss state now tracks boss id/name/role, phase thresholds, intent, opening window, and round config
    - boss phase transitions now read per-boss thresholds and clear old boss telegraphs/projectiles on phase shift
  - `modules/systems/combat-update.js`
    - replaced the old single `updateBoss()` pattern cycle with a round-aware boss skill loop
    - landed first-pass boss skill execution:
      - round 1 `问机法傀`: `试锋珠雨 / 裁线 / 断章十字 / 驻印落罚`
      - round 2 `镇路监军`: `伴生压阵 / 督军号令 / 封路判行 / 锁域符`
      - round 3 `终劫真相`: `坠星劫火 / 天锋判矛 / 审判十字 / 内外两断`
    - split boss skills into real behavior categories:
      - counterable boss projectiles carry `counterable !== false`
      - uncounterable boss projectiles/hazards explicitly skip guard projectile reflection
    - added boss telegraph/hazard active effects for lanes, circles, lingering seal zones, ring checks, and cone windups
  - `modules/render/game-renderer.js`
    - added first-pass telegraph rendering for boss cones, lanes, circles, hazard zones, and ring-collapse checks
    - boss now shows name/phase/current skill tag and exposed ring
    - boss projectiles now visually distinguish counterable vs uncounterable shots
  - `modules/game-ui.js`
    - `render_game_to_text` boss payload now includes boss id/name/role, phase name, current skill, skill category, and exposed timer
  - `modules/debug-tools.js`
    - added debug boss hooks for targeted validation:
      - spawn specific round boss
      - set boss hp
      - force boss phase
- Verification:
  - syntax:
    - `node --check app.js`
    - `node --check balance.js`
    - `node --check modules/systems/combat-update.js`
    - `node --check modules/render/game-renderer.js`
    - `node --check modules/game-ui.js`
    - `node --check modules/debug-tools.js`
  - develop-web-game smoke:
    - ran Playwright client against `http://127.0.0.1:4173`
    - latest smoke artifacts in `output/web-game`
  - targeted boss validation:
    - `output/boss-round-validation/summary.json`
      - confirms round-specific boss ids, phase names, and sampled phase skills
    - `output/boss-skill-category-validation/summary.json`
      - confirms all `3` bosses expose both `counterable` and `uncounterable` sampled skills
    - `output/boss-phase-threshold-check.json`
      - confirms real threshold-driven phase transitions:
        - round `1` -> phase `2`
        - round `2` -> phase `2`
        - round `3` -> phase `2` and phase `3`
- Current tuning / follow-up notes:
  - this pass establishes playable first differentiation and boss-duty structure; final numbers are still placeholder-level
  - round `1` opening windows are intentionally long for active-skill teaching and can be tightened later if too forgiving
  - round `2` summon pressure is present but still lightweight; if later feel-testing shows it is too soft, summon timing/count is the first tuning lever
  - round `3` already has distinct multi-phase pressure, but later polish should improve the spectacle/readability of `内外两断` and phase-3 finishing windows

2026-03-23 boss implementation writeback to design doc

- Wrote the completed first-pass three-round boss implementation back into `private_docs/GAME_DESIGN_DOC.md`
- Added:
  - `11.2.1 2026-03-23 首版已落地 Boss 技能包记录`
  - `Boss 首版实现对位记录` under the boss duty bridge tables
- The writeback records:
  - current round-specific boss names
  - current phase names and thresholds
  - current counterable / uncounterable skill split
  - current round-by-round pressure identity
- Intent:
  - keep the design doc aligned with what is already playable in code
  - avoid future regressions back to the old “one shared boss skeleton” understanding
2026-03-23 first-pass stage feel balance retune

- Goal for this pass:
  - retune the first playable balance around small-stage feel instead of only raw difficulty
  - align current runtime values back toward the live design doc for:
    - player base growth pacing
    - stage spawn tempo and enemy composition
    - monster / boss survivability and pressure
    - active-skill base cooldown bands
- Main balance changes:
  - `balance.js`
    - aligned player XP curve closer to the design doc early-growth table
    - added `activeSkillTable` so active cooldowns live in balance data again
    - retuned wave pacing:
      - slower stage-1 spawn cadence
      - lower early wave counts
      - stage-specific enemy weight profiles so stage 1 is mostly grunts, stage 2 mixes in more ranged / charger pressure, and stage 3 tightens again
      - earlier elite schedule so elite pressure can actually appear during real runs
    - reduced baseline small-enemy pressure:
      - lower grunt / charger / ranged HP or damage
      - slower ranged projectile tempo
      - slightly softer elite / mini-boss statline
    - reduced baseline boss statline and softened round-1 boss numbers to better fit its "active-skill teaching / window check" duty
  - `modules/game-data.js`
    - route actives no longer hardcode a unified `5s` cooldown
    - sword / thunder / flame / guard now read their base cooldowns from balance data (`12 / 14 / 13 / 10`)
  - `modules/flow/run-flow.js` + `modules/runtime-state.js` + `app.js`
    - added stage-local elapsed tracking so wave pacing reads per-stage bands instead of one global formula
    - fixed stage spawn logic to actually consume the balance wave table
    - stopped resetting elite progress in a way that prevented scheduled elites from appearing in normal runs
- Verification:
  - syntax:
    - `node --check balance.js`
    - `node --check modules/game-data.js`
    - `node --check modules/runtime-state.js`
    - `node --check modules/flow/run-flow.js`
    - `node --check app.js`
  - targeted browser checks:
    - `output/balance-precheck/summary.json`
      - before the retune, a simple square-movement autoplay could still die in stage 1 before finishing the first small stage
    - `output/balance-postcheck/summary.json`
      - active cooldowns now report `sword 12 / thunder 14 / flame 13 / guard 10`
      - the same autoplay with active usage reached round-1 shop instead of collapsing in stage 1
    - `output/balance-postcheck-noactive/summary.json`
      - no-active run still took meaningful HP pressure, so the pass did not flatten stage 1 into a no-threat opener
    - reviewed screenshots:
      - `output/balance-precheck/final.png`
      - `output/balance-postcheck/final.png`
      - `output/balance-postcheck-noactive/final.png`
  - develop-web-game smoke:
    - ran the Playwright client after the change
    - artifacts in `output/web-game/balance-pass-smoke`
- Current read after the pass:
  - stage 1 now reads closer to "can stabilize and build momentum" instead of "early mixed-pressure dogpile"
  - stage 2 regains space to be the first real mixed-pressure check
  - active skills are back to being timing buttons rather than always-available background DPS
  - round-1 boss is much less likely to become a sponge, though later feel passes should still re-check whether some high-roll sword runs delete it too quickly

2026-03-23 mini-boss combat design pass

- Goal:
  - align mini-boss combat behavior with the design doc's "stage-specific small boss bias" instead of leaving mini-bosses as mostly static HP checks
- Implementation:
  - `balance.js`
    - added `miniBossTable` with 3 stage-bound profiles:
      - `elite_guard`
      - `ranged_elite`
      - `charger_elite`
  - `app.js`
    - `spawnMiniBoss()` now reads the current stage's mini-boss profile
    - mini-bosses now spawn with per-stage base type / stats / behavior config instead of always cloning the same elite shell
    - normalized runtime kill payload so any mini-boss reports as `miniBoss` regardless of base enemy type
    - exposed `spawnMiniBoss` to debug hooks
  - `modules/systems/combat-update.js`
    - added dedicated mini-boss AI branch
    - `elite_guard`:
      - keeps melee pressure
      - periodically emits a short-range guard pulse to stop reading as a pure blood bag
    - `ranged_elite`:
      - maintains distance
      - fires a 3-shot spread at intervals
    - `charger_elite`:
      - uses an explicit `idle -> windup -> dash -> recover` state machine
      - dash impact and landing shock both deal damage
  - `modules/debug-tools.js`
    - added `__debug_spawn_mini_boss(stageIndex)`
    - expanded `__debug_snapshot_runtime()` with enemy projectile and mini-boss state fields for targeted verification
- Verification:
  - syntax:
    - `node --check balance.js`
    - `node --check app.js`
    - `node --check modules/systems/combat-update.js`
    - `node --check modules/debug-tools.js`
  - develop-web-game smoke:
    - ran the Playwright client on `file:///D:/Desktop/WannabeImmortal/index.html`
    - artifacts in `output/web-game/mini-boss-design-smoke`
  - targeted browser validation:
    - used Playwright + `__debug_spawn_mini_boss(stageIndex)` to sample all 3 mini-bosses
    - artifacts in `output/web-game/mini-boss-design-targeted`
    - `summary.json`
      - stage 1 mini-boss reduced player HP and stayed active as `elite_guard`
      - stage 2 mini-boss produced persistent enemy projectiles as `ranged_elite`
      - stage 3 mini-boss reduced player HP and cycled as `charger_elite`
    - `timeline-summary.json`
      - stage 1 reached `maxPulses: 1`
      - stage 2 reached `maxEnemyProjectiles: 5`
      - stage 3 reported `seenStates: idle / windup / dash / recover`
- Follow-up:
  - current pass gives each mini-boss a readable attack identity, but the VFX language is still shared with generic bursts/projectiles
  - if needed, next pass should add stage-specific telegraph visuals so players can distinguish pulse / spread shot / charge windup earlier

2026-03-23 active enemy cap

- Added `waves.maxActiveEnemies = 20` in `balance.js`
- `app.js` spawn flow now stops adding normal waves once active non-boss / non-miniBoss enemies reach the cap
- scheduled elites also respect the same cap and will wait until the live enemy count drops
- mini-boss spawn was intentionally left uncapped so stage settlement cannot stall at target-kill completion

2026-03-23 elite guard telegraph + visible shield

- Goal:
  - make stage-1 mini-boss pulse readable before damage lands
  - give the pulse window a visible "护法" identity instead of an instant hidden AoE
- Implementation:
  - `balance.js`
    - added `pulseTelegraph` and `shieldDamageMult` to `miniBossTable[1]`
  - `modules/systems/combat-update.js`
    - `elite_guard` pulse is now two-step:
      - enter `pulse-windup`
      - hold a short visible shield during the telegraph
      - release the pulse after the windup finishes
    - stored telegraph / shield timing on the mini-boss entity for rendering and damage mitigation
  - `app.js`
    - mini-bosses now take reduced damage while their guard shield is active
  - `modules/render/game-renderer.js`
    - added a visible warning circle around the guard mini-boss before the pulse resolves
    - added a blue shield ring around the mini-boss during the protection window
  - `modules/debug-tools.js`
    - snapshot now includes guard mini-boss telegraph / shield timing fields
- Verification:
  - syntax:
    - `node --check balance.js`
    - `node --check app.js`
    - `node --check modules/systems/combat-update.js`
    - `node --check modules/render/game-renderer.js`
    - `node --check modules/debug-tools.js`
  - targeted browser validation:
    - artifacts in `output/web-game/mini-boss-guard-telegraph`
    - `pulse-windup.png` shows both the telegraph ring and the shield ring on the stage-1 mini-boss
    - `summary.json` captured the mini-boss entering `pulse-windup`

2026-03-23
- Raised stage 2 and 3 mini-boss base stats in balance table for stronger late small-stage pressure.
- Verification: node --check balance.js; Playwright file-url smoke for index.html.

2026-03-23
- Added a clean UTF-8 replacement for the path hint builder in inspect-system and switched runtime use to the clean version.
- Verification: node --check modules/inspect-system.js; Playwright file-url smoke for index.html.

2026-03-23 sword proportion pass

- Adjusted the shared sword glyph in `modules/render/game-renderer.js` to shorten the hilt / pommel and push more visual weight into the blade.
- Added a clearer guard block so the projectile silhouette reads as a sword instead of a spear-like shaft.
- Bumped the renderer cache-bust query in `index.html` so the updated glyph loads on refresh.
- Verification:
  - `node --check modules/render/game-renderer.js`
  - Playwright smoke via `web_game_playwright_client.js` on `file:///D:/Desktop/WannabeImmortal/index.html`
  - targeted Playwright debug captures in `output/web-game/sword-hilt-visual` for `swarm-projectile.png`, `greatsword-projectile.png`, and `greatsword-active.png`

2026-03-23
- Rebalanced base auto cadence/damage so sword, thunder, and flame sit near 60 expected damage over 2 seconds with no upgrades.
- Sword cooldown 0.82, thunder cooldown 0.96, flame tick 0.55 with 16 damage.
- Verification: node --check modules/game-data.js; Playwright file-url smoke for index.html.

2026-03-23 greatsword glow render pass

- Reworked greatsword-route rendering in `modules/render/game-renderer.js` around a new blade-only helper.
- Active greatsword field now renders as a wide glowing sword body with no visible hilt, using the existing warm gold palette.
- Greatsword route cast pulse and auto-cast pulse were updated to reuse the same no-hilt glowing blade silhouette for consistency.
- Bumped the renderer cache-bust query in `index.html`.
- Verification:
  - `node --check modules/render/game-renderer.js`
  - targeted Playwright debug captures in `output/web-game/greatsword-live`
  - visually checked `greatsword-active-live.png`

2026-03-23 sword trail cleanup

- Reworked sword projectile trails in `modules/render/game-renderer.js` from a single bright line into softer layered sword-aura streaks.
- Added a small gap between blade and trail so the tail no longer reads like a hilt or handle.
- Reduced the white highlight intensity and split it into two faint streaks plus an optional center shimmer for heavier variants.
- Bumped the renderer cache-bust query in `index.html`.
- Verification:
  - `node --check modules/render/game-renderer.js`
  - visually checked `output/web-game/swarm-live/swarm-projectile-soft-trail.png`

2026-03-23 boss projectile verification

- Checked the reported round-1 boss white projectile issue against current runtime logic and in-browser simulation.
- No projectile-hit bug found in the current build.
- Debug spawn verification with player barrier/guard cleared:
  - round 1 boss projectile fan spawned 4 `boss-shot` projectiles and the first confirmed hit dealt `10.842` HP
  - round 2 boss projectile fan spawned 3 `boss-shot` projectiles and the first confirmed hit dealt `16.016` HP
  - round 3 boss projectile fan spawned 5 `boss-shot` projectiles and the first confirmed hit dealt `21.404` HP
- Behavior note:
  - these shots go through the normal `enemyProjectiles -> hitPlayer(...)` path
  - post-hit invulnerability means a tight projectile fan usually lands one effective hit instead of the full cluster

2026-03-23 player invulnerability flash

- Added a visible invulnerability flash to the player renderer in `modules/render/game-renderer.js`.
- During player invulnerability:
  - the player body now flickers by lowering and restoring alpha in a fast pulse
  - a thin dashed light ring appears around the player as an explicit invulnerability cue
- Verification:
  - `node --check modules/render/game-renderer.js`
  - Playwright smoke via `web_game_playwright_client.js`
  - targeted browser capture in `output/web-game/player-invuln-flash/invuln-flash.png`
  - runtime summary in `output/web-game/player-invuln-flash/summary.json`

2026-03-23
- Fixed HP bar/text mismatch by removing width transition from the life fill while keeping XP/path fill transitions.
- Verified with Playwright repro: after forcing hp from 160 to 16, DOM width and rendered width both snap to 8%.

2026-03-23
- Added an in-scene HP ratio bar above the player character. No numbers, ratio only.
- Also clamped enemy ratio bar fill widths to avoid overflow.
- Verification: node --check modules/render/game-renderer.js; Playwright scene screenshot with forced player HP.

2026-03-23
- Reduced base flame aura radius from 90 to 45.
- Verification: node --check modules/game-data.js; Playwright file-url smoke for index.html.

2026-03-24
- Added ranged attacks to mini-bosses that previously only had close-range kits: stage 1 elite_guard and stage 3 charger_elite.
- Added projectile params in miniBossTable and a shared mini-boss projectile helper in combat-update.
- Verification: node --check balance.js; node --check modules/systems/combat-update.js; Playwright debug-spawn checks for stage 1 and 3 mini-boss ranged fire.

2026-03-24
- Reworked destiny draws to use one unified pool while keeping alignment tags on each destiny.
- Added tier-based draw weights in `balance.js`: `common` > `true` > `fated`; both normal destiny offers and pointify now use the same weighted pool.
- Reworked pointify:
  - white/black full bars still each grant one pointify opportunity
  - pointify no longer asks for white/black pool selection
  - pointify now returns the chosen equipped destiny to the shared pool and rerolls from the same global pool
  - mixed destinies can now appear from pointify if they are otherwise eligible
  - pointify confirm no longer reveals candidate results before the roll; the outcome is shown only after confirm
- Updated user-facing copy in `index.html`, `modules/inspect-system.js`, `modules/flow/run-flow.js`, and `modules/flow/destiny-flow.js`.
- Updated `private_docs/GAME_DESIGN_DOC.md` to match the unified-pool and pointify-opportunity rules.
- Verification:
  - `node --check app.js`
  - `node --check modules/destiny-helpers.js`
  - `node --check modules/flow/destiny-flow.js`
  - `node --check modules/flow/run-flow.js`
  - `node --check modules/inspect-system.js`
  - Playwright client smoke in `output/web-game/pointify-unified-smoke`
  - targeted Playwright pointify flow in `output/web-game/pointify-unified-targeted`
  - targeted confirm screenshot shows no pre-reveal: `output/web-game/pointify-unified-targeted/confirm.png`
  - targeted result screenshot shows unified-pool reroll outcome: `output/web-game/pointify-unified-targeted/result.png`

2026-03-24
- Added a telegraphed teleport skill to the stage-2 mini-boss `ranged_elite`.
- New behavior:
  - after a cooldown, the boss marks a destination around the player with a visible target ring and guide line
  - after the telegraph window, it blinks to that marked spot, then resumes ranged pressure
- Tuned in `balance.js` with dedicated teleport cooldown, warning duration, destination distance, trigger range, and recovery.
- Extended `render_game_to_text` enemy payload to expose mini-boss state and current teleport target for targeted verification.
- Verification:
  - `node --check balance.js`
  - `node --check modules/systems/combat-update.js`
  - `node --check modules/render/game-renderer.js`
  - `node --check modules/game-ui.js`
  - Playwright client smoke in `output/web-game/ranged-elite-teleport-smoke`
  - targeted Playwright telegraph capture in `output/web-game/ranged-elite-teleport-targeted/telegraph.png`
  - targeted Playwright post-teleport capture in `output/web-game/ranged-elite-teleport-targeted/post-teleport.png`

2026-03-24
- Swarm-route sword active projectiles now disappear on first hit instead of using pierce logic.
- Fix targets the repeated same-target hit behavior on small bosses.
- Verification: node --check modules/systems/combat-update.js; Playwright debug route-active repro for sword swarm.

2026-03-24
- Moved the hint/inspect area into a stacked right-side column below the white/black path panel without merging the two panels.
- Updated desktop layout from four columns to three columns plus a stacked side container.
- Verification: Playwright file-url smoke screenshot for updated right-side layout.

2026-03-24 enemy silhouette pass

- Split enemy body rendering in `modules/render/game-renderer.js` by role instead of drawing every enemy as a plain circle.
- Ranged enemies now render as a diamond / focus-reticle silhouette so they stand apart from melee grunts at a glance.
- Grunts keep a simple round body with a short forward slash mark; chargers get chevrons; elites / mini-bosses gain a ringed frame.
- Bumped the renderer cache-bust query in `index.html`.
- Verification:
  - `node --check modules/render/game-renderer.js`
  - Playwright smoke in `output/web-game/enemy-shape-smoke`
  - targeted debug capture in `output/web-game/enemy-shape-targeted/enemy-types.png`

2026-03-24 elite heavy strike pass

- Added a dedicated short-windup heavy strike to the normal `elite` enemy profile.
- New elite behavior:
  - after a cooldown and within close trigger range, the elite enters `heavy-windup`
  - a visible red warning ring appears before the attack resolves
  - the strike lands as a close burst and then enters a brief recovery state
- Tuned in `balance.js` with dedicated cooldown, trigger range, warning duration, damage multiplier, radius, and recovery.
- Extended `render_game_to_text` enemy payload to expose `elite_state` and the telegraphed strike radius for targeted validation.
- Verification:
  - `node --check balance.js`
  - `node --check modules/systems/combat-update.js`
  - `node --check modules/render/game-renderer.js`
  - `node --check modules/game-ui.js`
  - Playwright smoke in `output/web-game/elite-heavy-smoke`
  - targeted Playwright captures in `output/web-game/elite-heavy-targeted`
  - visually checked `output/web-game/elite-heavy-targeted/windup.png`
  - visually checked `output/web-game/elite-heavy-targeted/recover.png`
  - `console-errors.txt` remained empty in the targeted run

2026-03-24 route offer pool fix

- Fixed route-upgrade offer persistence for branch/capstone choices such as the sword `万剑归宗` line.
- Root cause:
  - branch and capstone offers only checked route-state eligibility
  - they did not record whether a specific route choice had already been taken
  - completed route lines could therefore re-enter the level-up pool and crowd out normal 3-offer windows
- Implementation:
  - `modules/gameplay-helpers.js`
    - added per-skill route-choice tracking via `takenChoices`
    - branch/capstone `canTake` now rejects already-taken choices
    - branch offers also stop once the route already has its two branch points
  - `app.js`
    - each skill now initializes `takenChoices`
    - all branch/capstone level choices now pass their own choice id into the helper layer so they are tracked once taken
- Verification:
  - `node --check app.js`
  - `node --check modules/gameplay-helpers.js`
  - Playwright smoke in `output/web-game/route-offer-bug-smoke`
  - targeted browser verification in `output/web-game/route-offer-bug-targeted`
  - `summary.json` confirms:
    - after `sword-swarm-1`, only `sword-swarm-2` remains in the pool
    - after both branch choices, only `sword-swarm-capstone` remains
    - after capstone, the entire `sword-swarm-*` line is absent from both the raw pool and `availableChoices()`
  - visually checked `output/web-game/route-offer-bug-targeted/final.png`
  - `console-errors.txt` remained empty in the targeted run

2026-03-24 route offer stage split

- Refined the route-offer rule to separate `分路卡` from `分路强化卡`.
- Current rule:
  - before a route is chosen, only the `-1` route-intro cards can enter the pool
  - after a route is chosen, that intro card leaves the pool
  - the chosen route's follow-up `-2` enhancement card can then enter the pool
  - after the follow-up card is taken, the route capstone becomes eligible as before
- Implementation:
  - `modules/gameplay-helpers.js`
    - `canTakeBranchUpgrade` now accepts a branch stage and distinguishes `intro` vs `followup`
  - `app.js`
    - all route `-1` entries now register as `intro`
    - all route `-2` entries now register as `followup`
- Verification:
  - `node --check app.js`
  - `node --check modules/gameplay-helpers.js`
  - Playwright smoke in `output/web-game/route-offer-stage-smoke`
  - targeted verification in `output/web-game/route-offer-stage-targeted`
  - `summary.json` confirms:
    - before route lock, pool contains `sword-swarm-1` and `sword-great-1`, but not `sword-swarm-2`
    - after taking `sword-swarm-1`, pool contains `sword-swarm-2` and no longer contains either intro card
    - after taking `sword-swarm-2`, pool advances to `sword-swarm-capstone`
  - visually checked `output/web-game/route-offer-stage-targeted/final.png`
  - `console-errors.txt` remained empty in the targeted run
2026-03-24 destiny weight refactor

- Implemented the revised destiny reward design:
  - added reward-node tier tables for `opening / smallBoss / bigBoss / shop`
  - added `fortune1` (`福缘残痕`) with `真传 +12% / 级`, `天命 +6% / 级`
  - changed 8 skill rewrite destinies to `alignment: technique`; only the true hybrid trio remains `mixed`
  - mixed destinies now use half-weight as a category modifier
  - unlearned technique destinies can enter the pool while skill slots are not full; once 3 skills are learned, unlearned technique destinies are excluded
  - each 3-offer batch now caps unlearned technique destinies at 1
  - choosing an unlearned-technique destiny now biases the corresponding `new-*` skill choice via `techniqueUnlearnedNewSkillWeightMult`
  - removed black/white path influence from destiny draw weights
  - big-boss destiny generation now records same-run small-boss quality and guarantees a strictly higher offer quality batch when possible
- Hooked the new reward sources into flow:
  - opening reward uses `rewardType: opening`
  - mini-boss reward uses `rewardType: smallBoss`
  - final boss reward uses `rewardType: bigBoss`
  - shop rerolls use the run-scaled `shop` weights
- Verification:
  - `node --check` passed for the touched destiny/helper files
  - batch simulation results after the final fix:
    - opening batch tianming appearance rate ~ `1.24%`
    - unlearned-technique overflow in one batch: `0 / 3000`
    - full 3-skill state leaking unlearned-technique offers: `0 / 3000`
    - big-boss quality failures against same-run small-boss baseline: `0 / 5000`
    - fortune level 5 increases `真传` materially more than `天命` in big-boss reward samples
  - browser smoke:
    - started local static server on `http://127.0.0.1:4173`
    - ran Playwright client and produced `output/web-game/shot-0.png` to `shot-2.png` and matching `state-*.json`
    - no runtime exception was introduced by the destiny refactor during this smoke pass
- Follow-up note:
  - Playwright capture still showed a mismatch between `state.current_modal = "starter-skill"` and the screenshot without a visible modal; this looks like an existing modal/render testing issue rather than a new destiny-logic regression, but it is worth checking in-browser before broader balance testing.

2026-03-24 modal screenshot mismatch fix

- Root cause confirmed: the game modal was rendering correctly, but the Playwright helper in `$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js` preferred raw canvas capture, so DOM overlays like `#modal-root` and `.overlay-message` were omitted from screenshots.
- Fixed the helper by adding visible-overlay detection and forcing a viewport screenshot whenever modal/overlay DOM is present.
- Re-ran the smoke check:
  - `state-0.json` still reports `current_modal = "starter-skill"`
  - `output/web-game/modal-check/shot-0.png` now visibly contains the starter modal
- Conclusion: the inconsistency was in the test harness screenshot path, not in the game modal flow.

2026-03-24 mini-boss damage retune

- Updated the three small bosses to the new damage targets:
  - boss 1 pulse damage = `50`
  - boss 2 teleport damage = `40`, projectile damage = `35`
  - boss 3 dash hit = `75`, shockwave = `50`, shockwave radius = `100`, projectile damage = `40`
- Also fixed a logic/config mismatch so mini-boss projectile damage uses per-boss multipliers from `miniBossTable` instead of partial hardcoded values in combat logic.
- Added a teleport landing damage check for boss 2 and aligned its telegraph radius with the damage radius.
- Verification:
  - `node --check balance.js`
  - `node --check modules/systems/combat-update.js`
  - config smoke output confirmed:
    - boss 1 pulse = `50`
    - boss 2 teleport = `40`, projectile = `35 x 6`
    - boss 3 dash = `75`, shockwave = `50`, projectile = `40 x 4`

2026-03-24 greatsword edge handling tweak

- Adjusted `resolveGreatswordLane` so the greatsword active now only clamps the lane start point.
- The lane end point is no longer clamped back into the arena, which means near-wall casts keep their intended forward length and get visually clipped by the arena boundary instead of being compressed shorter.
- Verification:
  - `node --check app.js`

2026-03-24 greatsword visual length follow-up

- Found a second place that could still make edge casts look shorter: the renderer recomputed greatsword visual length from `endX - startX`.
- Changed the active effect to carry the intended lane length directly, and changed the renderer to prefer `effect.bladeLength` over recomputing from the current segment endpoints.
- Result: greatsword visuals now follow the designed lane length, while the lane start still stays legal.
- Verification:
  - `node --check app.js`
  - `node --check modules/render/game-renderer.js`
