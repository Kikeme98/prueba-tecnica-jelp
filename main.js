import "./style.css";
import puyo_yellow from "./img/puyo_yellow.png";
import puyo_blue from "./img/puyo_blue.png";
import puyo_red from "./img/puyo_red.png";
import puyo_green from "./img/puyo_green.png";

// Removed original global canvas/ctx/puntuationElement, will be player-specific
const buttonRestart = document.getElementById("restart"); // Keep global for now
const buttonLeft = document.getElementById("left");
const buttonRight = document.getElementById("right");
const buttonRotate = document.getElementById("rotate");
const buttonDrop = document.getElementById("drop");

const COLS = 6;
const ROWS = 12;
const PUYO_SIZE = 50;

let lastTimestamp = 0; // Global for game loop timing

const puyoImages = {
  yellow: new Image(),
  blue: new Image(),
  red: new Image(),
  green: new Image(),
};

puyoImages.yellow.src = puyo_yellow;
puyoImages.blue.src = puyo_blue;
puyoImages.red.src = puyo_red;
puyoImages.green.src = puyo_green;

const loadImages = () => {
  return Promise.all(
    Object.values(puyoImages).map(
      (img) =>
        new Promise((resolve) => {
          img.onload = resolve;
        })
    )
  );
};

class Player {
  constructor(id, canvasId, nextPuyoCanvasId, puntuationId) {
    this.id = id;
    const canvasEl = document.getElementById(canvasId);
    const nextPuyoCanvasEl = document.getElementById(nextPuyoCanvasId);
    this.puntuationElement = document.getElementById(puntuationId);

    if (!canvasEl || !nextPuyoCanvasEl || !this.puntuationElement) {
      console.error(`Failed to get elements for Player ${id}. Check HTML IDs: ${canvasId}, ${nextPuyoCanvasId}, ${puntuationId}`);
      // Provide non-null defaults or throw error to prevent further issues
      this.ctx = new Proxy({}, { get() { throw new Error(`Canvas context for Player ${id} not initialized.`); } });
      this.nextPuyoCtx = new Proxy({}, { get() { throw new Error(`Next Puyo context for Player ${id} not initialized.`); } });
    } else {
      this.ctx = canvasEl.getContext("2d");
      this.nextPuyoCtx = nextPuyoCanvasEl.getContext("2d");
    }
    
    this.board = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    this.score = 0;
    this.currentPuyo = null;
    this.nextPuyo = null;
    this.gameOver = false;
  }
}

class Puyo {
  constructor(x, y, color, playerCtx) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.img = puyoImages[color];
    this.playerCtx = playerCtx; // Store the player-specific context
  }

  draw() {
    this.playerCtx.drawImage( // Use player-specific context
      this.img,
      this.x * PUYO_SIZE,
      this.y * PUYO_SIZE,
      PUYO_SIZE,
      PUYO_SIZE
    );
  }

  update() {
    this.draw();
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  fall() {
    this.y += 1;
  }
}

class PuyoPair {
  constructor(x, y, color1, color2, playerCtx, playerBoard) {
    this.puyos = [
      new Puyo(x, y, color1, playerCtx),
      new Puyo(x, y + 1, color2, playerCtx),
    ];
    this.playerCtx = playerCtx;
    this.playerBoard = playerBoard; // Store player's board
  }

  draw() {
    this.puyos.forEach((puyo) => puyo.draw());
  }

  update() {
    this.draw();
  }

  move(dx, dy) {
    this.puyos.forEach((puyo) => {
      puyo.move(dx, dy);
    });
  }

  fall() {
    this.move(0, 1);
  }

  rotate() {
    const [puyo1, puyo2] = this.puyos;
    const centerX = puyo1.x;
    const centerY = puyo1.y;

    const relativeX = puyo2.x - centerX;
    const relativeY = puyo2.y - centerY;
    const newPuyo2X = centerX + relativeY;
    const newPuyo2Y = centerY - relativeX;

    // Check bounds and collision on the player's board
    let canRotate = true;
    const tempPuyo2 = { x: newPuyo2X, y: newPuyo2Y }; // Temporary object for checking
    const puyosToCheck = [puyo1, tempPuyo2];

    for (const p of puyosToCheck) {
        if (p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS || (this.playerBoard[p.y] && this.playerBoard[p.y][p.x] !== 0)) {
            canRotate = false;
            break;
        }
    }

    if (canRotate) {
        puyo2.x = newPuyo2X;
        puyo2.y = newPuyo2Y;
    }
  }
}

