"""Show the homepage."""

import os
import uuid
import flask
import equations
from equations.data import rooms_info, user_info, MapsLock
from equations.db_serialize import db_deserialize
from equations.models import User, Game

@equations.app.route("/favicon.ico")
def show_favicon():
    """Deliver the favicon asset."""
    return flask.send_from_directory(os.path.join(
        equations.app.root_path, 'static', 'images'), 'favicon.ico')

@equations.app.route("/", methods=['GET'])
def show_index():
    """Show homepage."""
    context = {
        "logged_in": False,
        "username": '',
        "gamerooms": [],
    }

    if "username" in flask.session:
        context['logged_in'] = True
        context['username'] = flask.session['username']

    MapsLock()
    if context['username'] in user_info:
        gamerooms = user_info[context['username']]["gamerooms"]
        for gameroom in gamerooms:
            if gameroom in rooms_info and rooms_info[gameroom]["game_started"] \
                    and not rooms_info[gameroom]["game_finished"]:
                context["gamerooms"].append(gameroom)

    return flask.render_template("index.html", **context)

@equations.app.route("/create/", methods=['POST'])
def create_game():
    """Create a new game."""
    if 'username' not in flask.session:
        flask.flash("Please log in before creating a game.")
        return flask.redirect(flask.url_for('show_index'))

    name = flask.session['username']

    # This is ugly and might break if enough games are played
    game_nonce = None
    while game_nonce is None:
        # Warning/Notice: Only 36^4 (about 1.68 million) unique game 
        # nonces under this scheme
        proposed_nonce = str(uuid.uuid4()).replace('-', '')[:4].upper()

        conflicting_games = Game.query.filter_by(nonce=proposed_nonce).all()
        if len(conflicting_games) == 0:
            game_nonce = proposed_nonce

    new_game = Game(nonce=game_nonce)
    equations.db.session.add(new_game)
    equations.db.session.commit()

    # This is a new game room and players joins as player by default
    assert game_nonce not in rooms_info
    rooms_info[game_nonce] = {
        "connections": 0,
        "game_started": False,
        "game_finished": False,
        "players": [name],
        "spectators": [],
        "sockets": [],
    }

    if name not in user_info:
        user_info[name] = {
            "latest_socketids": {},
            "gamerooms": set(),
            "room_modes": {},
            "room_connection_count": {},
        }
    else:
        assert game_nonce not in user_info[name]["latest_socketids"].keys()
        assert game_nonce not in user_info[name]['gamerooms']
        assert game_nonce not in user_info[name]["room_modes"].keys()
    
    user_info[name]["latest_socketids"][game_nonce] = []
    user_info[name]['gamerooms'].add(game_nonce)
    user_info[name]['room_modes'][game_nonce] = equations.data.PLAYER_MODE

    return flask.redirect(flask.url_for('show_game', nonce=game_nonce))

def get_game_from_db(room_id):
    """Helper function to get a game from the DB and do checks on it.
    Returns whether game was found."""
    game_info = Game.query.filter_by(nonce=room_id).all()
    
    if len(game_info) == 0: 
        return False
    assert len(game_info) == 1

    if game_info[0].ended and room_id not in rooms_info:
        rooms_info[room_id] = db_deserialize(game_info[0])

    # Here, room can possibly still not be in rooms_info if game_info['ended'] is 0. 
    # If the game has started, then if the room is not in the rooms_info map, then 
    # by invariant the game must have ended (see on_disconnect in connections.py).

    return True

def initialize_user_info_elt(name, room):
    """Create an entry for a user in a room in the user_info map if necessary."""
    if name not in user_info:
        user_info[name] = {
            "latest_socketids": {},
            "gamerooms": set(),
            "room_modes": {},
            "room_connection_count": {},
        }
        print("Created new user_info: ", user_info)

    if room not in user_info[name]["latest_socketids"]: 
        user_info[name]["latest_socketids"][room] = []
    
    # if room not in user_info[name]["room_modes"]:
    #     user_info[name]["room_modes"][room] = equations.data.REJOINED_MODE  # default
    #     print("Set room mode for ", name, " in room ", room)
    #     print(user_info)
    
    print("Accessing user_info for conn ct: ", user_info)
    if room not in user_info[name]["room_connection_count"]:
        user_info[name]["room_connection_count"][room] = 0


