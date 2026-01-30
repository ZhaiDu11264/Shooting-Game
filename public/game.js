const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const playerNameElement = document.getElementById('playerName');
const leaderboardList = document.getElementById('leaderboardList');
const backBtn = document.getElementById('backBtn');
const endGameBtn = document.getElementById('endGameBtn');
const gameTimeElement = document.getElementById('gameTime');
const gameEndModal = document.getElementById('gameEndModal');
const playAgainBtn = document.getElementById('playAgainBtn');
const backToLoginBtn = document.getElementById('backToLoginBtn');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight - 60;

const username = localStorage.getItem('username');
const userData = JSON.parse(localStorage.getItem('userData') || '{}');

if (!username) {
  alert('请先登录！');
  window.location.href = 'index.html';
}

playerNameElement.textContent = `玩家: ${username} (最佳: ${userData.bestScore || 0})`;

let score = 0;
let targets = [];
let ws;
let notifications = [];
let gameStartTime = Date.now();
let gameTimer;
let targetsHit = 0;
let previousLeaderboard = [];
let isGameActive = true;

// WebSocket 连接
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'login', username }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'initTargets') {
      targets = data.targets;
    }
    
    if (data.type === 'newTarget') {
      targets.push(data.target);
    }
    
    if (data.type === 'updateTargets') {
      // 更新目标位置
      data.targets.forEach(serverTarget => {
        const target = targets.find(t => t.id === serverTarget.id);
        if (target) {
          target.x = serverTarget.x;
          target.y = serverTarget.y;
          target.vx = serverTarget.vx;
          target.vy = serverTarget.vy;
        }
      });
    }
    
    if (data.type === 'targetHit') {
      const index = targets.findIndex(t => t.id === data.targetId);
      if (index !== -1) {
        targets.splice(index, 1);
      }
      
      // 显示击中通知
      if (data.username === username) {
        score += data.points;
        targetsHit++;
        scoreElement.textContent = score;
        showNotification(`+${data.points}`, '#4CAF50');
      } else {
        showNotification(`${data.username} 抢先击中！`, '#ff9800');
      }
    }
    
    if (data.type === 'leaderboard') {
      updateLeaderboard(data.data);
    }
  };
}

connectWebSocket();
startGameTimer();

// 绘制目标
function drawTarget(target) {
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
  ctx.fillStyle = target.color;
  ctx.fill();
  
  // 绘制靶心
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.fill();
  
  // 绘制外圈
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// 检查是否击中
function isHit(target, mouseX, mouseY) {
  const dx = mouseX - target.x;
  const dy = mouseY - target.y;
  return Math.sqrt(dx * dx + dy * dy) < target.radius;
}

// 显示通知
function showNotification(text, color) {
  notifications.push({
    text,
    color,
    alpha: 1,
    y: canvas.height / 2
  });
}

// 游戏循环
function gameLoop() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 绘制目标
  targets.forEach(target => {
    drawTarget(target);
  });
  
  // 绘制通知
  for (let i = notifications.length - 1; i >= 0; i--) {
    const notif = notifications[i];
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = notif.color;
    ctx.globalAlpha = notif.alpha;
    ctx.textAlign = 'center';
    ctx.fillText(notif.text, canvas.width / 2, notif.y);
    
    notif.y -= 2;
    notif.alpha -= 0.02;
    
    if (notif.alpha <= 0) {
      notifications.splice(i, 1);
    }
  }
  ctx.globalAlpha = 1;
  
  requestAnimationFrame(gameLoop);
}

gameLoop();

// 点击射击
canvas.addEventListener('click', (e) => {
  if (!isGameActive) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  for (let i = targets.length - 1; i >= 0; i--) {
    if (isHit(targets[i], mouseX, mouseY)) {
      // 发送击中消息到服务器
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'hit', 
          targetId: targets[i].id 
        }));
      }
      break;
    }
  }
});

// 更新排行榜
function updateLeaderboard(data) {
  leaderboardList.innerHTML = '';
  
  data.forEach((player, index) => {
    const li = document.createElement('li');
    
    // 检查排名变化
    const previousRank = previousLeaderboard.findIndex(p => p.username === player.username);
    const currentRank = index;
    
    li.innerHTML = `
      <span class="rank-number">#${index + 1}</span>
      <span class="player-name">${player.username}</span>
      <span class="player-score">${player.score}</span>
    `;
    
    // 当前玩家高亮
    if (player.username === username) {
      li.classList.add('current-player');
    }
    
    // 排名变化动画
    if (previousRank !== -1 && previousRank !== currentRank) {
      if (previousRank > currentRank) {
        li.classList.add('rank-up');
      } else {
        li.classList.add('rank-down');
      }
      
      // 移除动画类
      setTimeout(() => {
        li.classList.remove('rank-up', 'rank-down');
      }, 500);
    }
    
    leaderboardList.appendChild(li);
  });
  
  // 保存当前排行榜用于下次比较
  previousLeaderboard = [...data];
}

// 游戏计时器
function startGameTimer() {
  gameTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    gameTimeElement.textContent = `时间: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

// 结束游戏
function endGame() {
  isGameActive = false;
  clearInterval(gameTimer);
  
  const gameTime = Math.floor((Date.now() - gameStartTime) / 1000);
  const minutes = Math.floor(gameTime / 60);
  const seconds = gameTime % 60;
  
  // 计算排名
  const currentRank = previousLeaderboard.findIndex(p => p.username === username) + 1;
  
  // 显示游戏结束弹窗
  document.getElementById('finalScore').textContent = score;
  document.getElementById('finalTime').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  document.getElementById('targetsHit').textContent = targetsHit;
  document.getElementById('finalRank').textContent = currentRank > 0 ? `第${currentRank}名` : '未上榜';
  
  gameEndModal.classList.remove('hidden');
  
  // 通知服务器游戏结束
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ 
      type: 'gameEnd', 
      finalScore: score,
      gameTime: gameTime,
      targetsHit: targetsHit
    }));
  }
}

// 重新开始游戏
function restartGame() {
  score = 0;
  targetsHit = 0;
  gameStartTime = Date.now();
  isGameActive = true;
  scoreElement.textContent = '0';
  gameEndModal.classList.add('hidden');
  startGameTimer();
  
  // 重新连接WebSocket
  if (ws) {
    ws.close();
  }
  connectWebSocket();
}

// 事件监听
endGameBtn.addEventListener('click', () => {
  if (confirm('确定要结束当前游戏吗？')) {
    endGame();
  }
});

playAgainBtn.addEventListener('click', restartGame);

backToLoginBtn.addEventListener('click', () => {
  localStorage.removeItem('username');
  localStorage.removeItem('userData');
  window.location.href = 'index.html';
});

// 返回登录
backBtn.addEventListener('click', () => {
  if (confirm('确定要退出游戏吗？')) {
    localStorage.removeItem('username');
    localStorage.removeItem('userData');
    window.location.href = 'index.html';
  }
});

// 窗口大小调整
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 60;
});
