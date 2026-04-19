// Global state
let userId = null;
let conversationId = null;
let isWaitingForResponse = false;
let authToken = null;

// API base URL
const API_BASE = window.location.origin;
// No frontend redirects - backend is standalone

// Browser console: keep verbose logs on localhost only. On deployed hosts, silence console
// (users who open DevTools won't see chat/debug noise). Add ?debug=1 to the URL to enable.
(function () {
    const h = window.location.hostname;
    const isLocal = h === 'localhost' || h === '127.0.0.1';
    const forceDebug = new URLSearchParams(window.location.search).get('debug') === '1';
    if (!isLocal && !forceDebug) {
        var noop = function () {};
        console.log = noop;
        console.debug = noop;
        console.info = noop;
        console.warn = noop;
        console.error = noop;
    }
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded');
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Current search params:', window.location.search);
    
    // Check for Auth0 callback (token, userId, or user info in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userIdParam = urlParams.get('userId');
    const userParam = urlParams.get('user');
    
    console.log('🔍 URL Parameters found:');
    console.log('  - token:', token ? 'YES (length: ' + token.length + ')' : 'NO');
    console.log('  - userId:', userIdParam || 'NO');
    console.log('  - user:', userParam ? 'YES' : 'NO');
    
    if (userIdParam) {
        console.log('✅✅✅ UserId found in URL:', userIdParam);
        // User is authenticated - keep modal hidden
        
        // Clear redirect flag since we successfully got userId
        sessionStorage.removeItem('redirectingToAuth');
        
        // UserId is the Auth0 subject, e.g. auth0|abc123.
        userId = userIdParam;
        if (!userId) {
            console.error('❌ Invalid userId:', userIdParam);
            // Redirect to frontend for authentication
            console.log('❌ Invalid userId - redirecting to frontend');
            redirectToFrontend();
            return;
        }
        console.log('✅ UserId parsed:', userId);
        localStorage.setItem('userId', userId);
        console.log('✅ UserId stored in localStorage:', userId);
        
        // Clean URL immediately to prevent re-reading
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        console.log('✅ URL cleaned, new URL:', cleanUrl);
        
        // Small delay to ensure DOM is ready, then load profile and enable chat
        setTimeout(() => {
            console.log('✅ Loading user profile and enabling chat...');
            loadUserProfile(userId);
            console.log('✅✅✅ Profile loading initiated!');
        }, 100);
    } else if (token) {
        console.log('Token found in URL, length:', token.length);
        // Token passed from Auth0 callback - user is authenticated
        authToken = decodeURIComponent(token); // Decode in case it was encoded
        localStorage.setItem('authToken', authToken);
        console.log('Token stored, calling initializeUser...');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        initializeUser();
    } else if (userParam) {
        console.log('User info found in URL, creating session...');
        // User info passed (fallback when token not available) - user is authenticated
        try {
            const userInfo = JSON.parse(decodeURIComponent(userParam));
            console.log('User info:', userInfo);
            // Call FastAPI to create user and get a session
            createUserSession(userInfo);
        } catch (e) {
            console.error('Error parsing user info:', e);
            // Redirect to frontend for authentication
            console.log('❌ Error parsing user info - redirecting to frontend');
            redirectToFrontend();
        }
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        console.log('No token, userId, or user in URL, checking localStorage and sessionStorage...');
        // Check sessionStorage first (from frontend redirect)
        const sessionUserId = sessionStorage.getItem('auth_userId');
        if (sessionUserId) {
            console.log('✅ UserId found in sessionStorage:', sessionUserId);
            userId = sessionUserId;
            sessionStorage.removeItem('auth_userId'); // Clean up
            if (userId) {
                localStorage.setItem('userId', userId);
                loadUserProfile(userId);
                return;
            }
        }
        
        // Check if already logged in
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            console.log('✅ UserId found in localStorage:', storedUserId);
            userId = storedUserId;
            if (!userId) {
                console.error('❌ Invalid userId in localStorage:', storedUserId);
                localStorage.removeItem('userId');
                redirectToFrontend();
            } else {
                // User is authenticated - load profile and enable chat
                loadUserProfile(userId);
            }
        } else {
            authToken = localStorage.getItem('authToken');
            if (authToken) {
                console.log('Token found in localStorage, calling initializeUser...');
                // User has token - initialize user session
                initializeUser();
            } else {
                // No authentication - redirect to frontend
                console.log('❌ No authentication found - authentication required');
                console.log('💡 Please sign in through the frontend application');
                redirectToFrontend();
            }
        }
    }
    
    // Chat input handler
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isWaitingForResponse) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    sendButton.addEventListener('click', sendMessage);
});

