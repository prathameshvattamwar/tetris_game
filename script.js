const canvas = document.getElementById('tetrisCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextPieceCanvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const highScoreDisplay = document.getElementById('high-score');
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreDisplay = document.getElementById('final-score');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const restartButton = document.getElementById('restart-button');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_COLS = 4;
const NEXT_ROWS = 4;
const NEXT_BLOCK_SIZE = 20;

canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;
ctx.scale(BLOCK_SIZE, BLOCK_SIZE);

nextCanvas.width = NEXT_COLS * NEXT_BLOCK_SIZE;
nextCanvas.height = NEXT_ROWS * NEXT_BLOCK_SIZE;
nextCtx.scale(NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE);

let board = createBoard(ROWS, COLS);
let score = 0;
let level = 1;
let linesCleared = 0;
let highScore = localStorage.getItem('tetrisHighScore') || 0;
let gameRunning = false;
let isPaused = false;
let isGameOver = false;
let currentPiece;
let nextPiece;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let animationFrameId;

const COLORS = {
    'I': 'var(--color-I)',
    'O': 'var(--color-O)',
    'T': 'var(--color-T)',
    'S': 'var(--color-S)',
    'Z': 'var(--color-Z)',
    'J': 'var(--color-J)',
    'L': 'var(--color-L)'
};

const PIECES = {
    'I': [[1, 1, 1, 1]],
    'O': [[1, 1], [1, 1]],
    'T': [[0, 1, 0], [1, 1, 1]],
    'S': [[0, 1, 1], [1, 1, 0]],
    'Z': [[1, 1, 0], [0, 1, 1]],
    'J': [[1, 0, 0], [1, 1, 1]],
    'L': [[0, 0, 1], [1, 1, 1]]
};

function createBoard(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function getRandomPiece() {
    const pieceKeys = Object.keys(PIECES);
    const randKey = pieceKeys[Math.floor(Math.random() * pieceKeys.length)];
    const matrix = PIECES[randKey];
    const color = getCssVariableValue(COLORS[randKey]);

    return {
        matrix: matrix,
        pos: { x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2), y: 0 },
        color: color,
        key: randKey
    };
}

function getCssVariableValue(varName) {
    // Check if running in a browser environment
    if (typeof window !== 'undefined' && typeof getComputedStyle !== 'undefined') {
        try {
             return getComputedStyle(document.documentElement).getPropertyValue(varName.slice(4, -1)).trim();
        } catch (e) {
             console.error("Could not get CSS variable:", varName, e);
             // Provide fallback colors if CSS variables fail
             const fallbacks = {
                 'I': '#00f0f0', 'O': '#f0f000', 'T': '#a000f0',
                 'S': '#00f000', 'Z': '#f00000', 'J': '#0000f0', 'L': '#f0a000'
             };
             const key = Object.keys(COLORS).find(k => COLORS[k] === varName);
             return fallbacks[key] || '#ffffff'; // Default white
        }
    } else {
        // Fallback for non-browser environments (e.g., testing)
         const fallbacks = {
             'I': '#00f0f0', 'O': '#f0f000', 'T': '#a000f0',
             'S': '#00f000', 'Z': '#f00000', 'J': '#0000f0', 'L': '#f0a000'
         };
         const key = Object.keys(COLORS).find(k => COLORS[k] === varName);
         return fallbacks[key] || '#ffffff';
    }
}


function drawSquare(x, y, color, context = ctx) {
    context.fillStyle = color;
    context.fillRect(x, y, 1, 1);
    // Draw border for definition
    context.strokeStyle = getCssVariableValue('--block-border'); // Use CSS variable for border
    context.lineWidth = 0.06; // Slightly thicker border
    context.strokeRect(x + 0.03, y + 0.03, 1 - 0.06, 1 - 0.06); // Inset border slightly
}

function drawBoard() {
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawSquare(x, y, value);
            } else {
                 // Don't draw grid lines for empty cells
                // Only fill background if needed for clearing, but clearRect handles it
            }
        });
    });
}

