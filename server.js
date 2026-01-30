const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
app.use(express.json());

// 用户注册接口
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, message: '用户名和密码不能为空' });
  }
  
  if (username.length < 2 || username.length > 20) {
    return res.json({ success: false, message: '用户名长度应在2-20个字符之间' });
  }
  
  if (password.length < 4 || password.length > 16) {
    return res.json({ success: false, message: '密码长度应在4-16个字符之间' });
  }
  
  if (users.has(username)) {
    return res.json({ success: false, message: '用户名已存在' });
  }
  
  // 注册新用户
  users.set(username, {
    password: password,
    bestScore: 0,
    totalGames: 0,
    registerTime: new Date().toISOString()
  });
  
  console.log(`新用户注册: ${username}`);
  res.json({ success: true, message: '注册成功！' });
});

// 用户登录接口
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.json({ success: false, message: '用户名和密码不能为空' });
  }
  
  const user = users.get(username);
  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }
  
  if (user.password !== password) {
    return res.json({ success: false, message: '密码错误' });
  }
  
  console.log(`用户登录: ${username}`);
  res.json({ 
    success: true, 
    message: '登录成功！',
    userData: {
      username: username,
      bestScore: user.bestScore,
      totalGames: user.totalGames
    }
  });
});

// 存储玩家数据和排行榜
const players = new Map();
const leaderboard = [];
let targets = [];
let targetIdCounter = 0;

// 用户数据存储（实际项目中应使用数据库）
const users = new Map(); // username -> { password, bestScore, totalGames }

// 初始化目标
function initTargets() {
  for (let i = 0; i < 5; i++) {
    spawnTarget();
  }
  // 定期生成新目标
  setInterval(() => {
    if (targets.length < 8) {
      spawnTarget();
    }
  }, 2000);
}

function spawnTarget() {
  const target = {
    id: targetIdCounter++,
    radius: 20 + Math.random() * 30,
    x: 50 + Math.random() * 700,
    y: 50 + Math.random() * 500,
    vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`
  };
  targets.push(target);
  broadcast({ type: 'newTarget', target });
}

// 更新目标位置
function updateTargets() {
  targets.forEach(target => {
    target.x += target.vx;
    target.y += target.vy;
    
    if (target.x - target.radius < 0 || target.x + target.radius > 800) {
      target.vx *= -1;
    }
    if (target.y - target.radius < 0 || target.y + target.radius > 600) {
      target.vy *= -1;
    }
  });
}

// 每帧更新目标位置并广播
setInterval(() => {
  updateTargets();
  broadcast({ type: 'updateTargets', targets });
}, 1000 / 30); // 30 FPS

initTargets();

// WebSocket 连接处理
wss.on('connection', (ws) => {
  console.log('新玩家连接');
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'login') {
      players.set(ws, { username: data.username, score: 0 });
      
      // 增加游戏次数
      const user = users.get(data.username);
      if (user) {
        user.totalGames += 1;
      }
      
      ws.send(JSON.stringify({ type: 'loginSuccess', username: data.username }));
      // 发送当前所有目标
      ws.send(JSON.stringify({ type: 'initTargets', targets }));
      ws.send(JSON.stringify({ type: 'leaderboard', data: leaderboard }));
    }
    
    if (data.type === 'hit') {
      const targetIndex = targets.findIndex(t => t.id === data.targetId);
      if (targetIndex !== -1) {
        const target = targets[targetIndex];
        const player = players.get(ws);
        
        if (player) {
          const points = Math.floor(100 / target.radius);
          player.score += points;
          updateLeaderboard(player.username, player.score);
          
          // 广播目标被击中
          broadcast({
            type: 'targetHit',
            targetId: data.targetId,
            username: player.username,
            points
          });
          
          // 移除目标
          targets.splice(targetIndex, 1);
          
          // 延迟生成新目标
          setTimeout(spawnTarget, 1000);
          
          // 实时广播排行榜更新
          broadcastLeaderboard();
        }
      }
    }
    
    if (data.type === 'getLeaderboard') {
      ws.send(JSON.stringify({ type: 'leaderboard', data: leaderboard }));
    }
    
    if (data.type === 'gameEnd') {
      const player = players.get(ws);
      if (player) {
        console.log(`${player.username} 游戏结束 - 得分: ${data.finalScore}, 时长: ${data.gameTime}秒, 击中: ${data.targetsHit}个目标`);
      }
    }
  });
  
  ws.on('close', () => {
    players.delete(ws);
    console.log('玩家断开连接');
  });
});

function updateLeaderboard(username, score) {
  const existingIndex = leaderboard.findIndex(p => p.username === username);
  
  if (existingIndex !== -1) {
    if (score > leaderboard[existingIndex].score) {
      leaderboard[existingIndex].score = score;
    }
  } else {
    leaderboard.push({ username, score });
  }
  
  // 更新用户最佳成绩
  const user = users.get(username);
  if (user && score > user.bestScore) {
    user.bestScore = score;
  }
  
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard.splice(10); // 只保留前10名
}

function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastLeaderboard() {
  broadcast({ type: 'leaderboard', data: leaderboard });
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // 监听所有网络接口

server.listen(PORT, HOST, () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  console.log('\n🎮 射击游戏服务器已启动！\n');
  console.log('可通过以下地址访问：');
  console.log(`  本地: http://localhost:${PORT}`);
  
  // 显示所有可用的局域网IP
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  局域网: http://${iface.address}:${PORT}`);
      }
    });
  });
  
  console.log('\n按 Ctrl+C 停止服务器\n');
});