// Backend requires authentication - redirect unauthenticated users to frontend
function redirectToFrontend() {
    // TODO: Replace 'your-app-name.vercel.app' with your actual Vercel frontend URL
    // Example: 'https://creating-wings-frontend.vercel.app'
    const frontendUrl = "http://localhost:3000";
    
    console.log('🔐 Authentication required - redirecting to frontend:', frontendUrl);
    
    // Show message to user
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666; max-width: 500px; margin: 50px auto;">
                <h2 style="color: #333; margin-bottom: 20px;">Authentication Required</h2>
                <p style="margin-bottom: 20px;">Please sign in through the frontend application to access Pia, your financial empowerment assistant from Creating Wings.</p>
                <a href="${frontendUrl}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Go to Frontend →</a>
                <p style="margin-top: 20px; font-size: 14px; color: #999;">Redirecting automatically in 3 seconds...</p>
            </div>
        `;
    }
    
    // Also redirect after 3 seconds
    setTimeout(() => {
        window.location.href = frontendUrl;
    }, 3000);
}

function handleLogin() {
    // Redirect to frontend for authentication
    redirectToFrontend();
}

// Anonymous session creation removed - authentication required
// Users must authenticate through frontend before accessing backend

async function createUserSession(userInfo) {
    try {
        console.log('Creating user session with info:', userInfo);
        // Call FastAPI to create/update user and return user_id
        const response = await fetch(`${API_BASE}/api/auth/callback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sub: userInfo.sub,
                name: userInfo.name,
                email: userInfo.email
            })
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            console.error('Failed to create user session:', error);
            redirectToFrontend();
            return;
        }
        
        const userData = await response.json();
        console.log('User session created:', userData);
        
        userId = userData.user_id;
        localStorage.setItem('userId', userId);
        
        // Modal removed - user authenticated
        displayUserProfile(userData);
        enableChat();
        
        // Update welcome message with personalized greeting
        updateWelcomeMessage(userData.name);
    } catch (error) {
        console.error('Error creating user session:', error);
        redirectToFrontend();
    }
}