const drawNextPuyo = (player) => {
  if (!player.nextPuyo) return;
  player.nextPuyoCtx.fillStyle = "gray";
  player.nextPuyoCtx.fillRect(
    0,
    0,
    player.nextPuyoCtx.canvas.width,
    player.nextPuyoCtx.canvas.height
  );
  player.nextPuyoCtx.drawImage(
    player.nextPuyo.puyos[0].img,
    50,
    25,
    PUYO_SIZE,
    PUYO_SIZE
  );
  player.nextPuyoCtx.drawImage(
    player.nextPuyo.puyos[1].img,
    50,
    75,
    PUYO_SIZE,
    PUYO_SIZE
  );
};

const drawBoard = (player) => {
  player.ctx.fillStyle = "gray";
  player.ctx.fillRect(0, 0, player.ctx.canvas.width, player.ctx.canvas.height);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (player.board[row][col] !== 0) {
        const puyo = new Puyo(col, row, player.board[row][col], player.ctx);
        puyo.draw();
      } else {
        // Optional: draw empty cells explicitly if needed for debugging
        // player.ctx.fillStyle = "lightgray";
        // player.ctx.fillRect(col * PUYO_SIZE, row * PUYO_SIZE, PUYO_SIZE, PUYO_SIZE);
      }
    }
  }
};

const spawnPuyo = (player) => {
  const colors = ["yellow", "blue", "red", "green"];
  const color1 = colors[Math.floor(Math.random() * colors.length)];
  const color2 = colors[Math.floor(Math.random() * colors.length)];
  // Spawn at top-middle. Ensure PuyoPair gets player.board
  return new PuyoPair(Math.floor(COLS / 2) -1 , 0, color1, color2, player.ctx, player.board);
};

const checkCollision = (player) => {
  if (!player.currentPuyo) return false;
  for (const puyo of player.currentPuyo.puyos) {
    if (puyo.y + 1 >= ROWS || (player.board[puyo.y + 1] && player.board[puyo.y + 1][puyo.x] !== 0)) {
      return true;
    }
  }
  return false;
};

const solidifyPuyo = (player) => {
  if (!player.currentPuyo) return;
  player.currentPuyo.puyos.forEach(({ x, y, color }) => {
    if (y >= 0 && y < ROWS && x >=0 && x < COLS) { // Ensure puyo is within board bounds
        player.board[y][x] = color;
    }
  });
};

const isGameOver = (player) => {
  const spawnCol = Math.floor(COLS / 2) -1;
  if (player.board[0][spawnCol] !== 0 || player.board[1][spawnCol] !== 0) {
      return true;
  }
  return false;
};

const handleGameOver = (player) => {
  player.gameOver = true; // Set player-specific game over
  player.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  player.ctx.fillRect(0, 0, player.ctx.canvas.width, player.ctx.canvas.height);
  player.ctx.fillStyle = "white";
  player.ctx.font = "28px system-ui";
  player.ctx.textAlign = "center";
  player.ctx.fillText(
    `Player ${player.id} Game Over`,
    player.ctx.canvas.width / 2,
    player.ctx.canvas.height / 2 - 50
  );
  player.ctx.fillText(
    "Score: " + player.score,
    player.ctx.canvas.width / 2,
    player.ctx.canvas.height / 2
  );
};


const Break4PuyosConnected = (player) => {
  const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
  const puyosToRemove = [];

  const findConnected = (r, c, color, currentGroup) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || visited[r][c] || player.board[r][c] !== color) {
      return;
    }
    visited[r][c] = true;
    currentGroup.push({ row: r, col: c });
    findConnected(r + 1, c, color, currentGroup);
    findConnected(r - 1, c, color, currentGroup);
    findConnected(r, c + 1, color, currentGroup);
    findConnected(r, c - 1, color, currentGroup);
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (player.board[r][c] !== 0 && !visited[r][c]) {
        const currentGroup = [];
        findConnected(r, c, player.board[r][c], currentGroup);
        if (currentGroup.length >= 4) {
          puyosToRemove.push(...currentGroup);
        }
      }
    }
  }
  const uniquePuyosToRemove = [];
  const seen = new Set();
  for (const puyo of puyosToRemove) {
      const key = `${puyo.row}-${puyo.col}`;
      if (!seen.has(key)) {
          uniquePuyosToRemove.push(puyo);
          seen.add(key);
      }
  }
  return uniquePuyosToRemove;
};

