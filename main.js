import "./style.css";
import puyo_yellow from "./img/puyo_yellow.png";
import puyo_blue from "./img/puyo_blue.png";
import puyo_red from "./img/puyo_red.png";
import puyo_green from "./img/puyo_green.png";

const canvas = document.getElementById("gameCanvas");
const nextPuyoCanvas = document.getElementById("nextPuyoCanvas");
const ctx = canvas.getContext("2d");
const nextPuyoCtx = nextPuyoCanvas.getContext("2d");
const puntuationElement = document.getElementById("puntuation");
const buttonRestart = document.getElementById("restart");
const buttonLeft = document.getElementById("left");
const buttonRight = document.getElementById("right");
const buttonRotate = document.getElementById("rotate");
const buttonDrop = document.getElementById("drop");

const COLS = 6;
const ROWS = 12;
const PUYO_SIZE = 50;

let puntuation = 0;
let currentPuyo = null;
let nextPuyo = null;
let lastTimestamp = 0;
let gameOver = false;

const board = [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
];

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

class Puyo {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.img = puyoImages[color];
  }

  draw() {
    ctx.drawImage(
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
  constructor(x, y, color1, color2) {
    this.puyos = [new Puyo(x, y, color1), new Puyo(x, y + 1, color2)];
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

    // Realiza la rotación
    const relativeX = puyo2.x - centerX;
    const relativeY = puyo2.y - centerY;
    puyo2.x = centerX + relativeY;
    puyo2.y = centerY - relativeX;

    // Verifica los límites después de la rotación
    if (
      this.puyos.some(
        (puyo) =>
          puyo.x < 0 ||
          puyo.x >= COLS ||
          puyo.y >= ROWS ||
          board[puyo.y][puyo.x] !== 0
      )
    ) {
      // Si alguno de los puyos se sale de los límites o colisiona con otra pieza, deshace la rotación
      puyo2.x = centerX - relativeY;
      puyo2.y = centerY + relativeX;
    }
  }
}

const drawNextPuyo = () => {
  nextPuyoCtx.fillStyle = "gray";
  nextPuyoCtx.fillRect(0, 0, nextPuyoCanvas.width, nextPuyoCanvas.height);
  nextPuyoCtx.drawImage(nextPuyo.puyos[0].img, 50, 25, PUYO_SIZE, PUYO_SIZE);
  nextPuyoCtx.drawImage(nextPuyo.puyos[1].img, 50, 75, PUYO_SIZE, PUYO_SIZE);
};

const drawBoard = () => {
  ctx.fillStyle = "gray";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col] !== 0) {
        const puyo = new Puyo(col, row, board[row][col]);
        puyo.draw();
      } else {
        ctx.fillStyle = "gray";
        ctx.fillRect(col * PUYO_SIZE, row * PUYO_SIZE, PUYO_SIZE, PUYO_SIZE);
      }
    }
  }
};

const spawnPuyo = () => {
  const colors = ["yellow", "blue", "red", "green"];
  const color1 = colors[Math.floor(Math.random() * colors.length)];
  const color2 = colors[Math.floor(Math.random() * colors.length)];
  const puyoPair = new PuyoPair(2, 0, color1, color2);
  return puyoPair;
};

const checkCollision = () => {
  let hasCollision = false;
  currentPuyo.puyos.forEach(({ x, y }) => {
    if (y + 1 >= ROWS || board[y + 1][x] !== 0) {
      hasCollision = true;
    }
  });
  return hasCollision;
};

const solidifyPuyo = () => {
  currentPuyo.puyos.forEach(({ x, y, color }) => {
    board[y][x] = color;
  });
};

const isGameOver = () => {
  return currentPuyo.puyos.some(({ y }) => y === 0);
};

const handleGameOver = () => {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = "28px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 50);
  ctx.fillText("Score: " + puntuation, canvas.width / 2, canvas.height / 2);
  ctx.fillText(
    "Press 'R' to restart",
    canvas.width / 2,
    canvas.height / 2 + 50
  );
};

const handleRestart = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  puntuation = 0;
  board.forEach((row) => row.fill(0));
  puntuationElement.innerHTML = puntuation;
  gameOver = false;
  currentPuyo = spawnPuyo();
  drawNextPuyo();
  drawBoard();
  startGame();
};

// Controls section

buttonDrop.addEventListener("click", () => {
  if (!gameOver) {
    if (
      currentPuyo.puyos.every(
        (puyo) => puyo.y < ROWS - 1 && board[puyo.y + 1][puyo.x] === 0
      )
    ) {
      currentPuyo.move(0, 1);
    }
  }
});

