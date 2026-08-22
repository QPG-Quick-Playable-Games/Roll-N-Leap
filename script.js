const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const keys = {
  left: false,
  right: false,
  jumpHeld: false
};

const player = {
  x: 160,
  y: 0,
  vx: 0,
  vy: 0,
  r: 26,
  rotation: 0,
  angularVel: 0,
  grounded: true,
  coyoteTime: 0
};

const state = {
  gravity: 1850,
  cameraX: 0,
  score: 0,
  gameOver: false,
  lastTime: 0,
  nextSpawnX: 700,
  obstacles: [],
  particles: [],
  jumpBuffer: 0
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function terrainHeightAt(x) {
  const base = 405;
  const waveA = Math.sin(x * 0.0095) * 58;
  const waveB = Math.sin(x * 0.024 + 1.7) * 26;
  return base + waveA + waveB;
}

function setScore(value) {
  state.score = value;
  if (scoreEl) {
    scoreEl.textContent = `Score: ${state.score}`;
  }
}

function spawnParticles(x, y, color, count = 18) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 220,
      vy: -140 - Math.random() * 120,
      life: 0.7 + Math.random() * 0.7,
      color
    });
  }
}

function getObstacleRect(obstacle) {
  const groundY = terrainHeightAt(obstacle.x);
  if (obstacle.type === "coinBox") {
    return {
      x: obstacle.x - obstacle.width / 2,
      y: groundY - obstacle.height,
      width: obstacle.width,
      height: obstacle.height
    };
  }

  return {
    x: obstacle.x - obstacle.width / 2,
    y: groundY - obstacle.height,
    width: obstacle.width,
    height: obstacle.height
  };
}

