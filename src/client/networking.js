// Handle client networking.

import io from 'socket.io-client';
import { cleanInput, appendMessage, appendServerMessage, appendSidingOptions, 
         appendSolutionPrompt, appendAcceptPrompt, appendAssentToRejectPrompt, 
         appendStartNewShakeButton, appendInstructions } from './message_utils';
import { renderResources, initializeScoreboard, addScoreboardScore,
    highlightResourcesCube, unhighlightResourcesCube, updateTurnText, moveCube, 
    renderGameVisuals, updateBonusButton, hideGoalSettingButtons, clearBoard,
    num_resources_cubes } from './board';
import { initializeBoardCallbacks, registerGoalSetting, 
         registerStartButton, deregisterBoardCallbacks } from './callbacks';
import { updateGoalline } from './goal';

const socketProtocol = (window.location.protocol.includes('https')) ? 'wss' : 'ws';
export const socket = io(`${socketProtocol}://${window.location.host}`, {reconnection: false});
const connectedPromise = new Promise(resolve => {
    socket.on('connect', () => {
        console.log('Connected to server!');
        resolve();
    });
});

export const connect = () => {
    connectedPromise.then(() => {
        // Retrieve room and player info
        let room_nonce = document.getElementById("room-nonce").innerHTML;
        let name = document.getElementById("name").innerHTML;

        let player_info = {
            'room': room_nonce, 
            'name': name,
        };

        // Register callbacks
        registerSocketCallbacks(name);

        // Tell server wanna join
        console.log(`Connecting as ${name} in room ${room_nonce}`);
        socket.emit("register_client", player_info);
    })
    .catch((error) => console.log("Error: ", error));
}

function registerSocketCallbacks(name) {
    socket.on('disconnect', () => console.log(`disconnected from room`));

    socket.on('message', (message_info) => appendMessage(message_info['name'], 
                                                         message_info['message']));
    socket.on("server_message", (message) => appendServerMessage(message));

    // Render every visual aspect of the board correctly for a spectator.
    // Required only if game has started
    socket.on("render_spectator_state", (game) => renderGameVisuals(game));

    // Joined as player. Render visuals as well as register callbacks as
    // appropriate (according to whether game has started)
    socket.on("render_player_state", (game) => {
        renderGameVisuals(game);
        if (game['game_finished']) {
            return;
        }

        if (game['game_started']) {
            initializeBoardCallbacks(socket, show_bonus_for(game, name));
            registerGoalSetting(socket, name, game['players'][game['turn']], !game["goalset"]);
        }
        else {
            registerStartButton(socket);
        }
    });

    socket.on("new_player", initializeScoreboard);
    socket.on("player_left", initializeScoreboard);
    
    socket.on("begin_game", (data) => {
        let cubes = data['cubes']
        document.getElementById("start_game").remove();
        
        appendServerMessage(`${data['starter']} started the game! The cubes have been rolled!`);
        appendServerMessage(`${data['goalsetter']} is chosen to be the goalsetter.`);
        appendInstructions();

        if (data['starter'] === name) {
            appendServerMessage("Press \"Goal Set!\" when you're done!");
        }
        else {
            appendServerMessage(`Waiting for ${data['goalsetter']} to finish setting the goal...`);
        }

        renderResources(cubes);
        addScoreboardScore(initializeScoreboard(data['players']), 0, 0, 0);

        let firstmover = data['goalsetter'];
        initializeBoardCallbacks(socket, firstmover === name);
        updateTurnText(firstmover);
        registerGoalSetting(socket, name, firstmover, true);
    });

    socket.on("begin_shake", (data) => {
        let new_shake_button = document.getElementById("new_shake_button");
        if (new_shake_button) {
            new_shake_button.remove();
        }

        appendServerMessage(`A new shake has started! ${data['goalsetter']} is chosen to be the goalsetter.`);
        clearBoard();
        renderResources(data['cubes']);

        let firstmover = data['goalsetter'];
        initializeBoardCallbacks(socket, firstmover === name && data['show_bonus']);
        updateTurnText(firstmover);
        registerGoalSetting(socket, name, firstmover, true);
    });

    socket.on("hide_goal_setting_buttons", () => hideGoalSettingButtons());
    socket.on("update_goalline", (data) => {
        updateGoalline(data['type'], data['order'], data['new_val']);
    });

    socket.on("highlight_cube", (pos) => highlightResourcesCube(pos));
    socket.on("unhighlight_cube", (pos) => unhighlightResourcesCube(pos));

    socket.on("move_cube", (directions) => moveCube(directions));

    socket.on("next_turn", (command) => {
        let player = command["player"];
        let show_bonus = command["show_bonus"];

        updateTurnText(player);
        updateBonusButton((player === name) && show_bonus);
        
        // TODO timer stuff potentially
    });

    // TODO move
    const challengeTextMap = new Map([
        ["a_flub", "Challenge Now"],
        ["p_flub", "Challenge Never"],
        ["no_goal", "Challenge No Goal"],
    ]);

    socket.on("handle_challenge", (info) => {
        let challenge = info["challenge"];
        let defender = info["defender"];
        let caller = info["caller"];
        let sider = info["sider"];

        console.log("handle_challenge", challenge, defender, caller, sider);
        console.log(challengeTextMap);
        console.log(challengeTextMap.get(challenge));

        deregisterBoardCallbacks();
        updateTurnText(challengeTextMap.get(challenge));

        if (challenge === "no_goal") {
            // TODO
            return;
        }

        if (sider != null) {
            if (sider === name) {
                appendSidingOptions(socket);
            }
            else {
                appendServerMessage(`Waiting for ${sider} to side...`);
            }
        }

        if ((defender === name && challenge === "p_flub") || (caller === name && challenge === "a_flub")) {
            appendSolutionPrompt(socket);
        }
        else {
            appendServerMessage("Waiting for solutions to be submitted....");
        }
    });

    socket.on("force_out", () => {
        deregisterBoardCallbacks();
        updateTurnText("Force Out");

        appendServerMessage("It is now Force Out.");
        appendSolutionPrompt(socket);
    });
    
    socket.on("review_solutions", (review_soln_msg) => {
        appendServerMessage("Time to review solutions!");
        
        let solutions = review_soln_msg["solutions"];
        let players = review_soln_msg["players"];

        let reviewing_one = false;
        for (let writer in solutions) {
            if (writer === name) {
                continue;
            }

            reviewing_one = true;
            appendAcceptPrompt(socket, writer, solutions[writer], false, players.includes(name));
        }

        if (!reviewing_one) {
            appendServerMessage("Waiting for others to finish reviewing solutions...");
        }
    });

    socket.on("rejection_assent", (info) => {
        let rejecter = info['rejecter'];
        let writer = info['writer'];

        if (writer !== name) {
            appendServerMessage(`Waiting for ${writer} to accept the rejection...`);
            return;
        }

        appendAssentToRejectPrompt(socket, rejecter);
    });

    socket.on("reevaluate_solution", (info) => {
        let rejecter = info['rejecter'];
        let writer = info['writer'];
        let solution = info['solution'];

        if (rejecter !== name) {
            let msg_pt1 = `${writer} does not agree that his/her solution `;
            let msg_pt2 = `is incorrect. Waiting for ${rejecter} to re-evaluate `;
            let msg_pt3 = "whether the solution is correct...";

            appendServerMessage(`${msg_pt1}${msg_pt2}${msg_pt3}`);
            return;
        }

        appendAcceptPrompt(socket, writer, solution, true, true);
    });

    socket.on("finish_shake", (scores) => {
        let p1score = scores['p1score'];
        let p2score = scores['p2score'];
        let p3score = scores['p3score'];
        let players = scores['players'];

        appendServerMessage("This shake has finished! The scoreboard has been updated.");
        addScoreboardScore(document.getElementById("scoreboard"), p1score, p2score, p3score);
        if (players.includes(name)) {
            appendStartNewShakeButton(socket);
        }
        else {
            appendServerMessage("Waiting for players to start a new shake...");
        }
    });
}