buttonLeft.addEventListener("click", () => {
  if (!gameOver) {
    if (
      currentPuyo.puyos.every(
        (puyo) => puyo.x > 0 && board[puyo.y][puyo.x - 1] === 0
      )
    ) {
      currentPuyo.move(-1, 0);
    }
  }
});

buttonRight.addEventListener("click", () => {
  if (!gameOver) {
    if (
      currentPuyo.puyos.every(
        (puyo) => puyo.x < COLS - 1 && board[puyo.y][puyo.x + 1] === 0
      )
    ) {
      currentPuyo.move(1, 0);
    }
  }
});

buttonRotate.addEventListener("click", () => {
  if (!gameOver) {
    currentPuyo.rotate();
  }
});

document.addEventListener("keydown", (event) => {
  if (!gameOver) {
    switch (event.key) {
      case "ArrowLeft":
        if (
          currentPuyo.puyos.every(({ x, y }) => x > 0 && board[y][x - 1] === 0)
        ) {
          currentPuyo.move(-1, 0);
        }
        break;
      case "ArrowRight":
        if (
          currentPuyo.puyos.every(
            ({ x, y }) => x < COLS - 1 && board[y][x + 1] === 0
          )
        ) {
          currentPuyo.move(1, 0);
        }
        break;
      case "ArrowDown":
        if (
          currentPuyo.puyos.every(
            ({ x, y }) => y < ROWS - 1 && board[y + 1][x] === 0
          )
        ) {
          currentPuyo.move(0, 1);
        }
        break;
      case " ":
        currentPuyo.rotate();
        break;
    }
  }

  if (event.key === "r" && gameOver) {
    console.log("restarting");
    handleRestart();
  }
});

const Break4PuyosConnected = () => {
  const visited = new Array(ROWS).fill().map(() => new Array(COLS).fill(false));
  let puyosToRemove = [];

  const dfs = (row, col, color, direction) => {
    if (
      row < 0 ||
      row >= ROWS ||
      col < 0 ||
      col >= COLS ||
      visited[row][col] ||
      board[row][col] !== color
    ) {
      return 0;
    }

    visited[row][col] = true;
    let count = 1;

    if (direction !== "up") count += dfs(row + 1, col, color, "down");
    if (direction !== "down") count += dfs(row - 1, col, color, "up");
    if (direction !== "left") count += dfs(row, col + 1, color, "right");
    if (direction !== "right") count += dfs(row, col - 1, color, "left");

    return count;
  };

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (typeof board[row][col] === "string" && !visited[row][col]) {
        const color = board[row][col];
        const count = dfs(row, col, color);

        if (count >= 4) {
          // Marcar los puyos para eliminar
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (visited[r][c]) {
                puyosToRemove.push({ row: r, col: c });
                board[r][c] = 0; // Limpiar el puyo del tablero
              }
            }
          }
        }

        // Reiniciar el seteo de visitados
        visited.forEach((row) => row.fill(false));
      }
    }
  }
  // Devolver la lista de puyos que se eliminarán
  return puyosToRemove;
};

const startGame = () => {
  puntuation = 0;
  currentPuyo = spawnPuyo();
  nextPuyo = spawnPuyo();
  let speed = 1000;
  const gameLoop = (timestamp) => {
    if (!gameOver) {
      const deltaTime = timestamp - lastTimestamp;

      drawBoard();
      drawNextPuyo();
      currentPuyo.update();
      const puyosToRemove = Break4PuyosConnected();
      if (puyosToRemove.length > 0) {
        puyosToRemove.forEach((puyo) => {
          board[puyo.row][puyo.col] = 0;
        });

        puntuation += puyosToRemove.length * 10;
        puntuationElement.textContent = puntuation;
        speed -= 10;
      }

      if (deltaTime > speed) {
        // Verificar y hacer caer los puyos individuales
        for (let row = ROWS - 1; row >= 0; row--) {
          for (let col = 0; col < COLS; col++) {
            if (typeof board[row][col] === "string") {
              const puyo = new Puyo(col, row, board[row][col]);
              if (row + 1 >= ROWS || board[row + 1][col] !== 0) {
                // Si hay colisión o llega al fondo, solidificar el puyo
                board[row][col] = puyo.color;
              } else {
                // Si puede caer, actualizar su posición
                board[row][col] = 0;
                puyo.fall();
                board[row + 1][col] = puyo.color;
              }
            }
          }
        }

        if (checkCollision()) {
          solidifyPuyo();
          if (isGameOver()) {
            gameOver = true;
            handleGameOver();
          } else {
            currentPuyo = nextPuyo;
            nextPuyo = spawnPuyo();
          }
        } else {
          currentPuyo.fall();
        }
        lastTimestamp = timestamp;
      }
      requestAnimationFrame(gameLoop);
    }
  };

  gameLoop(0);
};

loadImages().then(startGame);