async function initializeUser() {
    try {
        console.log('Initializing user with token:', authToken ? 'Token present' : 'No token');
        
        if (!authToken) {
            console.error('❌ No auth token available - redirecting to frontend');
            redirectToFrontend();
            return;
        }
        
        // Verify token and get user info
        console.log('Calling /api/user/me with token');
        const response = await fetch(`${API_BASE}/api/user/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            console.error('API error response:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            
            if (response.status === 401) {
                // Token expired or invalid
                console.error('❌ Token is invalid or expired - redirecting to frontend');
                localStorage.removeItem('authToken');
                authToken = null;
                redirectToFrontend();
                return;
            }
            
            if (response.status === 404) {
                // User not found - this shouldn't happen now but handle it
                console.error('❌ User not found in database - redirecting to frontend');
                localStorage.removeItem('authToken');
                authToken = null;
                redirectToFrontend();
                return;
            }
            
            // Other errors
            console.error('❌ Unexpected error:', errorData);
            alert(`Authentication error: ${errorData.detail || response.statusText}. Redirecting to login...`);
            localStorage.removeItem('authToken');
            authToken = null;
            redirectToFrontend();
            return;
        }
        
        const userData = await response.json();
        console.log('User data received:', userData);
        
        userId = userData.user_id;
        localStorage.setItem('userId', userId);
        
        // Modal removed - user authenticated
        displayUserProfile(userData);
        enableChat();
        
        // Update welcome message with personalized greeting
        updateWelcomeMessage(userData.name);
    } catch (error) {
        console.error('Error initializing user:', error);
        localStorage.removeItem('authToken');
        authToken = null;
        showLoginModal();
    }
}

async function loadUserProfile(userId) {
    console.log('📥 Loading user profile for userId:', userId);
    try {
        const profileUrl = `${API_BASE}/api/user/${encodeURIComponent(userId)}`;
        const response = await fetch(profileUrl);
        console.log('📡 API response status:', response.status);
        console.log('📡 API URL:', profileUrl);
        
        if (response.ok) {
            const userData = await response.json();
            console.log('✅ User data received:', userData);
            console.log('✅ User name:', userData.name);
            console.log('✅ User email:', userData.email);
            
            // Check if name is valid (not "Guest User" or empty)
            if (userData.name && userData.name !== 'Guest User' && userData.name.trim() !== '') {
                displayUserProfile(userData);
                updateWelcomeMessage(userData.name);
                enableChat();
            } else {
                console.warn('⚠️ User name is invalid or missing:', userData.name);
                console.warn('⚠️ User data:', userData);
                // Still show profile but with a default message
                displayUserProfile(userData);
                updateWelcomeMessage(userData.name || 'there');
                enableChat();
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Failed to load user profile:', response.status, errorText);
            console.error('❌ Response headers:', response.headers);
            redirectToFrontend();
        }
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        console.error('❌ Error stack:', error.stack);
        redirectToFrontend();
    }
}

function displayUserProfile(userData) {
    console.log('🎨 Displaying user profile:', userData);
    const userProfile = document.getElementById('userProfile');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userInitials = document.getElementById('userInitials');
    
    if (!userProfile) {
        console.error('❌ userProfile element not found');
        return;
    }
    if (!userName) {
        console.error('❌ userName element not found');
        return;
    }
    if (!userEmail) {
        console.error('❌ userEmail element not found');
        return;
    }
    if (!userInitials) {
        console.error('❌ userInitials element not found');
        return;
    }
    
    userName.textContent = userData.name || 'User';
    userEmail.textContent = userData.email || '';
    
    // Generate initials from name
    const initials = (userData.name || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    userInitials.textContent = initials;
    
    // Use class instead of inline style for better CSS control
    userProfile.style.display = 'flex';
    userProfile.classList.add('show');
    console.log('✅ User profile displayed');
}

function updateWelcomeMessage(userName) {
    console.log('💬 Updating welcome message for:', userName);
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        const name = userName || 'there';
        welcomeMessage.innerHTML = `<p>Hi ${name}! I'm Pia, your financial empowerment assistant from Creating Wings. How can I help you today?</p>`;
        console.log('✅ Welcome message updated');
    } else {
        console.error('❌ welcomeMessage element not found');
    }
}

function enableChat() {
    console.log('🔓 Enabling chat...', { userId });
    
    const chatInputContainer = document.getElementById('chatInputContainer');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!chatInputContainer) {
        console.error('❌ chatInputContainer not found!');
        return;
    }
    if (!chatInput) {
        console.error('❌ chatInput not found!');
        return;
    }
    if (!sendButton) {
        console.error('❌ sendButton not found!');
        return;
    }
    
    // Show chat input container
    chatInputContainer.style.display = 'block';
    chatInput.disabled = false;
    sendButton.disabled = false;
    chatInput.focus();
    
    console.log('✅ Chat enabled!');
    
    // If no userId, redirect to frontend for authentication
    if (!userId || userId === null || userId === undefined) {
        console.log('❌ No userId found - authentication required');
        redirectToFrontend();
        return;
    }
}


async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message || isWaitingForResponse || !userId) {
        if (!userId) {
            redirectToFrontend();
        }
        return;
    }
    
    // Clear input
    chatInput.value = '';
    
    // Add user message to chat
    addMessage('user', message);
    
    // Remove thinking indicator - we'll use streaming instead
    // Disable input while waiting
    isWaitingForResponse = true;
    chatInput.disabled = true;
    document.getElementById('sendButton').disabled = true;
    
    // Hide escalation notice
    document.getElementById('escalationNotice').style.display = 'none';
    
    // Create assistant message container for streaming
    const assistantMessageId = addMessage('assistant', '', 'streaming');
    const assistantMessageEl = document.getElementById(assistantMessageId);
    
    try {
        const requestBody = {
            user_id: String(userId),
            message: message
        };
        
        if (conversationId) {
            requestBody.conversation_id = conversationId;
        }
        
        // Use streaming endpoint
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add Authorization header only if token is available
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(`${API_BASE}/api/chat/stream`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // Authentication error
                console.error('Authentication failed, showing login');
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                authToken = null;
                userId = null;
                redirectToFrontend();
                return;
            }
            const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
            console.error('Chat error:', errorData);
            throw new Error(errorData.detail || 'Failed to get response');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.error) {
                            throw new Error('Streaming error occurred');
                        }
                        
                        if (data.chunk) {
                            fullResponse += data.chunk;
                            // Update message with markdown rendering
                            updateStreamingMessage(assistantMessageId, fullResponse);
                        }
                        
                        if (data.done) {
                            // Update conversation ID
                            if (data.conversation_id) {
                                conversationId = data.conversation_id;
                            }
                            
                            // Show escalation notice if needed
                            if (data.escalate) {
                                showEscalationNotice(data.escalation_type);
                            }
                            
                            // Remove streaming class
                            assistantMessageEl.classList.remove('streaming');
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Chat error:', error);
        removeMessage(assistantMessageId);
        addMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
    } finally {
        // Re-enable input
        isWaitingForResponse = false;
        chatInput.disabled = false;
        document.getElementById('sendButton').disabled = false;
        chatInput.focus();
    }
}

