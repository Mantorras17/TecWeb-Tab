<h1>FIRST PHASE</h1>

This is an assignment to make a single page application - The Tâb game

<h2>RULES</h2>

 - Board:
   1. Tâb is a board game for 2 players
   2. The board has 4 lines
   3. And it has an odd number of collumns, that can vary between 7 and 15, standard is 9.

 - Pieces:

   1. Number and initial position:
      - In a board with n collumns, each player has n pieces.
      - Each player uses 2 colours to represent their pieces.
      - Each player's pieces are shown on their side.

   2. Player's perspective:
      - The player's pieces are shown below the board.
      - The same board for the opponent is rotated 180 degrees.

   3. Piece state:
      - The rules of the game consider the following states of each piece:
         - not yet moved
         - has been moved but hasn't gotten to the last line
         - has been on the 4th (last) line
      - The state of the piece can be shown through the transparency of the piece (for example)

   4. Dice of sticks:
      - Instead of a traditional dice, 4 sticks with 2 sides are used.
      - To throw, the sticks are squeezed in a hand.
      - Upon opening, each stick has either a darker and rounded side or brighter and straight side.
      - The dice value is how many bright-side sticks there are.
      - Each value corresponds to the moves of a piece (to be selected).
      - Some positions of the board allow playing again.
      - The probability of each possible value varies, unlike the dice.
      - Value of the dice of sticks:
         - Adding up the bright and straight sides there are 5 possible outcomes.
         - Each value represents the number of cells to move
         - Player plays again if the value is 1, 4 or 6.
         - The probability of each outcome (assuming equal probabilities for each side)   

         | Sum  | Value | Name     | Repeats | Probability   |  
         |:----:|:-----:|:--------:|:-------:|:-------------:|  
         | 0    | 6     | Sitteh   | sim     | 6%            |  
         | 1    | 1     | Tâb      | sim     | 25%           |  
         | 2    | 2     | Itneyn   | não     | 38%           |  
         | 3    | 3     | Teláteh  | não     | 25%           |  
         | 4    | 4     | Arba'ah  | sim     | 6%            |  

   5. Move pieces:
      - Before moving the piece, the player has to throw the sticks.
      - The piece selected moves the designated value of the sticks.
      - Beggining of the moving phase:
         - The first time a piece moves has to be with a 1 (Tâb).
         - If the value isn't 1, but is 4 or 6, player throws again.
         - The destiny cell can't have a piece already, it must be empty.
         - Therefore, the pieces more to the right start moving.
      - Progress of the pieces:
         - The pieces move from left to right in the 1st and 3rd lines.
         - The pieces move from right to left in the 2nd and 4th lines.
         - If they leave the 1st, they go to 2nd then 3rd.
         - If they leave the 3rd, they can go to 4th or 2nd.
         - If they leave the 4th, they move back to the 3rd.
      - Restrictions:
         - There can only be one piece on a cell at a time.
         - A piece can enter the 4th line at any time but can only do it ONCE.
         - A piece can only move around in the 4th line if all of the player's pieces are out of the 1st line;
         - A piece cannot move back to the 1st line.
   
   6. Capture pieces:
      - If there is an opponent's piece in a destination cell, it's captured.
      - Captured pieces disappear from the board.
   
   7. End of game:
      - The game ends when one of the players has no pieces left.
      - The player that has pieces left wins.

---

