// Functions related to moving cubes around the board
import { getAsset } from './assets';
import { emitCubeClicked } from './networking';

const cube_color_map = new Map([
    [0, 'r'],
    [1, 'b'],
    [2, 'g'],
    [3, 'bk'],
]);

const sector_code_map = new Map([
    ["forbidden-sector", 'f'],
    ["permitted-sector", 'p'],
    ["required-sector", 'q'],
    ["goal-sector", 'g'],
]);

let sector_cube_count = {
    "forbidden-sector": 0,
    "permitted-sector": 0,
    "required-sector": 0,
    "goal-sector": 0,
};

export function renderResources(cubes) {
    
    console.log("Rolling cubes!");
    let resources_div = document.getElementById("resources-cubes");
    for (let i = 0; i < cubes.length; ++i) {
        if (cubes[i] === -1) { // TODO -1 is a magic number...
            continue;
        }

        let relevant_th = resources_div.querySelector(`#r${i}`);
        let image_name = `${cube_color_map.get(Math.floor(i/6))}${cubes[i]}.png`;
        let image_clone = getAsset(image_name).cloneNode(true);

        image_clone.onmouseover = () => {
            image_clone.classList.add("show-border");
        };
        image_clone.onmouseout = () => {
            image_clone.classList.remove("show-border");
        };
        image_clone.onclick = () => emitCubeClicked(i);

        relevant_th.appendChild(image_clone);
    }

    console.log("Finished rolling cubes");
}

export function renderGoal(cubes, cube_idx) {
    if (cubes.length > 6) {
        console.log("Something is wrong! Server stored more than 6 cubes in goal!");
    }

    sector_cube_count["goal-sector"] = cubes.length;
    fillSector(cubes, "goal-sector", cube_idx);
}

export function renderSector(cubes, sectorid, cube_idx) {
    let length_limits = [12, 16, 20];
    for (const length of length_limits) {
        if (cubes.length > length) {
            addRowsToSector(sectorid, length);
        }
    }

    sector_cube_count[sectorid] = cubes.length;
    fillSector(cubes, sectorid, cube_idx);
}

function fillSector(cubes, sectorid, cube_idx) {
    for (let i = 0; i < cubes.length; ++i) {
        let relevant_th = document.getElementById(`${sector_code_map.get(sectorid)}${i}`);
        let idx = cubes[i]; // idx is the position that cube was in resources originally

        let image_name = `${cube_color_map.get(Math.floor(idx/6))}${cube_idx[idx]}.png`;
        let image_clone = getAsset(image_name).cloneNode(true);
        if (sectorid === 'goal-sector') {
            image_clone.classList.add("goal-highlight");
        }

        relevant_th.appendChild(image_clone);
    }
}

function clearSector(sectorid) {
    let sector_table = document.getElementById(sectorid).querySelector('table');
    for (let i = 3; i < sector_table.rows.length; ++i) {
        sector_table.deleteRow(i);
    }

    for (let i = 0; i < 12; ++i) { // magic bad
        let th = sector_table.querySelector(`#${sector_code_map.get(sectorid)}${i}`);
        th.innerHTML = '';
    }
}

export function initializeScoreboard(players) {
    let scoreboard = document.getElementById("scoreboard");
    for (let i = 0; i < players.length; ++i) {
        scoreboard.rows[0].cells.item(i).innerHTML = players[i];
    }
    return scoreboard;
}

function fillScoreboardScores(scoreboard, p1scores, p2scores, p3scores) {
    if (typeof p1scores === "undefined") {
        return;
    }

    if (p1scores.length !== p2scores.length || p2scores.length != p3scores.length) {
        console.log("Something is messed up with the scores! Not of same length!");
    }

    for (let i = 0; i < p1scores.length; ++i) {
        addScoreboardScore(scoreboard, p1scores[i], p2scores[i], p3scores[i]);
    }
}