function updateStreamingMessage(messageId, content) {
    const messageEl = document.getElementById(messageId);
    if (messageEl) {
        // Render markdown content
        messageEl.innerHTML = renderMarkdown(content);
        scrollToBottom();
    }
}

function renderMarkdown(text) {
    if (!text) return '';
    
    let html = text;
    
    // Escape HTML first (but preserve existing tags from streaming)
    const hasTags = /<[^>]+>/.test(html);
    if (!hasTags) {
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // Headers (must be before other processing)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    
    // Process lists - handle bullet points
    const lines = html.split('\n');
    let inList = false;
    let inOrderedList = false;
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const bulletMatch = line.match(/^[-*]\s+(.+)$/);
        const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
        
        if (bulletMatch) {
            if (!inList) {
                if (inOrderedList) {
                    processedLines.push('</ol>');
                    inOrderedList = false;
                }
                processedLines.push('<ul>');
                inList = true;
            }
            processedLines.push(`<li>${bulletMatch[1]}</li>`);
        } else if (orderedMatch) {
            if (!inOrderedList) {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push('<ol>');
                inOrderedList = true;
            }
            processedLines.push(`<li>${orderedMatch[1]}</li>`);
        } else {
            if (inList) {
                processedLines.push('</ul>');
                inList = false;
            }
            if (inOrderedList) {
                processedLines.push('</ol>');
                inOrderedList = false;
            }
            processedLines.push(line);
        }
    }
    
    // Close any open lists
    if (inList) processedLines.push('</ul>');
    if (inOrderedList) processedLines.push('</ol>');
    
    html = processedLines.join('\n');
    
    // Split into paragraphs (double newline)
    html = html.split(/\n\n+/).map(para => {
        para = para.trim();
        if (!para) return '';
        
        // Don't wrap headers, lists, or existing paragraphs in <p>
        if (para.match(/^<[hulol]/) || para.startsWith('<p>')) {
            return para;
        }
        
        return `<p>${para}</p>`;
    }).join('');
    
    // Single line breaks within paragraphs
    html = html.replace(/(<p>.*?<\/p>)/gs, (match) => {
        return match.replace(/\n/g, '<br>');
    });
    
    // Clean up
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*<\/p>/g, '');
    
    return html;
}

function showEscalationNotice(escalationType) {
    const noticeEl = document.getElementById('escalationNotice');
    const noticeP = noticeEl.querySelector('p');
    
    const messages = {
        'DANGER': '<strong>Immediate Safety Concern</strong><br>Your message has been escalated for immediate safety concerns. Please contact <strong>911</strong> or the <strong>National Suicide Prevention Lifeline at 988</strong> if you need immediate help.',
        'ABUSE': '<strong>Support Available</strong><br>Your message has been escalated. Please contact the <strong>National Domestic Violence Hotline at 1-800-799-7233</strong> for confidential support and resources.',
        'SENSITIVE': '<strong>Expert Support</strong><br>Your question has been escalated to ensure you get the best support. A specialist will contact you shortly.'
    };
    
    noticeP.innerHTML = messages[escalationType] || 'Your question has been escalated to a human expert. They will contact you shortly.';
    noticeEl.style.display = 'block';
}

function addMessage(role, content, className = '') {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now() + '-' + Math.random();
    messageDiv.id = messageId;
    messageDiv.className = `message ${role} ${className}`;
    
    // Check if content contains HTML (from markdown rendering)
    if (className === 'streaming' || content.includes('<')) {
        messageDiv.innerHTML = content || '';
    } else {
        // Render markdown for non-streaming messages
        messageDiv.innerHTML = renderMarkdown(content);
    }
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    return messageId;
}

function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

