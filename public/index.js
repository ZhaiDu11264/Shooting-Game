const loginBtn = document.getElementById('loginBtn');
const registBtn = document.getElementById('registBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

loginBtn.addEventListener('click', login);
registBtn.addEventListener('click', register);

// 回车键登录
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') passwordInput.focus();
});

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

// 登录功能
async function login() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        showMessage('请输入用户名和密码！', 'error');
        return;
    }
    
    try {
        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('username', username);
            localStorage.setItem('userData', JSON.stringify(result.userData));
            showMessage('登录成功！', 'success');
            setTimeout(() => {
                window.location.href = 'game.html';
            }, 1000);
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('网络错误，请重试', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = '开始游戏';
    }
}

// 注册功能
async function register() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (!username || !password) {
        showMessage('请输入用户名和密码！', 'error');
        return;
    }
    
    try {
        registBtn.disabled = true;
        registBtn.textContent = '注册中...';
        
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('注册成功！请登录', 'success');
            passwordInput.value = '';
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('网络错误，请重试', 'error');
    } finally {
        registBtn.disabled = false;
        registBtn.textContent = '注册';
    }
}

// 显示消息提示
function showMessage(message, type) {
    // 移除已存在的消息
    const existingMsg = document.querySelector('.message');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // 3秒后自动消失
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}