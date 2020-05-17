// Module to hold everything related to handling the goal canvas
// roundRect taken from https://stackoverflow.com/a/3368118/8157027
// Dragging functionality taken from https://stackoverflow.com/a/24938627/8157027
// drawRotated taken from // https://stackoverflow.com/a/17412387/8157027

import { getAssetClone } from './assets';
import { socket } from './networking';

let canvas = document.getElementById("goal-sector");
canvas.width = window.innerWidth * 0.33;
canvas.height = window.innerHeight * 0.09;

let BB = canvas.getBoundingClientRect();
let offsetX = BB.left;
let offsetY = BB.top;

let cube_dim = window.innerHeight * 0.06;
let cube_width = cube_dim + 3;
let cube_height = cube_dim + 2;
let cube_pos_y = canvas.height/8;

let dragok = false;
let startX;

let cubes = [];

function isWithinCube(r, mouseX, mouseY) {
    return mouseX > r.cube_pos_x && mouseX < r.cube_pos_x + cube_width && 
           mouseY > cube_pos_y && mouseY < cube_pos_y + cube_height;
}

// Draw a rounded border around an image on the Canvas
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') {
        stroke = true;
    }
    if (typeof radius === 'undefined') {
        radius = 5;
    }
    if (typeof radius === 'number') {
        radius = {tl: radius, tr: radius, br: radius, bl: radius};
    } else {
        var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
        for (var side in defaultRadius) {
        radius[side] = radius[side] || defaultRadius[side];
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) {
        ctx.fill();
    }
    if (stroke) {
        ctx.stroke();
    }
}

function mouseDown(e) {
    console.log("mouse down");

    e.preventDefault();
    e.stopPropagation();

    let mx = parseInt(e.clientX - offsetX);
    let my = parseInt(e.clientY - offsetY);

    // test each rect to see if mouse is inside
    dragok = false;
    for (var i = cubes.length - 1; i >= 0; i--) {
        var r = cubes[i];
        if (isWithinCube(r, mx, my)) {
            // if yes, set that rects isDragging=true
            dragok = true;
            r.isDragging = true;
            break;
        }
    }

    // save the current mouse position
    startX = mx;
}

function mouseUp(e) {
    console.log("mouse up");

    e.preventDefault();
    e.stopPropagation();

    dragok = false;
    for (var i = 0; i < cubes.length; i++) {
        if (cubes[i].isDragging) {
            cubes[i].isDragging = false;
            socket.emit("x_pos_update", {"order": i, "x_pos": cubes[i].cube_pos_x});
            return;
        }
    }
}

function mouseMove(e) {
    // if we're dragging anything...
    if (dragok) {
        // tell the browser we're handling this mouse event
        e.preventDefault();
        e.stopPropagation();

        // get the current mouse position
        var mx = parseInt(e.clientX - offsetX);

        // calculate the distance the mouse has moved
        // since the last mousemove
        var dx = mx - startX;

        // move each rect that isDragging 
        // by the distance the mouse has moved
        // since the last mousemove
        for (var i = 0; i < cubes.length; i++) {
            var r = cubes[i];
            if (r.isDragging) {
                r.cube_pos_x = Math.min(r.cube_pos_x + dx, canvas.width - width);
                r.cube_pos_x = Math.max(r.cube_pos_x, 4);
                break;
            }
        }

        // redraw the scene with the new rect positions
        drawCubes();

        // reset the starting mouse position for the next mousemove
        startX = mx;
    }
}

function mouseRightClick(e) {

    e.preventDefault();
    e.stopPropagation();
    
    let mx = parseInt(e.clientX - offsetX);
    let my = parseInt(e.clientY - offsetY);

    for (var i = cubes.length - 1; i >= 0; i--) {
        var r = cubes[i];
        if (isWithinCube(r, mx, my)) {
            // if yes, set that rects isDragging=true
            r.orientation = (r.orientation + 90) % 360;
            socket.emit("orientation_update", {"order": i, "orientation": r.orientation});
            break;
        }
    }

    drawCubes();

    return false;
}

// clear the canvas
function clear(context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawCubes() {
    let context = canvas.getContext('2d');
    clear(context);

    context.strokeStyle = '#fff';
    context.lineWidth = 2.5; 

    // redraw each rect in the rects[] array
    for (var i = 0; i < cubes.length; i++) {
        var r = cubes[i];
        drawRotated(context, r.cube, r.cube_pos_x, cube_pos_y, 
                    cube_dim, cube_dim, r.orientation);
    }
}

function drawRotated(context, image, x, y, width, height, degrees) {
    // save the unrotated context of the canvas so we can restore it later
    // the alternative is to untranslate & unrotate after drawing
    context.save();

    // move to the center of image
    context.translate(x + width/2, y + height/2);

    // rotate the canvas to the specified degrees
    context.rotate(degrees*Math.PI/180);

    // draw the image
    // since the context is rotated, the image will be rotated also
    context.drawImage(image,-width/2,-height/2, width, height);
    roundRect(context, -(width/2)-1, -(height/2)-1, width+3, height+2, 7);

    // we’re done with the rotating so restore the unrotated context
    context.restore();
}

function resizeGoalsettingCanvas() {
    canvas.width = window.innerWidth * 0.33;
    canvas.height = window.innerHeight * 0.09;

    BB = canvas.getBoundingClientRect();
    offsetX = BB.left;
    offsetY = BB.top;

    cube_dim = window.innerHeight * 0.06;
    cube_width = cube_dim + 3;
    cube_height = cube_dim + 2;
    cube_pos_y = canvas.height/8;

    // what happens to startX? what if someone resizes window while dragging cube?

    drawCubes();
}

export function registerGoalsettingCanvas() {
    canvas.onmousedown = mouseDown;
    canvas.onmouseup = mouseUp;
    canvas.onmousemove = mouseMove;
    canvas.oncontextmenu = mouseRightClick;
};

export function deregisterGoalsettingCanvas() {
    canvas.onmousedown = () => {};
    canvas.onmouseup = () => {};
    canvas.onmousemove = () => {};
    canvas.oncontextmenu = () => {};
};

export function initializeGoalCanvas(game_info, cube_idx) {
    window.addEventListener("resize", resizeGoalsettingCanvas);

    for (let cube_info of game_info) {
        cubes.push({
            order: cubes.length,  // index within the cubes array 
            idx: cube_info['idx'],
            cube: getAssetClone(cube_info['idx'], cube_idx),
            cube_pos_x: cube_info['x'],
            isDragging: false,
            orientation: cube_info['orientation'],
        });
    }

    drawCubes();
}

export function clearGoalCanvas() {
    // https://stackoverflow.com/questions/1232040/how-do-i-empty-an-array-in-javascript
    cubes.length = 0; // clear the array 
    drawCubes();
}

export function addCubeToGoal(idx, cube_image) {
    let x_pos = canvas.width / 100;
    if (cubes.length !== 0) {
        x_pos += cubes.length * ((3 * x_pos) + cube_width);
    }

    let order = cubes.length;
    cubes.push({
        order: order,
        idx: idx,
        cube: cube_image.cloneNode(true),
        cube_pos_x: x_pos,
        isDragging: false,
        orientation: 0,
    });

    cube_image.remove();
    socket.emit("x_pos_update", {"order": order, "x_pos": x_pos});
    drawCubes();
}

export function updateGoalline(type, i, new_val) {
    if (type === "x_pos") {
        cubes[i].cube_pos_x = new_val;
    }
    else if (type === "orientation") {
        cubes[i].orientation = new_val;
    }
    drawCubes();
}
