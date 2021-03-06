"use strict";

(function () {

    var inventaire = { commander: {}, deck: []};
    var original_hash;
    var step = 0;
    var best = original_hash;
    var best_value = 0;
    var originalValue = 0;
    var cardBest= {};
    var cardBestValue = {};
    var orderDeckMode = true;
    var rankingMode = false;
    var level

    // Initialize simulation loop - runs once per simulation session
    SIM_CONTROLLER.startsim = function () {
        time_start = Date.now();

        SIM_CONTROLLER.getConfiguration();
        inventaire = hash_decode(document.getElementById('inventory').value);

        // Set up battleground effects, if any
        SIMULATOR.battlegrounds = getBattlegrounds(getbattleground, getraid);
// 9216 9227 9252 9241

        hideUI();

        step = -1;
        best = original_hash = getdeck;
        best_value = 0;
        orderDeckMode = document.getElementById("sim_order").checked;
        if (orderDeckMode) {
            getordered = orderDeckMode;
        }
        rankingMode = document.getElementById("sim_ranking").checked;
        var onlyInventory = document.getElementById("only_inv").checked;

        if (rankingMode && !onlyInventory) {
            var originalDeck = hash_decode(original_hash).deck.map(x => x.id);
            var inventaireDeck = inventaire.deck.map(x => x.id);
            
            var deck = [];
            var cardIds = [];
            for (var cardId in CARDS) {
                cardIds.push(Number(cardId));
            }

            cardIds.sort((a,b) => b - a);

            for (var cardId of cardIds) {
                var card = CARDS[cardId];
                if (parseInt(card.rarity) >= 3 && card.set != "7000" && card.set != "9999") {
                    var fusion = FUSIONS[cardId];
                    var fusionCard = fusion && CARDS[fusion];
                    if (!fusionCard || fusionCard.rarity != card.rarity || originalDeck.some(x => x == Number(cardId)) || inventaireDeck.some(x => x == Number(cardId))) {
                        deck.push(makeUnitInfo(cardId, card.maxLevel, []));
                    }
                }
            }
            inventaire.deck = deck;
        }

        tryNewCard();
        return false;
    }

    var targetPosition = 0;
    var lastDeckHash = original_hash;
    var currentCardName;

// Coût pour faire un double: 3*(5+15+30+75) = 375
// Coût pour faire un simple légendaire : 5+15+30+75+150 = 275

    function tryNewCard(){
        var progression = document.getElementById('progression');
        total_turns = 0;
        matchTimer.reset();
        time_start = new Date();
        time_stop = 0;
        echo = '';
        games = 0;
        run_sims_batch = 0;
        sims_left = document.getElementById('sims').value;
        if (step >= 0) {
            var originalDeck = hash_decode(original_hash);
            var deckLength = originalDeck.deck.length;
            if (orderDeckMode) {
                if (targetPosition == 0) {
                    step++;
                    targetPosition = step - 1;
                    original_hash = best;

                    if (targetPosition == deckLength) {
                        return;
                    }
                }
                else {
                    targetPosition--;
                }
                var log = '<strong>Etape ' + step + '/' + (originalDeck.deck.length - 1) + " target=" + targetPosition + '</strong> == <strong>Best:</strong>' + best + ' (' + best_value + ' dernier=' + wins + ') <table>';
               for (var cardName in cardBest) {
                   log += '<tr><td>' + cardName + '</td><td>' + cardBest[cardName] + '</td><td>' + cardBestValue[cardName] + '</td></tr>';
               }
               log += '</table>'
               progression.innerHTML = log;
                 var cards = originalDeck.deck.splice(step, 1);
                originalDeck.deck.splice(targetPosition, 0, cards[0]);
                getdeck = hash_encode(originalDeck);
            }
            else if (rankingMode){
                var cardToTry = ~~(step);
                var log = '<strong>Etape ' + step + '/' + (inventaire.deck.length) + '</strong> == <strong>Best:</strong>' + best + ' (' + best_value + ')';
                log += '<table>';
                for (var cardName in cardBest) {
                    var card = CARDS[cardName];
                    log += '<tr><td>' + [card.name, cardBestValue[cardName], card.rarity, card.set, card.type, card.sub_type.join(',')].join('</td><td>') + '</td></tr>';
                }
                log += '</table>'
                progression.innerHTML = log;
               
                if (cardToTry >= inventaire.deck.length) {
                    return;
                }
                currentCardName = inventaire.deck[cardToTry].id;
                for (var deckCardToReplace = 13; deckCardToReplace <= 15; deckCardToReplace++)
                    originalDeck.deck[deckCardToReplace] = inventaire.deck[cardToTry];
                getdeck = hash_encode(originalDeck);
                step++;
            }
            else{
                var cardToTry = ~~(step / deckLength);
                var deckCardToReplace = step % deckLength;
                var log = '<strong>Etape ' + step + '/' + (originalDeck.deck.length * inventaire.deck.length) + '</strong> == <strong>Best:</strong>' + best + ' (' + best_value + ')';
                log += '<table>';
                log += '<tr><td>Original</td><td>' + original_hash + '</td><td>' + originalValue + '</td></tr>';
                for (var cardName in cardBest) {
                   log += '<tr><td>' + CARDS[cardName].name + '</td><td>' + cardBest[cardName] + '</td><td>' + cardBestValue[cardName] + '</td></tr>';
               }
               log += '</table>'
                progression.innerHTML = log;
               
                if (cardToTry >= inventaire.deck.length) {
                    return;
                }
                currentCardName = inventaire.deck[cardToTry].id;
                originalDeck.deck[deckCardToReplace] = inventaire.deck[cardToTry];
                getdeck = hash_encode(originalDeck);
                step++;
            }
        }
        else{
            step = 0;
            getdeck = original_hash;
        }   

        // Set up battleground effects, if any
        SIMULATOR.battlegrounds = getBattlegrounds(getbattleground, selfbges, enemybges, mapbges, getcampaign, missionlevel, getraid, raidlevel);

        SIMULATOR.setupDecks();

        wins = 0;
        losses = 0;
        draws = 0;
        points = 0;

        outp(""); // Clear display
        if (!SIMULATOR.user_controlled) {
            hideTable();
            setSimStatus("Initializing simulations...");
        } else {
            setSimStatus("");
        }

        current_timeout = setTimeout(run_sims);

        return false;
    };

    // Interrupt simulations
    SIM_CONTROLLER.stopsim = function () {
        matchTimer.stop();
        var elapse = matchTimer.elapsed();
        var simpersec = games / elapse;
        simpersec = simpersec.toFixed(2);
        SIMULATOR.simulating = false;

        // Stop the recursion
        if (current_timeout) clearTimeout(current_timeout);
        if (!SIMULATOR.user_controlled) {
            setSimStatus("Simulations interrupted.", elapse, simpersec);
            showWinrate();
        }
        showUI();

        if (SIM_CONTROLLER.stop_sims_callback) SIM_CONTROLLER.stop_sims_callback();
    };

    function run_sims() {

        if (SIMULATOR.user_controlled) {
            if (run_sim(true)) {
                SIM_CONTROLLER.debug_end();
            }
        } else if ((debug || play_debug) && !mass_debug && !loss_debug && !win_debug) {
            run_sim(true);
            SIM_CONTROLLER.debug_end();
        } else if (sims_left > 0) {
            // Interval output - speeds up simulations
            if (run_sims_count >= run_sims_batch) {
                var simpersecbatch = 0;
                if (run_sims_batch > 0) { // Use run_sims_batch == 0 to imply a fresh set of simulations
                    run_sims_count = 0;
                    var temp = games / (games + sims_left) * 100;
                    temp = temp.toFixed(2);

                    var elapse = matchTimer.elapsed();

                    var batch_elapse = matchTimer.batchElapsed();
                    if (batch_elapse == 0) {
                        simpersecbatch = 0;
                    } else {
                        simpersecbatch = run_sims_batch / batch_elapse;
                    }

                    setSimStatus("Running simulations...", elapse, simpersecbatch.toFixed(1));
                    showWinrate();
                }
                run_sims_batch = 1;
                if (simpersecbatch > run_sims_batch) // If we can run more at one time, then var's try to
                    run_sims_batch = Math.ceil(simpersecbatch / 8);
                if (run_sims_batch > sims_left) // Also limit by how many sims are left
                    run_sims_batch = sims_left;

                // Batch messes up mass debug and loss debug! var's disable batch!
                if ((debug || play_debug) && (mass_debug || loss_debug || win_debug)) run_sims_batch = 1;

                matchTimer.startBatch();
                current_timeout = setTimeout(run_sims, 1);
                for (var i = 0; i < run_sims_batch; i++) {  // Start a new batch
                    run_sim();
                }
            }
        } else {
            run_sims_count = 0;
            run_sims_batch = 0;
            matchTimer.stop();

            var elapse = matchTimer.elapsed();
            var simpersec = games / elapse;
            simpersec = simpersec.toFixed(2);

            if (echo) {
                outp(echo);
            }
            setSimStatus("Simulations complete.", elapse, simpersec);
            showWinrate();

            showUI();

            if (SIM_CONTROLLER.end_sims_callback) SIM_CONTROLLER.end_sims_callback();

            if (wins > best_value){
                best_value = wins;
                best = getdeck;
            }

            if (currentCardName) {
                if (!cardBestValue[currentCardName] || wins > cardBestValue[currentCardName]){
                    cardBestValue[currentCardName] = wins;
                    cardBest[currentCardName] = getdeck;
                }
            }
            else{
                originalValue = wins;
            }
            
            setTimeout(tryNewCard, 100);
        }
    }

    // Initializes a single simulation - runs once before each individual simulation
    // - needs to reset the decks and fields before each simulation
    var seedtest = (_GET("seedtest") || 0);
    function run_sim(skipResults) {
        if (seedtest) {
            Math.seedrandom(seedtest++);
        }
        if (!SIMULATOR.simulate()) return false;
        if (!skipResults) SIM_CONTROLLER.processSimResult();
    }

    SIM_CONTROLLER.processSimResult = function () {

        var result;
        if (!SIMULATOR.field.player.commander.isAlive()) {
            result = false;
        }
        else if (!SIMULATOR.field.cpu.commander.isAlive()) {
            result = true;
        }
        else {
            result = 'draw';
        }

        if (run_sims_batch > 0) {
            if (sims_left > 0) sims_left--;
            run_sims_count++;
        }

        // Increment wins/losses/games
        if (result == 'draw') {
            draws++;
        } else if (result) {
            wins++;
        } else {
            losses++;
        }
        points += SIMULATOR.calculatePoints();
        games++;

        // Increment total turn count
        total_turns += SIMULATOR.simulation_turns;

        if (debug || play_debug) {
            if (loss_debug) {
                if (result == 'draw') {
                    echo = 'Draw found after ' + games + ' games. Displaying debug output... <br><br>' + echo;
                    echo += '<br><h1>DRAW</h1><br>';
                    sims_left = 0;
                } else if (result) {
                    if (!sims_left) {
                        echo = 'No losses found after ' + games + ' games. No debug output to display.<br><br>';
                        sims_left = 0;
                    } else {
                        echo = '';
                    }
                } else {
                    echo = 'Loss found after ' + games + ' games. Displaying debug output... <br><br>' + echo;
                    echo += '<br><h1>LOSS</h1><br>';
                    sims_left = 0;
                }
            } else if (win_debug) {
                if (result && result != 'draw') {
                    echo = 'Win found after ' + games + ' games. Displaying debug output... <br><br>' + echo;
                    echo += '<br><h1>WIN</h1><br>';
                    sims_left = 0;
                } else {
                    if (!sims_left) {
                        echo = 'No wins found after ' + games + ' games. No debug output to display.<br><br>';
                        sims_left = 0;
                    } else {
                        echo = '';
                    }
                }
            } else if (mass_debug) {
                if (result == 'draw') {
                    echo += '<br><h1>DRAW</h1><br>';
                } else if (result) {
                    echo += '<br><h1>WIN</h1><br>';
                } else {
                    echo += '<br><h1>LOSS</h1><br>';
                }
            }

            if (mass_debug && sims_left) echo += '<br><hr>NEW BATTLE BEGINS<hr><br>';
        }

        return result;
    };

    // Global variables used by single-threaded simulator
    var run_sims_count = 0;
    var run_sims_batch = 0;
})();