export function handleChatEnter() {
    let $window = $(window);
    let $inputMessage = $('.inputMessage');
    $window.keydown(event => {
        // enter key was pressed
        if ($inputMessage.is(":focus") && event.which === 13 && $inputMessage.val().length > 0) {
            let message = $inputMessage.val();
            let name = document.getElementById("name").innerHTML;
            message = cleanInput(message);

            $inputMessage.val('');
            socket.emit('new_message', {'name': name, 'message': message});
        }
    });
}

export const emitCubeClicked = (pos) => socket.emit("cube_clicked", pos);

// Determine whether bonus button should be rendered for player in game
function show_bonus_for(game, player) {
    if (game['players'][game['turn']] != player) {
        return false;
    }

    if (num_resources_cubes() < 2) {
        // console.log("Can't bonus with less than 2 cubes in resources");
        return false;
    }

    if (game['started_move']) {
        // started_move indicates that a cube has been moved
        return false;
    }

    const idx = game['players'].findIndex((name) => name === player);
    if (idx === -1) {
        console.log("Error! Player not in game in render_player_state");
        return false;
    }
    
    const adder = (acc, curr) => acc + curr;
    const player_score = game[`p${idx+1}scores`].reduce(adder);

    let p1score = game['p1scores'].reduce(adder);
    let p2score = game['p2scores'].reduce(adder);
    let p3score = game['p3scores'].reduce(adder);
    let scores = [p1score, p2score, p3score];

    let num_greater = 0;
    for (let score of scores) {
        if (player_score > score) {
            ++num_greater;
        }
    }

    if (num_greater === 2) {
        return false;
    }

    return true;
}

export function bonusButtonCallback() {
    this.classList.toggle("button-clicked");
    socket.emit("bonus_clicked");
}