export function addScoreboardScore(scoreboard, p1score, p2score, p3score) {
    if (scoreboard.rows.length === 2 && scoreboard.rows[1].cells[0].innerHTML == 0) {
        scoreboard.deleteRow(1);
    }

    let new_row = scoreboard.insertRow();
    new_row.insertCell().innerHTML = p1score;
    new_row.insertCell().innerHTML = p2score;
    new_row.insertCell().innerHTML = p3score;
}

export function highlightResourcesCube(position) {
    // Should never receive highlight_cube on an invalid pos 
    // Server checks that pos in resources is valid
    let surrounding_th = document.getElementById(`r${position}`);
    let image = surrounding_th.querySelector("img");
    image.classList.add("highlight-img");
}

export function updateTurnText(name) {
    let turn_elt = document.getElementById("actual-turn-text");
    turn_elt.innerHTML = `${name}`;
}

export function moveCube(directions) {
    let from_idx = directions['from'];

    let num_cubes_in_sector = sector_cube_count[directions['to']];
    let to_id = `${sector_code_map.get(directions['to'])}${num_cubes_in_sector}`;

    if (num_cubes_in_sector === 12 || num_cubes_in_sector === 16 
        || num_cubes_in_sector === 20) {
        addRowsToSector(directions['to'], num_cubes_in_sector);
    }

    sector_cube_count[directions['to']]++;
    let img_in_resources = document.getElementById("resources-cubes")
        .querySelector(`#r${from_idx}`).querySelector("img");
    
    img_in_resources.onmouseover = () => {};
    img_in_resources.onmouseout = () => {};
    img_in_resources.classList.remove("highlight-img");
    if (directions['to'] === 'goal-sector') {
        img_in_resources.classList.add("goal-highlight");
    }
    
    document.getElementById(to_id).appendChild(img_in_resources);
    updateBonusButton(false);
}

function addRowsToSector(sectorid, begin_idx) {
    // console.log(`inserting row into table for ${sectorid} at ${begin_idx / 4}`);
    let table = document.getElementById(sectorid).querySelector('table');
    let new_row = table.insertRow();

    for (let i = 0; i < 4; ++i) {
        let new_cell = new_row.insertCell();
        new_cell.id = `${sector_code_map.get(sectorid)}${begin_idx + i}`;
    }
}

// Render all visuals, including the board, resources/cubes, and scoreboard
export const renderGameVisuals = (game) => {
    fillScoreboardScores(initializeScoreboard(game['players']), 
        game["p1scores"], game["p2scores"], game["p3scores"]);
    
    if (game["game_finished"]) {
        updateTurnText("Game Ended");
    }
    else if (!game["game_started"]) {
        updateTurnText("Not Started");
    }
    else {
        updateTurnText(game['players'][game['turn']]);
    }

    if (game["game_started"]) {
        document.getElementById("start_game").remove();
        if (game["goalset"]) {
            hideNoGoalButton();
        }

        renderResources(game['resources']);
        renderGoal(game['goal'], game['cube_index']);
        renderSector(game['forbidden'], "forbidden-sector", game['cube_index']);
        renderSector(game['permitted'], "permitted-sector", game['cube_index']);
        renderSector(game['required'], "required-sector", game['cube_index']);
    } 

    // TODO Remember to expand upon once more game features are added
    // TODO time, scores
}

export function updateBonusButton(show) {
    let bonus_button = document.getElementById("bonus-button");
    bonus_button.classList.remove("button-clicked");
    if (show) {
        bonus_button.classList.remove("hidden");
    }
    else {
        bonus_button.classList.add("hidden");
    }
}

export function hideNoGoalButton() {
    let no_goal_button = document.getElementById("no_goal");
    no_goal_button.classList.add("hidden");
    no_goal_button.onclick = () => 
        console.log("No goal challenge somehow clicked...");
}

// Clear everything on the mat
export function clearBoard() {
    let sectorids = ['goal-sector', 'forbidden-sector', 
                     'permitted-sector', 'required-sector'];
    for (let sectorid of sectorids) {
        clearSector(sectorid);
    }
}