function drawPiece(piece, context = ctx, offset = { x: 0, y: 0 }) {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawSquare(piece.pos.x + x + offset.x, piece.pos.y + y + offset.y, piece.color, context);
            }
        });
    });
}

function drawNextPiece() {
    const boardBgColor = getCssVariableValue('--board-bg');
    nextCtx.fillStyle = boardBgColor || '#171425'; // Fallback color
    nextCtx.fillRect(0, 0, nextCanvas.width / NEXT_BLOCK_SIZE, nextCanvas.height / NEXT_BLOCK_SIZE); // Use scaled coords

    if (nextPiece) {
        const piece = nextPiece;
        const matrix = piece.matrix;
        const scale = NEXT_BLOCK_SIZE / BLOCK_SIZE; // Ratio between block sizes
        const offsetX = (NEXT_COLS - matrix[0].length) / 2;
        const offsetY = (NEXT_ROWS - matrix.length) / 2;

         matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawSquare(offsetX + x, offsetY + y, piece.color, nextCtx);
                }
            });
        });
    }
}

function isValidMove(matrix, pos) {
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[0].length; x++) {
            if (matrix[y][x] !== 0) {
                let newX = pos.x + x;
                let newY = pos.y + y;
                if (newX < 0 || newX >= COLS || newY >= ROWS || (board[newY] && board[newY][newX] !== 0)) {
                    return false;
                }
            }
        }
    }
    return true;
}

function rotateMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            rotated[x][rows - 1 - y] = matrix[y][x];
        }
    }
    return rotated;
}

function rotatePiece() {
    if (!currentPiece || isPaused) return;
    const originalMatrix = currentPiece.matrix;
    const rotatedMatrix = rotateMatrix(originalMatrix);
    const originalPos = currentPiece.pos;
    let offset = 1;
    let testPos = { ...originalPos };

    while (!isValidMove(rotatedMatrix, testPos)) {
         testPos.x += offset;
         if (offset > 0) {
             offset = -(offset + 1);
         } else {
             offset = -(offset - 1);
         }
        if (Math.abs(offset) > rotatedMatrix[0].length) {
            testPos = {x: originalPos.x, y: originalPos.y -1};
             if(!isValidMove(rotatedMatrix, testPos)) {
                 testPos = {x: originalPos.x, y: originalPos.y -2};
                 if(!isValidMove(rotatedMatrix, testPos)){
                      return;
                 }
             }
             break;
         }
    }
    currentPiece.matrix = rotatedMatrix;
    currentPiece.pos = testPos;
}

function movePiece(dir) {
    if (!currentPiece || isPaused) return;
    const newPos = { ...currentPiece.pos };
    newPos.x += dir;
    if (isValidMove(currentPiece.matrix, newPos)) {
        currentPiece.pos = newPos;
    }
}

function dropPiece() {
    if (!currentPiece || isPaused) return;
    const newPos = { ...currentPiece.pos };
    newPos.y++;
    if (isValidMove(currentPiece.matrix, newPos)) {
        currentPiece.pos = newPos;
    } else {
        lockPiece();
        spawnPiece();
    }
    dropCounter = 0;
}

function hardDrop() {
    if (!currentPiece || isPaused) return;
    while (isValidMove(currentPiece.matrix, { ...currentPiece.pos, y: currentPiece.pos.y + 1 })) {
        currentPiece.pos.y++;
         score += 1;
    }
    lockPiece();
    spawnPiece();
}


function lockPiece() {
    currentPiece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                if (currentPiece.pos.y + y < 0) return;
                board[currentPiece.pos.y + y][currentPiece.pos.x + x] = currentPiece.color;
            }
        });
    });
    clearLines();
    currentPiece = null;
}

