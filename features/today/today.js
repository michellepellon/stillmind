// Meditation prompts array
const meditationPrompts = [
    "What am I grateful for in this moment?",
    "What emotions am I holding onto today?",
    "How is my body feeling right now?",
    "What would I like to let go of?",
    "What brought me joy recently?",
    "What patterns do I notice in my thoughts?",
    "How can I be kind to myself today?",
    "What am I learning about myself?",
    "What needs my attention right now?",
    "How have I grown recently?",
    "What peace can I find in this moment?",
    "What wisdom is emerging within me?",
    "How am I connected to the world around me?",
    "What intention would serve me today?",
    "What am I curious about right now?"
];

// Store selected prompt for the session
let sessionPrompt = null;
let sessionPromptId = null;

function getRandomPrompt() {
    if (!sessionPrompt) {
        const randomIndex = Math.floor(Math.random() * meditationPrompts.length);
        sessionPrompt = meditationPrompts[randomIndex];
        sessionPromptId = `prompt_${randomIndex}`;
    }
    return { text: sessionPrompt, id: sessionPromptId };
}

export function render() {
    const app = document.getElementById('app');
    
    const today = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = today.toLocaleDateString('en-US', dateOptions);
    const prompt = getRandomPrompt();
    
    app.innerHTML = `
        <div class="today-container center" data-page="today">
            <div class="today-content">
                <div class="today-date-container">
                    <time class="today-date text-large-title" datetime="${today.toISOString().split('T')[0]}">
                        ${formattedDate}
                    </time>
                </div>
                
                <div class="today-prompt-container">
                    <p class="today-prompt text-title2">
                        ${prompt.text}
                    </p>
                </div>
                
                <div class="today-action-container">
                    <button 
                        onclick="window.navigateToWrite('${prompt.id}')" 
                        class="btn btn-primary today-begin-btn touch-target focus-ring"
                        aria-label="Begin meditation journal entry"
                    >
                        Begin
                    </button>
                </div>
                
                <nav class="today-nav" role="navigation" aria-label="App navigation">
                    <a 
                        href="#/history" 
                        onclick="event.preventDefault(); router.navigate('/history')" 
                        class="today-nav-link text-callout focus-ring"
                        aria-label="View past meditation entries"
                    >
                        Past entries
                    </a>
                    <span class="today-nav-separator text-tertiary" aria-hidden="true">·</span>
                    <a 
                        href="#/settings" 
                        onclick="event.preventDefault(); router.navigate('/settings')" 
                        class="today-nav-link text-callout focus-ring"
                        aria-label="App settings"
                    >
                        Settings
                    </a>
                </nav>
            </div>
        </div>
    `;
    
    // Refined entrance animation - single, purposeful motion
    requestAnimationFrame(() => {
        const content = document.querySelector('.today-content');
        if (content) {
            content.classList.add('fade-in');
        }
    });
}

// Export function to pass prompt ID to write screen
window.navigateToWrite = function(promptId) {
    // Store prompt ID for write screen to pick up
    window.sessionStorage.setItem('currentPromptId', promptId);
    router.navigate('/write');
};