const applyGravityAndClearPuyos = (player) => {
    let puyosClearedThisCycle = false;
    let anythingChanged;

    do {
        anythingChanged = false;
        // Apply gravity
        for (let c = 0; c < COLS; c++) {
            for (let r = ROWS - 2; r >= 0; r--) {
                if (player.board[r][c] !== 0 && player.board[r + 1][c] === 0) {
                    let currentR = r;
                    while (currentR + 1 < ROWS && player.board[currentR + 1][c] === 0) {
                        player.board[currentR + 1][c] = player.board[currentR][c];
                        player.board[currentR][c] = 0;
                        currentR++;
                        anythingChanged = true;
                    }
                }
            }
        }

        // Check for and clear connected puyos
        const puyosToClear = Break4PuyosConnected(player);
        if (puyosToClear.length > 0) {
            puyosToClear.forEach(puyo => {
                player.board[puyo.row][puyo.col] = 0;
            });
            player.score += puyosToClear.length * 10; // Simple scoring
            player.puntuationElement.textContent = player.score;
            anythingChanged = true;
            puyosClearedThisCycle = true;
        }
    } while (anythingChanged); // Repeat if gravity or clearing caused changes

    return puyosClearedThisCycle;
};

// Global player instances
let player1 = null;
let player2 = null;
let players = []; // Array to hold player instances

const initializePlayers = () => {
    player1 = new Player(1, "gameCanvas1", "nextPuyoCanvas1", "puntuation1");
    player2 = new Player(2, "gameCanvas2", "nextPuyoCanvas2", "puntuation2");
    players = [player1, player2].filter(p => p.ctx && p.nextPuyoCtx && p.puntuationElement); // Filter out players that failed to initialize
};

const handleRestart = () => {
    if (players.length === 0) initializePlayers(); // Ensure players are initialized

    players.forEach(p => {
        p.score = 0;
        p.board.forEach(row => row.fill(0));
        p.gameOver = false;
        p.currentPuyo = spawnPuyo(p);
        p.nextPuyo = spawnPuyo(p);
        if (p.puntuationElement) p.puntuationElement.textContent = p.score;
        drawBoard(p);
        drawNextPuyo(p);
    });
    lastTimestamp = 0; 
    
    if (!gameLoopRunning && players.some(p => !p.gameOver)) {
        gameLoopRunning = true;
        requestAnimationFrame(gameLoop); 
    } else if (players.every(p => p.gameOver)) {
        // If all players were game over, and we are restarting, we need to ensure the loop starts
        gameLoopRunning = true;
        requestAnimationFrame(gameLoop);
    }
    console.log("Game restarted for all players.");
};


let gameLoopRunning = false;
const gameSpeed = 1000; // Milliseconds for puyo fall