function clearLines() {
    let linesClearedCount = 0;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        const removedRow = board.splice(y, 1)[0].fill(0);
        board.unshift(removedRow);
        linesClearedCount++;
        y++;
    }

    if (linesClearedCount > 0) {
        updateScore(linesClearedCount);
    }
}

function updateScore(clearedCount) {
    const linePoints = [0, 100, 300, 500, 800];
    score += linePoints[clearedCount] * level;
    linesCleared += clearedCount;
    level = Math.floor(linesCleared / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 75);
    updateGameInfo();
}

function spawnPiece() {
    currentPiece = nextPiece || getRandomPiece();
    nextPiece = getRandomPiece();
    drawNextPiece(); // Update next piece display

    if (!isValidMove(currentPiece.matrix, currentPiece.pos)) {
        gameOver();
    }
}

function checkGameOver() {
     for (let x = 0; x < COLS; x++) {
         if (board[0][x] !== 0) {
             return true;
         }
     }
     return false;
}

function updateGameInfo() {
    scoreDisplay.textContent = score;
    levelDisplay.textContent = level;
    highScoreDisplay.textContent = highScore;
}

function draw() {
    const boardBgColor = getCssVariableValue('--board-bg');
    ctx.fillStyle = boardBgColor || '#171425'; // Fallback color
    ctx.fillRect(0, 0, COLS, ROWS); // Use scaled coords for clearing

    drawBoard();
    if (currentPiece) {
        drawPiece(currentPiece);
    }
}

function gameLoop(time = 0) {
    if (isGameOver || isPaused) {
         if(!isPaused && !isGameOver) animationFrameId = requestAnimationFrame(gameLoop);
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
        dropPiece();
    }

    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    board = createBoard(ROWS, COLS);
    score = 0;
    level = 1;
    linesCleared = 0;
    dropInterval = 1000;
    isGameOver = false;
    isPaused = false;
    gameRunning = true;
    currentPiece = null;
    nextPiece = getRandomPiece();
    spawnPiece();
    updateGameInfo();
    gameOverOverlay.style.display = 'none';
    startButton.style.display = 'none';
    pauseButton.style.display = 'inline-block';
    pauseButton.textContent = 'Pause';

    lastTime = performance.now();
    dropCounter = 0;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

function pauseGame() {
     if (!gameRunning || isGameOver) return;
     isPaused = !isPaused;
     pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
     if (!isPaused) {
         lastTime = performance.now();
         animationFrameId = requestAnimationFrame(gameLoop);
     } else {
          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(0, ROWS / 2 - 2, COLS, 4);
          ctx.font = '2px Poppins, sans-serif';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('PAUSED', COLS / 2, ROWS / 2);
          ctx.restore();
     }
}

function gameOver() {
    isGameOver = true;
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', highScore);
        updateGameInfo();
    }

    finalScoreDisplay.textContent = score;
    gameOverOverlay.style.display = 'flex';
    startButton.style.display = 'none';
    pauseButton.style.display = 'none';
}

document.addEventListener('keydown', event => {
    if (!gameRunning || isPaused || isGameOver) return;

    switch (event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
            movePiece(-1);
            event.preventDefault();
            break;
        case 'ArrowRight':
         case 'd':
         case 'D':
            movePiece(1);
            event.preventDefault();
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            dropPiece();
            event.preventDefault();
            break;
        case 'ArrowUp':
        case 'w':
        case 'W':
            rotatePiece();
            event.preventDefault();
            break;
         case ' ':
             hardDrop();
             event.preventDefault();
             break;
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'p' || event.key === 'P') {
         if(gameRunning && !isGameOver) {
             pauseGame();
             event.preventDefault();
         }
    }
});

startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', pauseGame);
restartButton.addEventListener('click', startGame);

updateGameInfo();
draw(); // Draw initial state (empty board, next piece)
drawNextPiece(); // Explicitly draw the initial next piece