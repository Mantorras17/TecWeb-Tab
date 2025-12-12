<h1>Second Phase</h1>

The objective of this next phase is to make the game more distributed, allowing players on different computers to play. For that, this [server](http://twserver.alunos.dcc.fc.up.pt:8008/)(http://twserver.alunos.dcc.fc.up.pt:8008/)is going to be used for:

<h2>Requests</h2>

| Function | `group` | `nick` | `password` | `size` | `game` | `cell` |               Description                   |
|:--------:|:-------:|:------:|:----------:|:------:|:------:|:------:|---------------------------------------------|
| register |         |    X   |      X     |        |        |        |	Registers user associated with his password |
| join     |	  X    |    X   |      X     |    X   |        |        | Matches players to start a game             |
| leave    |			   |    X   |      X     |        |    X   |        | Quit an unfinished game                     |
| roll     |         |    X   |      X     |        |    X   |    X   | Throws the dice of sticks                   |
| pass     |         |    X   |      X     |        |    X   |    X   | Passes the turn                             |
| notify   |         |    X   |      X     |        |    X   |    X   | Notifies the player of a play               |
| update*  |         |    X   |            |        |    X   |        | Updates the game situation                  |
| ranking  |    X    |        |            |    X   |        |        | Returns the scoreboard                      |

*Server-Sent Events like GET and url encoded data.

The rest are fetch (or XMLHttpRequest) with POST and JSON data


- `register` request:

	Resgisters a player and associates him with a password. If the player is already registered with a different password, then the function returns an error. Otherwise it succeeds.
	The function `register` needs 2 arguments:
	  1. `nick` the player id
		2. `password` that the player chose
	
	This function should not only be used as an initial register of the player but also as a verification method at the beguinning of the session.

	Errors are returned if:
	 - arguments are ommited or aren't strings
	 - `nick` is already registered with a different password


- `join` request:

	This function pairs 2 players who wish to play a game with a specific board size. If there is already a player waiting for a game with the same characteristics, they are paired immediately. Otherwise, the player is registered for later pairing. In either case, the function returns immediately. The pairing notification is sent via `update`. Function arguments are:
	 1. `group` - group ID (for debugging)
	 2. `nick` - player identifier
	 3. `password` - password chosen by the player
	 4. `size` - board dimensions

	Errors are returned if:
	 - Any argument is omitted
	 - Arguments contain invalid values
	 - Authentication does not match a registered player


- `leave` request:

	Function invoked to abandon a game. 
	If invoked during pairing (while waiting for another player), there are no consequences.
	If invoked while game is in progress, it results in victory for the opponent.
	It's also important to note that games have a 2-minute timeout. If a move is not made within the allotted time, an automatic leave is executed under the conditions described above. Function arguments are:
	 1. `nick` for player identification
	 2. `password` chosen by the player
	 3. `game` identifier
	
	Errors are returned if:
	 - Any argument is omitted
	 - Authentication does not match a registered player
	 - The game identifier is invalid


- `roll` request:

	Throws the dice of sticks. The request returns immediatly, sending the results to both the players through `update`. The arguments are:
	 1. `nick` for player identification
	 2. `password` chosen by the player
	 3. `game` identifier
	
	Errors are returned if:
	 - Any argument is omitted
	 - The arguments contain invalid values
	 - The authentication fails
	 - The player tries to roll out of his turn
	 - The player had already rolled this turn and
	   - there is a valid play
	   - it's value doesn't allow for another roll


- `notify` request:

	Notifies the server of a play. The request returns immediatly, sending the results to both the players through `update`. The arguments are:
	 1. `nick` for player identification
	 2. `password` chosen by the player
	 3. `game` identifier
	 4. `move` a cell of the board envolved in the play

	Errors are returned if:
	 - Any argument is omitted
	 - The arguments contain invalid values
	 - The authentication fails
	 - The player tries to roll out of his turn
	 - The move violates the rules of the game


- `pass` request:

	Passes the turn. The request returns immediatly, sending the results to both the players through `update`. The arguments are:
	 1. `nick` for player identification
	 2. `password` chosen by the player
	 3. `game` identifier

	Errors are returned if:
	 - Any argument is omitted
	 - The arguments contain invalid values
	 - The authentication fails
	 - The player tries to pass out of his turn
	 - There are valid moves
	 - It's possible to roll the dice again


- `update` function:

	This is the only function that uses the GET method, the only function supported bu the Server Sent Events. It's arguments are coded in URLEncoded and they are:
	 1. `game` identifier
	 2. `nick` for player identification
	
	At the end of each game, the object `EventSource` must be closed.

	An error will be returned in the GET request if the reference to the game is invalid.


- Ranking:
	
	Returns the scoreboard with a maximum of 10 players, ordered by decreasing number of victories. Different scoreboards are maintained for each different group. The arguments are:
	 1. `group` number
	 2. `size` of board
	
	Errors are returned if:
	 - Any argument is omitted
	 - The arguments contain invalid values


- `nick`: String to identify each player, used in the register and in every function that requires authentication.

- `password`: String used with nick when it's necessary to authenticate the user.

- `size`: Positive integer representing the number of collumns of the board. The number of cells is 4x it's value.

- `game`: String to identify the game generated through the `join` function. It's a hash built based on game configurations.

- `cell`: Integer to indicate a cell of the board as a part of the player's move. This depends of:
	- `step == "from" - current cell`
	- `step == "to" - final cell`

	When `step == "to"`, the cell can be the same indicated in the previous step ("from"). In this case, the selection of the piece is nullified, ending up being in the step `from`, this way, we are able to choose another piece.

- `group`: Positive integer that identifies the group, to avoid matching with another players in this development phase. It's suggested that the use of the number of your group.

	This argument is mainly for debugging. Since the server will be shared by all the students and multiple can be testing at once, this will make it so that there shouldn't be unexpected matches.

	There are also kept different scoreboards for each different group.

<h2>Responses</h2>

The responses are JSON coded objects with the following properties:

| Property | `register` | `join` | `leave` | `notify` | `update` | `ranking` | Description                 |
|:--------:|:----------:|:------:|:-------:|:--------:|:--------:|:---------:|-----------------------------| 
| cell     |            |        |         |          | X        |           | moved cell                  |
| dice     |            |        |         |          | X        |           | result of throwing the dice |
| error    | X          | X      | X       | X        | X        | X         | error message               |
| game     |            | X      |         |          |          |           | game identifier             |
| initial  |            |        |         |          | X        |           | initial player's nick       |
| mustPass |            |        |         |          | X        |           | has to pass turn            |
| pieces   |            |        |         |          | X        |           | board cells                 |
| players  |            |        |         |          | X        |           | this game's players         |
| ranking  |            |        |         |          |          | X         | scoreboard                  |
| selected |            |        |         |          | X        |           | cells envolved in the play  |
| step     |            |        |         |          | X        |           | play step                   |
| turn     |            |        |         |          | X        |           | player's turn               |
| winner   |            |        |         |          | X        |           | game's winner               |

- `cell`: Object that indicates the cell of the board that previously held the piece of the previously player's turn, with the propperties:
	- `square`: not negative integer, less than the number of squares in the board
	- `position`: not negative integer, less than 8

- `dice`: Representation of the dice of sticks
	- `null`: if the last dice has already been used (it has to be thrown)
	- Object with the following properties:
		- `stickValues`: boolean array with each of the stick's side
			- `true` if it's light
			- `false` if it's dark
		- `value`: integer with the value of the dice (1,2,3,4 or 6)
		- `keepPlaying`: boolean
			- `true` if the player can play again
			- `false` otherwise

- `error`: Error message produced everytime that the HTTP response is different than 200. All the functions can produce errors in different situations.

- `game`: game identifier (hash) that's generated when a player requests a new game (join). This id must be used as an argument with the functions related to the game, like leave, notify and update.

- `initial`: String with the nick of the initial player, which pieces at the start are in the initial positions. If the board has `size` number of collumns, then the array `pieces` will have `4*size` positions. At the start of the game, the positions `0` to `size-1` contain the pieces from the player whose nick is in `initial`. The positions `3*size` to `4*size-1` contain the ones from the opponent.

- `mustPass`: Boolean that indicates if the player has to pass the turn, with the values:
	- `true` if one has to pass the turn.
	- `false` otherwise.

	If defined, this property can be used to toggle the pass button

- `pieces`: An array representing each cell of the board, containing `4*size` positions, where `size` is the number of collumns of the board. The position 0 corresponds to the bottom left corner of the board, from the perspective of the `initial` player. Each position can be null, if empty, or contain an object with the properties:
	- `color`: containing the values `blue` or `red`
	- `inMotion`: boolean, if the piece has been moved
	- `reachedLastRow`: boolean, if the piece has reached the opponent's first line.
	- Example: [null,null,null,null,null,
							null,null,{"color":"Blue","inMotion":true,"reachedLastRow":true},null,null,
							null,{"color":"Red","inMotion":true,"reachedLastRow":false},null,null,null,
							null,null,null,null,null]

- `players`: Object containing 2 properties, one per player. The name of each property is the nick of the player. The value of each property is the colour that player's pieces (`Blue` or `Red`)

- `ranking`: List containing a scoreboard for a given group and size of board. Each element of the list is an object with the properties:
	- `nick` of the player
	- `games` number of games
	- `victories` number of victories

	The returned list is ordered by descencding order of the number of victories and a maximum of 10 lines appear.

- `selected`: Array with integers, the positions of the cells envolved in the last play, and can be highlighted on the board. The positions are indexes in the array of pieces, given by the property `pieces`, where the position 0 belongs to the initial player given by the property `initial`. The selected positions are usually the initial position and final of the moved piece. If it's necessary to choose a final position, the `selected` positions are the ones that are valid.

- `step`: A string representing the next step during the moving piece phase. Can have one of the three values:
	- `from`, choose a cell with the piece to move
	- `to`, choose the cell where the piece will move to
	- `take`, choose the opponent's piece to capture

	These choices apply with a `turn`

- `turn`: String with the player (nick), identifying whose turn is it to play. Immediately, only plays from that player will be accepted.

- `winner`: String identifying the player (nick) that won this game. Can be null if the game has ended without a winner. This may happen also if the player leaves while waiting for an opponent. After starting the game, if a player leaves then he concedes victory to the opponent.

<h2>Examples</h2>

- Register

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| .../register | {"nick": "zp", "password": "secret"} | {} | success |
	| .../register | {"nick": "zp", "password": "just checking"} | { "error": "User registered with a different password"} | failure |
	| .../register | {"nick": "zp", "password": "secret"} | {} | passowrd confirmation |
	| .../register | {"nick": "jpleal", "password": "another"} | {} | another register |


- Start

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| .../join | {"group": 99, "nick": "zp", "password": "secret" }	| {"error": "undefined size"}	| Size not defined |
	| .../join	| { ... , "size": "large" }	| {"error": "invalid size 'large'"}	| Size has to be an odd intiger |
	| .../join	| {"group": 99, "nick": "zp", "password": "secret", "size": 9 }	| {"game": "fa93b40..."} | New game created with size 9 for group 99 |
	| .../update?nick=zp&game=averseda	|  | { "error": "Invalid game reference"} | Example of a possible error |
	| .../update?nick=zp&game=fa93b40... |  | {} | Primeiro jogador fica à espera |
	| .../join	| {"group": 99, "nick": "jpleal", "password": "another", "size": 9 } | {"game": "fa93b40..."} | Matched with the last  game of size 9 of group 99 |
	| Update from both the players	|  | {"pieces":[{...}, ...],"initial":"zp", "step":"from", "turn":"zp", "players":{"zp":"Blue","jpleal":"Red"}}	| Update when players are matched | 


- Leave

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| .../join | {"group": 99, "nick": "zp", "password": "secret", "size": 9 } | {"game": "fa93b4..."} | New game created |
	| .../update?nick=zp&game=fa93b4... |  | {} | First player waits |
	| .../leave	| {"nick": "zp", "password": "secret", "game": "fa93b4..." } | {}	| Quit waiting |
	| Update of player |  | { "winner": null } | Ended without winners |
	| .../join | {"group": 99, "nick": "zp", "password": "secret", "size": 9 } | {"game": "2fd9d..."}	| New game created |
	| .../update?nick=zp&game=2fd9d... |  | {} | First player waits for event |
	| .../join | {"group": 99, "nick": "jpleal", "password": "another"," size": 9 } | {"game": "2fd9d..."} | Matched with last game |
	| .../update?nick=jpleal&game=2fd9d... |  | {} | Second player waits for event |
	| Update of both players |  | { "pieces": [[...]], "turn": "zp", "step": "from", ... }	| Game started |
	| .../leave	| {"nick": "zp", "password": "secret", "game": "2fd9d..." }	| {} | Quit the game |
	| Update of both players |  | { "winner": "jpleal" }	| Opponent won |


- Throw

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| Update of both players |  | { "turn": "zp", "pieces": [ ... ], ... }	| Game started |
	| .../roll | { "nick": "jpleal", "password": "another", "game": "2fd9d..." } | { "error": "Not your turn to play" }	| Tried to play out of turn |
	| .../roll | { "nick": "zp", ... } | {}	| Throw successful |
	| Update of both players |  | { {"dice":{"stickValues":[false,false,false,false], "value":6,"keepPlaying":true},|"turn":"zp","mustPass":null} } | No moves available, but you can throw again |
	| .../roll | { "nick": "zp", ... } | {}	| Throw successful |
	| Update of both players |  | { {"dice":{"stickValues":[false,true,false,false], "value":1,"keepPlaying":true},"turn":"zp","mustPass":null} } | Got 1 (Tâb) and can move the most right piece |


- Pass

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| Update of both players |  | { "turn": "jpleal", "pieces": [ ... ], ... }	| Started the game |
	| .../roll | { "nick": "jpleal", ... } | {}	| Throw successful |
	| Update of both players |  | {"dice":{"stickValues":[false,true,false,true], "value":2,"keepPlaying": false},"turn":"jpleal", "mustPass":"jpleal"} | Still your turn but you have to pass it because there are no moves and you can't throw again. "password": "another", "game": "2fd9d |
	| .../pass | { "nick": "zp", "password": "another", "game": "2fd9d..." } | {}	| Passed turn |
	| Update of both players |  | { "turn": "zp", ... } | Opponent's turn |
	| .../roll | { "nick": "zp", ..." }	| {} | Throw successful |
	| Update of both players |  | {"dice":{"stickValues":[false,false,false,false], "value":6,"keepPlaying":true}, "turn":"zp", "mustPass":null} | Got a 6 (Sitteh), no valid moves but throw again |
	| .../pass | { "nick": "zp", ... } | { "error": "You already rolled the dice but can roll it again"} | Can't pass turn |
	| .../roll	| { "nick": "zp", ..." } | {}	|  |
	| Update of both players |  | {"dice":{"stickValues":[false,true,false,false], "value":1, "keepPlaying":true},"turn":"zp", "mustPass": null } | Got 1 (Tâb) and can play the most right piece |
	| .../pass | { "nick": "zp", "password": "another", "game": "2fd9d..." } | { "error": "You already rolled the dice and have valid moves"} | Can't pass turn |



- Move: Invalid plays

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| .../notify | { "nick": "jpleal", "password": "another", "game": "2fd9d...", "cell": 26 } | { "error": "not your turn to play" } |	Invalid move |
	| .../notify | { "nick": "zp", "password": "secret", "game": "2fd9d...", "cell": true } | { "error": "cell is not an integer" }	| Invalid move |
	| .../notify | { "nick": "zp", "password": "secret", "game": "2fd9d...", "cell": -1 } | { "error": "cell is negative" }	| Invalid move |
	| .../notify | {"nick": "zp", "password": "secret", "game": "2fd9d...", "cell": 0 } | { "error": "cannot capture to your own piece"} | Invalid move |
	| .../notify | {"nick": "zp", "password": "secret", "game": "2fd9d...", "cell": 8 }	| {} | Valid move |
	| Update of both players	|  | { "turn": "zp", dice: null, "step": "from", initial: "zp" "pieces": [ ... ] } | Keep turn but dice has been used |


- Move: Begin

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| .../notify | {"nick": "zp", "password": "secret", "game": "2fd9d...", "cell": 8 } | {} | Valid move |
	| Update of both players |  | { "cell": 8, "selected": [ 8, 9], "initial": "zp", dice: null, "step": "from", turn: "zp" "pieces": [ ... ], ... } | Keep turn but dice has been used |
	| .../roll | { "nick": "zp", ... } | {} | New throw |
	| Update of both players |  | { {"dice":{"stickValues":[false,true,false,true], "value":2,"keepPlaying":false},"turn":"zp","mustPass":null} }	| Got 2 (Itneyn) and can move the already moved piece |
	| .../notify | {"nick": "zp", "password": "secret", "game": "2fd9d...", "cell": 9 }	| {} | Valid move |
	| Update of both players |  | { "cell": 9, "selected: [9, 11], dice: null, "initial": "jpleal", , "step": "from", turn: "zp" "pieces": [ ... ], ... }	| Pass turn to opponent |


- Move: Choose

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| Update of both players |  | { "dice": { ...; "value": 3, ...}, "turn": "zp", "step": "from", "mustPass": false } | You can select a piece now (from) |
  | .../notify | {"nick": "zp", ..., "cell": 25 }	| {} | Valid move, though incomplete |
	| Update of both players |  | { "cell": 25, "selected": [28,10]"turn": "zp", "step": "to", "pieces": [ ... ], ... }	| Can select 10 or 28 as a final cell (to) |
	| .../notify | { "nick": "zp", ... , "cell": 26 } |	{ "error": "Invalid move: must play the dice's value" }	| Invalid move |
	| .../notify | { "nick": "zp", ... , "cell": 28 }	| {} | Valid move |
	| Update of both players |  | { "cell": 25, "selected": [25, 28], "turn": "jpleal", "step": "from", ... }	| Passes turn, select the piece to move |


- Move: Rollback selection

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| Update of both players |  | { "turn": "zp", "step": "from", "pieces": [ ... ], ... } | Passes turn, select the piece to move |
	| .../notify | {"nick": "zp", "password": "secret", "game": "2fd9d...", "cell": 25 } | {} | Valid selection (from), now select a final cell (to) |
	| Update of both players |  | { "cell": 25, ..., "turn": "zp", "step": "to", ... } | Notification of the play, select final cell (board doesn't chage) |
	| .../notify | {"nick": "zp", ..., "cell": 25 }	| {} | Chose correctly, annulling selection |
	| Update of both players |  | { ..., "turn": "zp", "step": "from", ... } | Rollback notification, select a piece (again) |


- Win

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| Update of both players |  | { "turn": "jpleal", "step": "from", "pieces": [...], ... } | Gets their turn |
	| .../roll | { "nick": "jplea", "password": "another", "game": "2fd9d..." } | {} | Successful throw |
	| Update of both players |  | { {"dice":{"stickValues":[false,false,false,false], "value":6,"keepPlaying":true},"turn":"zp","mustPass":null} } | Successful throw |
  | .../notify | { "nick": "jpleal", "password": "another", "game": "2fd9d...", "cell": 12 } | {} | Captures last piece |
	| Update of both players |  | { "winner": "jpleal", "pieces": [...], ... } | Won |


- Scoreboard

	| URL | Object in the request | Object in the response | Observations |
	|-----|-----------------------|------------------------|--------------|
	| .../ranking	| {} | { "error": "Undefined group" }	| Invalid request |
	| .../ranking	| { "group": 99 }	| { "error": "Invalid size 'undefined'" } |	Invalid request |
	| .../ranking	| { "group": 99, "size": 3.1416 }	| { "error": "Invalid size '3.1416'" } | Invalid request |
	| .../ranking	| { "group": "2 of us", "size": 3 }	| { "error": "Invalid group '2 of us'" } | Invalid request |
	| .../ranking	| {"group": 99, "size": 5 }	| { ranking: [] }	| No scoreboard yet |
	| .../ranking	| { "group": 99, "size": 9 } | { "ranking": [{"nick":"jpleal","victories":2,"games":2},{"nick":"zp","victories":0,"games":2}] }	| Successful scoreboard |


<h2>Valorization</h2>

To have the full classification for this assignment you will have to use the following APIs of HTML5:
  - WebStorage to save the classifications localy from games against the CPU (without using the server) in the first phase of this project. The results should persist, even if the browser is refreshed.
	- Canvas to improve the visual aspect of the game, like, for example, creating an animation for the dice of sticks.

Make sure to implement these into your project in order to get the full marks.