const gameLoop = (timestamp) => {
    if (!gameLoopRunning) return;

    let anyPlayerActive = false;
    players.forEach(player => {
        if (player && !player.gameOver) { 
            anyPlayerActive = true;
            const deltaTime = timestamp - lastTimestamp; 

            drawBoard(player);
            drawNextPuyo(player);
            if (player.currentPuyo) player.currentPuyo.update();
            
            let changedInCycle;
            do {
                changedInCycle = applyGravityAndClearPuyos(player);
                if (changedInCycle) {
                    drawBoard(player); 
                }
            } while (changedInCycle);

            if (deltaTime >= gameSpeed) {
                if (player.currentPuyo) {
                    if (checkCollision(player)) {
                        solidifyPuyo(player);
                        do {
                           changedInCycle = applyGravityAndClearPuyos(player);
                           if (changedInCycle) drawBoard(player);
                        } while (changedInCycle);

                        if (isGameOver(player)) {
                            handleGameOver(player);
                        } else {
                            player.currentPuyo = player.nextPuyo;
                            player.nextPuyo = spawnPuyo(player);
                        }
                    } else {
                        player.currentPuyo.fall();
                    }
                } else if (!player.gameOver) { 
                    player.currentPuyo = spawnPuyo(player);
                }
            }
        }
    });

    if (anyPlayerActive) {
        if (timestamp - lastTimestamp >= gameSpeed) { 
            lastTimestamp = timestamp;
        }
        requestAnimationFrame(gameLoop);
    } else {
        console.log("All players game over or game stopped.");
        gameLoopRunning = false; 
        // Display a global message or enable restart button more prominently
        const firstPlayerCtx = players.length > 0 ? players[0].ctx : null; 
        if (firstPlayerCtx) {
            firstPlayerCtx.fillStyle = "rgba(0, 0, 0, 0.8)";
            firstPlayerCtx.fillRect(0, 0, firstPlayerCtx.canvas.width, firstPlayerCtx.canvas.height);
            firstPlayerCtx.fillStyle = "white";
            firstPlayerCtx.font = "24px system-ui";
            firstPlayerCtx.textAlign = "center";
            firstPlayerCtx.fillText("All players Game Over!", firstPlayerCtx.canvas.width / 2, firstPlayerCtx.canvas.height / 2 - 30);
            firstPlayerCtx.fillText("Press 'R' to Restart", firstPlayerCtx.canvas.width / 2, firstPlayerCtx.canvas.height / 2 + 10);
        }
    }
};

const startGame = () => {
  initializePlayers();
  handleRestart(); 

  if (!gameLoopRunning && players.some(p => !p.gameOver)) { 
    gameLoopRunning = true;
    requestAnimationFrame(gameLoop);
  }
};


document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
        console.log("R key pressed, restarting game.");
        handleRestart(); 
        return; 
    }

    // Player 1 controls
    if (player1 && !player1.gameOver && player1.currentPuyo) {
        switch (event.key) {
            case "ArrowLeft":
                if (player1.currentPuyo.puyos.every(p => p.x > 0 && player1.board[p.y][p.x - 1] === 0)) {
                    player1.currentPuyo.move(-1, 0);
                }
                break;
            case "ArrowRight":
                if (player1.currentPuyo.puyos.every(p => p.x < COLS - 1 && player1.board[p.y][p.x + 1] === 0)) {
                    player1.currentPuyo.move(1, 0);
                }
                break;
            case "ArrowDown": 
                if (!checkCollision(player1)) {
                    player1.currentPuyo.fall();
                }
                break;
            case " ": 
            case "Enter":
                player1.currentPuyo.rotate();
                break;
        }
    }

    // Player 2 controls
    if (player2 && !player2.gameOver && player2.currentPuyo) {
        switch (event.key.toLowerCase()) { 
            case "a": 
                if (player2.currentPuyo.puyos.every(p => p.x > 0 && player2.board[p.y][p.x - 1] === 0)) {
                    player2.currentPuyo.move(-1, 0);
                }
                break;
            case "d": 
                if (player2.currentPuyo.puyos.every(p => p.x < COLS - 1 && player2.board[p.y][p.x + 1] === 0)) {
                    player2.currentPuyo.move(1, 0);
                }
                break;
            case "s": 
                if (!checkCollision(player2)) {
                    player2.currentPuyo.fall();
                }
                break;
            case "w": 
            case "shift": 
                player2.currentPuyo.rotate();
                break;
        }
    }
});


// Button controls (map to Player 1)
buttonLeft.addEventListener("click", () => {
  if (player1 && !player1.gameOver && player1.currentPuyo && player1.currentPuyo.puyos.every(p => p.x > 0 && player1.board[p.y][p.x - 1] === 0)) {
    player1.currentPuyo.move(-1, 0);
  }
});

buttonRight.addEventListener("click", () => {
  if (player1 && !player1.gameOver && player1.currentPuyo && player1.currentPuyo.puyos.every(p => p.x < COLS - 1 && player1.board[p.y][p.x + 1] === 0)) {
    player1.currentPuyo.move(1, 0);
  }
});

buttonRotate.addEventListener("click", () => {
  if (player1 && !player1.gameOver && player1.currentPuyo) {
    player1.currentPuyo.rotate();
  }
});

buttonDrop.addEventListener("click", () => { 
  if (player1 && !player1.gameOver && player1.currentPuyo && !checkCollision(player1)) {
    player1.currentPuyo.fall();
  }
});


// Initial call to start the game
loadImages().then(startGame);

```