function circleRectCollision(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function spawnObstacle() {
  const x = state.nextSpawnX;
  state.nextSpawnX += 180 + Math.random() * 140;

  if (Math.random() < 0.68) {
    state.obstacles.push({
      type: "fence",
      x,
      width: 28,
      height: 72,
      destroyed: false
    });
  }

  if (Math.random() < 0.8) {
    const boxX = x + 110 + Math.random() * 90;
    state.obstacles.push({
      type: "coinBox",
      x: boxX,
      width: 44,
      height: 44,
      destroyed: false
    });
  }
}

function resetGame() {
  state.gameOver = false;
  state.cameraX = 0;
  state.obstacles = [];
  state.particles = [];
  state.nextSpawnX = 700;
  state.jumpBuffer = 0;

  player.x = 160;
  player.y = terrainHeightAt(player.x) - player.r;
  player.vx = 0;
  player.vy = 0;
  player.rotation = 0;
  player.angularVel = 0;
  player.grounded = true;
  player.coyoteTime = 0;

  setScore(0);

  for (let i = 0; i < 8; i += 1) {
    spawnObstacle();
  }
}

function attemptJump() {
  if (state.gameOver) {
    return;
  }

  state.jumpBuffer = 0.14;
}

function handleObstacleCollisions() {
  for (const obstacle of state.obstacles) {
    if (obstacle.destroyed) {
      continue;
    }

    const rect = getObstacleRect(obstacle);
    if (!circleRectCollision(player, rect)) {
      continue;
    }

    if (obstacle.type === "coinBox") {
      obstacle.destroyed = true;
      setScore(state.score + 25);
      spawnParticles(rect.x + rect.width / 2, rect.y + rect.height / 2, "#ffdc61", 18);
      continue;
    }

    const topOfFence = rect.y + 8;
    const isOverFence = player.y + player.r < topOfFence + 8;
    const descending = player.vy > 0;

    if (isOverFence && descending) {
      continue;
    }

    state.gameOver = true;
    player.vx = 0;
    player.vy = -220;
    spawnParticles(player.x, player.y, "#ff7c5c", 22);
    break;
  }
}

function update(dt) {
  if (state.gameOver) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 500 * dt;
      particle.life -= dt;
      if (particle.life <= 0) {
        state.particles.splice(i, 1);
      }
    }
    return;
  }

  state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
  player.coyoteTime = player.grounded ? 0.12 : Math.max(0, player.coyoteTime - dt);

  if (state.jumpBuffer > 0 && (player.grounded || player.coyoteTime > 0)) {
    player.vy = -930;
    player.grounded = false;
    player.coyoteTime = 0;
    state.jumpBuffer = 0;
    player.angularVel = -7;
  }

  const headingInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const baseAccel = 220;
  const steerForce = 900;

  player.vx += baseAccel * dt;

  if (headingInput !== 0) {
    player.vx += headingInput * steerForce * dt;
  } else {
    player.vx *= 0.985;
  }

  player.vx = clamp(player.vx, -220, 420);

  player.vy += state.gravity * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const groundY = terrainHeightAt(player.x) - player.r;

  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.grounded = true;
    player.coyoteTime = 0.12;
  } else {
    player.grounded = false;
  }

  player.angularVel = player.grounded
    ? (player.vx / player.r) * 0.9
    : (player.angularVel * 0.96) + (player.vx / player.r) * 0.06;
  player.rotation += player.angularVel * dt;

  state.cameraX = player.x - 180;

  while (state.nextSpawnX < player.x + canvas.width + 260) {
    spawnObstacle();
  }

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x > state.cameraX - 220);
  handleObstacleCollisions();

  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 500 * dt;
    particle.life -= dt;
    if (particle.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  const distanceScore = Math.max(0, Math.floor((player.x - 160) / 12));
  if (distanceScore > state.score) {
    setScore(distanceScore);
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#8fd5ff");
  gradient.addColorStop(0.56, "#dff7ff");
  gradient.addColorStop(1, "#f3ebc9");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 245, 170, 0.85)";
  ctx.beginPath();
  ctx.arc(780, 90, 36, 0, Math.PI * 2);
  ctx.fill();

  for (let layer = 0; layer < 3; layer += 1) {
    const baseY = 380 + layer * 28;
    const amplitude = 42 + layer * 18;
    const phase = state.cameraX * (0.12 + layer * 0.06);

    ctx.beginPath();
    ctx.moveTo(0, canvas.height);

    for (let x = 0; x <= canvas.width + 40; x += 24) {
      const wx = x + state.cameraX * (0.28 + layer * 0.14) + phase;
      const y = baseY - Math.sin(wx * 0.013 + layer) * amplitude - layer * 18;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = ["#9fe082", "#78c66d", "#4fa35d"][layer];
    ctx.fill();
  }

  ctx.beginPath();
  for (let x = 0; x <= canvas.width + 30; x += 18) {
    const wx = x + state.cameraX;
    const wy = terrainHeightAt(wx);
    if (x === 0) {
      ctx.moveTo(x, wy);
    } else {
      ctx.lineTo(x, wy);
    }
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fillStyle = "#86d15e";
  ctx.fill();

  ctx.beginPath();
  for (let x = 0; x <= canvas.width + 30; x += 18) {
    const wx = x + state.cameraX;
    const wy = terrainHeightAt(wx) - 8;
    if (x === 0) {
      ctx.moveTo(x, wy);
    } else {
      ctx.lineTo(x, wy);
    }
  }
  ctx.strokeStyle = "#d8f98a";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawParticles() {
  for (const particle of state.particles) {
    const alpha = clamp(particle.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x - state.cameraX, particle.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFence(obstacle) {
  const x = obstacle.x - state.cameraX;
  const groundY = terrainHeightAt(obstacle.x);
  const y = groundY - obstacle.height;

  ctx.fillStyle = "#8a522d";
  ctx.fillRect(x - obstacle.width / 2, y, obstacle.width, obstacle.height);

  ctx.fillStyle = "#d28a3a";
  ctx.fillRect(x - obstacle.width / 2 + 5, y + 12, obstacle.width - 10, 10);
  ctx.fillRect(x - obstacle.width / 2 + 5, y + 32, obstacle.width - 10, 10);
  ctx.fillRect(x - obstacle.width / 2 + 5, y + 52, obstacle.width - 10, 10);

  ctx.fillStyle = "#5d2d18";
  ctx.fillRect(x - obstacle.width / 2 + 3, y, 6, obstacle.height);
  ctx.fillRect(x + obstacle.width / 2 - 9, y, 6, obstacle.height);
}

function drawCoinBox(obstacle) {
  if (obstacle.destroyed) {
    return;
  }

  const rect = getObstacleRect(obstacle);
  const x = rect.x - state.cameraX;
  const y = rect.y;

  ctx.fillStyle = "#d9982c";
  ctx.fillRect(x, y, rect.width, rect.height);

  ctx.strokeStyle = "#f5d36e";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4, y + 4, rect.width - 8, rect.height - 8);

  ctx.fillStyle = "#f8d35d";
  ctx.beginPath();
  ctx.arc(x + rect.width / 2, y + rect.height / 2 + 2, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#b16f1b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + rect.width / 2 - 5, y + rect.height / 2 + 2);
  ctx.lineTo(x + rect.width / 2 + 5, y + rect.height / 2 + 2);
  ctx.stroke();
}

function drawBoulder() {
  const screenX = player.x - state.cameraX;
  const screenY = player.y;

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(player.rotation);

  ctx.fillStyle = "#555a62";
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6b727b";
  ctx.beginPath();
  ctx.arc(-9, -7, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(14, 0);
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 14);
  ctx.stroke();

  ctx.restore();
}

function drawGameOverText() {
  if (!state.gameOver) {
    return;
  }

  ctx.fillStyle = "rgba(10, 18, 24, 0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 54px Arial";
  ctx.fillText("CRASH!", canvas.width / 2, canvas.height / 2 - 18);

  ctx.font = "24px Arial";
  ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 30);
}

function draw() {
  drawBackground();

  for (const obstacle of state.obstacles) {
    if (obstacle.destroyed) {
      continue;
    }

    if (obstacle.type === "fence") {
      drawFence(obstacle);
    } else {
      drawCoinBox(obstacle);
    }
  }

  drawBoulder();
  drawParticles();
  drawGameOverText();
}

function loop(timestamp) {
  const dt = Math.min((timestamp - state.lastTime) / 1000 || 0.016, 0.033);
  state.lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function bindControlButton(control, activeValue, isJump = false) {
  const button = document.querySelector(`[data-control="${control}"]`);
  if (!button) {
    return;
  }

  const setActive = (active) => {
    if (isJump) {
      keys.jumpHeld = active && !state.gameOver ? true : false;
      if (active && !state.gameOver) {
        attemptJump();
      }
      return;
    }

    keys[control] = active;
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setActive(true);
  });

  button.addEventListener("pointerup", () => setActive(false));
  button.addEventListener("pointerleave", () => setActive(false));
  button.addEventListener("pointercancel", () => setActive(false));
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "a" || key === "arrowleft") {
    keys.left = true;
  }

  if (key === "d" || key === "arrowright") {
    keys.right = true;
  }

  if (key === " " || key === "w" || key === "arrowup") {
    if (!keys.jumpHeld) {
      attemptJump();
      keys.jumpHeld = true;
    }
  }

  if (event.key.toLowerCase() === "r" && state.gameOver) {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (key === "a" || key === "arrowleft") {
    keys.left = false;
  }

  if (key === "d" || key === "arrowright") {
    keys.right = false;
  }

  if (key === " " || key === "w" || key === "arrowup") {
    keys.jumpHeld = false;
  }
});

bindControlButton("left", true, false);
bindControlButton("right", true, false);
bindControlButton("jump", true, true);

resetGame();
requestAnimationFrame(loop);