def initialize_room_info_elt(room):
    """Create an entry for a room in the room_info map if necessary."""
    if room not in rooms_info:
        print("Was not here before")
        rooms_info[room] = {
            "connections": 0,
            "game_started": False,
            "game_finished": False,
            "players": [],
            "spectators": [],
            "sockets": [],
            # "p1scores": [],
            # "p2scores": [],
            # "p3scores": [],
            # "cube_index": [],
            # "resources": [],
            # "goal": [],
            # "required": [],
            # "permitted": [],
            # "forbidden": [],
            # "turn": None, # -1?
        }
    print("Rooms info: ", rooms_info)

@equations.app.route("/join/", methods=['POST'])
def join_game():
    """Join an existing game."""
    if 'username' not in flask.session:
        flask.flash("Please log in before creating a game.")
        return flask.redirect(flask.url_for('show_index'))

    name = flask.session['username']
    room = flask.request.form['room']

    MapsLock()
    if not get_game_from_db(room):
        flask.flash(f"The Room ID you entered ({room}) does not exist!")
        return flask.redirect(flask.url_for('show_index'))
    
    initialize_room_info_elt(room)

    if flask.request.form['join'] == "Join as Player":
        if not (name in rooms_info[room]["players"] and not rooms_info[room]["game_finished"]):
            if rooms_info[room]["game_started"] or len(rooms_info[room]["players"]) >= 3:
                flask.flash(f"You cannot join as a player in that room ({room}) "
                         "because either the game has started, the game has ended, "
                         "or there are already 3 players in it.")
                return flask.redirect(flask.url_for('show_index'))
    else:
        assert flask.request.form['join'] == "Join as Spectator"
        if name in rooms_info[room]["players"] and not rooms_info[room]["game_finished"]:
            flask.flash(f"You cannot join as a spectator in that room ({room}) "
                         "because that game has not finished and you are a player "
                         "in that room. Please join the room as a player.")
            return flask.redirect(flask.url_for('show_index'))

    initialize_user_info_elt(name, room)

    if flask.request.form['join'] == "Join as Player":
        if name in rooms_info[room]["players"] and not rooms_info[room]["game_finished"]:
            user_info[name]["room_modes"][room] = equations.data.REJOINED_MODE

        elif rooms_info[room]["game_started"] or len(rooms_info[room]["players"]) >= 3:
            assert False

        else:
            assert name not in rooms_info[room]["players"]
            rooms_info[room]["players"].append(name)
            user_info[name]["room_modes"][room] = equations.data.PLAYER_MODE
        
        user_info[name]["gamerooms"].add(room)
        
    else:
        if name in rooms_info[room]["players"] and not rooms_info[room]["game_finished"]:
            assert False
    
        rooms_info[room]["spectators"].append(name)
        user_info[name]["room_modes"][room] = equations.data.SPECTATOR_MODE

    return flask.redirect(flask.url_for('show_game', nonce=room))

@equations.app.route("/game/<nonce>/", methods=['GET'])
def show_game(nonce):
    """Show the game with nonce nonce."""
    if 'username' not in flask.session:
        flask.flash("Please log in before joining a game.")
        return flask.redirect(flask.url_for('show_index'))

    name = flask.session['username']
    room = nonce

    print("Got to show_game")
    
    MapsLock()
    initialize_user_info_elt(name, room)

    print(rooms_info)
    print(user_info)

    if not (room in rooms_info and room in user_info[name]['room_modes']):
        if room not in rooms_info:
            if not get_game_from_db(room):
                flask.flash(f"The Room you tried to visit (ID of {room}) does not exist!")
                return flask.redirect(flask.url_for('show_index'))
        
        print("Checking to see if kick: ", rooms_info)
        if room not in rooms_info or not rooms_info[room]['game_started']:
            flask.flash(f"The Room you tried to visit (ID of {room}) has not started its game yet. "
                         "Please join by clicking \"Join Existing Game\" below and specifying whether "
                         "you would like to join as a player or a spectator.")
            return flask.redirect(flask.url_for('show_index'))

        if name in rooms_info[room]['players'] and not rooms_info[room]['game_finished']:
            user_info[name]["gamerooms"].add(room)
            user_info[name]["room_modes"][room] = equations.data.REJOINED_MODE
        else:
            rooms_info[room]["spectators"].append(name)
            user_info[name]["room_modes"][room] = equations.data.SPECTATOR_MODE

    initialize_room_info_elt(room)

    print("Gotta here: ", rooms_info)
    rooms_info[room]["connections"] += 1
    user_info[name]["room_connection_count"][room] += 1

    context = {
        "nonce": nonce,
        "name": flask.session['username'],
    }

    return flask.render_template("game.html", **context)