The page must be divided in various divs for these different finalities:

   1. Logo:
      - The name of the game must stand out.
      - It can be the name TÂB or a different name based on our implementation.
      - It can be only name, formated and stood out, or an image.

   2. Configurations:
      - The size of the board
      - Play againts cpu or another player (not to implement now)
      - Which player goes first
      - Dificulty level of the AI

   3. Controls:
      - Visualize the instructions of the game
      - Start the game with the current configurations
      - Quit the game
      - View the scoreboard

   4. Identification:
      - This div allows the user to authenticate, showing his id and password.
      - After authenticating, the same should be used to show the id, allowing the user to end session.
      - This does not need to be implementated but the div should be created.

   5. Dice of Sticks:
      - Before each play, the player must throw the dice of sticks in order to get the number of cells a piece will move.
      - There will be a div for this dice of sticks, where the player can interact with it.
      - To throw it, the player can just click on it.
      - To the player, the sticks must show their respective sides.
      - At the end of each play, the state of the dice must be reverted to the initial state.
   
   6. Board:
      - This is the main part of the game, where most of the interaction will be made.
      - So coding this board will require more care.
      - The interaction with the board will also be more complex, requiring different mode implementations.
      - Coding:
         - For a first phase, the board can be implemented in HTML, combining divs to represent the lines and pieces. It's positioning and graphic formatting must be made in CSS.
         - For a second phase, the board must be generated using JavaScript using DOM and the sintax JavaScript of CSS. This way, different boards can be generated in accordance with the configurations.
         - To generate the graphic representation of the board, it is necessary to define the data structure that represents it. The methods generate the board and recieve the interaction operate on that data. On the second phase, that data will be sent to and from the server (not to implement now).
         - It's best that you implement the board with an object oriented approach.
      - Modes:
         - Clicking on a cell of the board will have different effects depending on the state of the game.
         - Normally, clicking on a piece will be enough to make it move according to the value of the dice of sticks. In that case the play can be made immediately.
         - Although, if the cell selected is on the 3rd line, it can be moved to the 2nd or 4th line. In that case, the next decision from the player will be the destination cell.
         - To implement these modes, state variables can be used to differ from different states, controlling the interaction.
         - The user must know at all times the current mode, which can be achieved through cursors and/or messages.

      7. Instructions:
         - This div will be for only showing the rules of the game and other tips on how to play this web-app.
         - Just like the scoreboard, it can be a transitionary pannel that superimposes the others. In this case, it'll be necessary for a command in the controls that opens the pannel, and also a way to remove it from the screen.

      8. Scoreboard:
         - The player will be able to see a table with the scores registered.
         - On the first delivery, this information will only be relative to the games played against the CPU.
         - On the second delivery (not to be implemented now), when the opponents are other players, the scores will be obtained form the server.
         - Just like the instructions, this can be a transitionary pannel that superimposes others. In this case, it'll be necessary for a command in the controlls that opens the pannel, and also a way to remove it from the screen.
      
      9. Messages:
         - This div is dedicated to present messages during the game, to the user. Exemples of different messages are:
            - Player's turn to make a move
            - A line has been made, you must capture an opponent's piece.
            - That's not possible, opponent's turn.
            - Game over! Player1 won!
            - Player1 quit. You won!

      10. CPU:
         - In the first delivery players can only play agaist the CPU. The plays are calculated locally, on the clients side. There are many approaches to generate plays, which can be used in alternative or combined.
         - The simplest way is to determine which ones are valid and choose one of them randomly.
         - A more sophisticated way is to give priority to those that lead to captures.
         - To implement various difficulthy levels is to combine both of the methods above, randomly choosing each play which one to use.
         - By far the best way to implement a CPU with levels of difficulty is using the MinMax algorithm, where the depth can map difficulty (implement this one).



   - Layout (see in raw format):

+-----------+----------------------------------------+----------+ 
| sidePanel |  LogoSymbol     LOGO                   |  login   | 
| (hidden)  +----------------------------------------+    w/    | 
|           |                messages                | popover  | 
| Configs   +----------------------------------------+----------+
| Instrs    |                                        |          | 
|           |                                        |          | 
|           |               boardgame                |  sticks  | 
|           |  |                                     |          | 
|           |  |                                     |          | 
|           +--+----+----------+-----------+---------+----------+ 
|           | local | national | worldwide |                    | 
|           +       +----------+-----------+--------------------+ 
|           |        scoreboard                                 | 
+-----------+---------------------------------------------------+ 
