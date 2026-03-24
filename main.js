const SHEET_ID = '1-OLtX148Img-7cP1pUbjntNBD3CUiLy3lTvVjovlpac';
const SHEET_NAME = 'Sheet1'; 
const API_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}&t=${new Date().getTime()}`;

let allQuestions = [];
let currentQuiz = [];
let currentIndex = 0;
let timer;
let studentName = "";
let qStatus = []; 
let userAnswers = []; 

let pendingTestName = "";
let pendingTestMins = 0;

window.onload = function() {
    // Phone memory (localStorage) check with safety
    try {
        if(localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            document.getElementById('dark-btn').innerText = '☀️';
        }
    } catch(e) { console.log("Local storage restricted for Dark Mode"); }

    document.getElementById('loading-overlay').style.display = 'flex';
    fetchData();
};

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    try { 
        localStorage.setItem('darkMode', isDark); 
    } catch(e) {}
    document.getElementById('dark-btn').innerText = isDark ? '☀️' : '🌙';
}

function fetchData() {
    fetch(API_URL).then(res => res.text()).then(data => {
        const json = JSON.parse(data.substring(47).slice(0, -2));
        
        allQuestions = json.table.rows.map(row => {
            let originalOpts = [row.c[1]?.v, row.c[2]?.v, row.c[3]?.v, row.c[4]?.v].filter(Boolean);
            let rawAns = row.c[5]?.v;
            let resolvedAns = rawAns;

            if (rawAns) {
                let ansStr = rawAns.toString().trim().toUpperCase();
                if (ansStr === 'A' || ansStr === 'OPTION A' || ansStr === '1' || ansStr === 'OPTION 1') resolvedAns = originalOpts[0];
                else if (ansStr === 'B' || ansStr === 'OPTION B' || ansStr === '2' || ansStr === 'OPTION 2') resolvedAns = originalOpts[1];
                else if (ansStr === 'C' || ansStr === 'OPTION C' || ansStr === '3' || ansStr === 'OPTION 3') resolvedAns = originalOpts[2];
                else if (ansStr === 'D' || ansStr === 'OPTION D' || ansStr === '4' || ansStr === 'OPTION 4') resolvedAns = originalOpts[3];
            }

            return {
                q: row.c[0]?.v,                        
                opt: originalOpts, 
                ans: resolvedAns,                      
                sub: row.c[6]?.v ? row.c[6].v.toString().trim() : "", 
                expl: row.c[7]?.v || "Vyakhya uplabdh nahi hai.",      
                img: row.c[8]?.v                       
            };
        }).filter(i => i.q && i.q !== "Question");
        
        document.getElementById('loading-overlay').style.display = 'none';

        try {
            const saved = localStorage.getItem('studentName');
            if(saved) { studentName = saved; showDashboard(saved); }
            else { document.getElementById('login-screen').style.display = 'block'; }
        } catch (error) {
            document.getElementById('login-screen').style.display = 'block';
        }

    }).catch(err => {
        document.querySelector('.loading-text').innerText = "Internet Error! Please Refresh.";
        document.querySelector('.loading-text').style.color = "red";
    });
}

function openTestSelector(baseSubject, mins) {
    const availableTests = [...new Set(
        allQuestions.map(q => q.sub).filter(s => s.toLowerCase().includes(baseSubject.toLowerCase()))
    )].sort(); 

    if (availableTests.length === 0) return alert(`❌ '${baseSubject}' ke sawal abhi uplabdh nahi hain.`);

    if (availableTests.length === 1) { 
        showInstructions(availableTests[0], mins); 
        return; 
    }

    const listContainer = document.getElementById('test-list-container');
    listContainer.innerHTML = "";
    document.getElementById('modal-subject-title').innerText = `Select ${baseSubject} Test`;

    availableTests.forEach(testName => {
        const btn = document.createElement('button');
        btn.className = 'test-list-btn';
        btn.innerText = `📝 ${testName}`; 
        btn.onclick = () => { closeTestSelector(); showInstructions(testName, mins); };
        listContainer.appendChild(btn);
    });

    document.getElementById('test-selector-modal').style.display = 'flex';
}

function closeTestSelector() { document.getElementById('test-selector-modal').style.display = 'none'; }

function showInstructions(testName, mins) {
    pendingTestName = testName;
    pendingTestMins = mins;

    document.getElementById('inst-title').innerText = testName;
    document.getElementById('inst-time').innerText = mins;
    
    let hasNegative = testName.toLowerCase().includes('vanrakshak');
    document.getElementById('inst-neg').innerText = hasNegative ? 'Yes (-0.25 per wrong answer)' : 'No';
    document.getElementById('inst-neg').style.color = hasNegative ? 'var(--danger)' : 'var(--success)';
    
    document.getElementById('agree-check').checked = false;
    switchScreen('instructions-screen');
}

function verifyAndStart() {
    if(!document.getElementById('agree-check').checked) {
        alert("Please check the 'I am ready to begin' box.");
        return;
    }
    startQuiz(pendingTestName, pendingTestMins);
}

function shuffleArray(array) {
    let newArray = [...array]; 
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function startQuiz(exactSubjectName, mins) {
    let filteredQuestions = allQuestions.filter(i => i.sub === exactSubjectName);
    if(filteredQuestions.length === 0) return alert("Error: Questions not found!");
    
    let deepCopiedQuestions = JSON.parse(JSON.stringify(filteredQuestions));
    deepCopiedQuestions.forEach(q => { q.opt = shuffleArray(q.opt); });
    currentQuiz = shuffleArray(deepCopiedQuestions);
    
    currentIndex = 0;
    qStatus = new Array(currentQuiz.length).fill(0);
    userAnswers = new Array(currentQuiz.length).fill(null);
    document.getElementById('subject-label').innerText = exactSubjectName;
    
    switchScreen('quiz-screen');
    loadQuestion();
    renderPalette();
    startTimer(mins);
}

function loadQuestion() {
    const q = currentQuiz[currentIndex];
    const qTextDiv = document.getElementById('q-text');
    
    let imageHTML = "";
    if (q.img && q.img.length > 5) {
        let cleanUrl = q.img.trim();
        if (cleanUrl.includes("drive.google.com") && cleanUrl.includes("/view")) {
             cleanUrl = cleanUrl.replace("/file/d/", "/uc?export=view&id=").replace("/view?usp=sharing", "").replace("/view?usp=drivesdk", "");
        }
        imageHTML = `<img src="${cleanUrl}" style="max-width: 100%; height: auto; border-radius: 8px; margin-top: 10px; display: block; border: 1px solid #ddd;" onerror="this.style.display='none'">`;
    }

    qTextDiv.innerHTML = `<div>Q.${currentIndex + 1} ${q.q}</div>${imageHTML}`;

    const optDiv = document.getElementById('q-options');
    optDiv.innerHTML = "";
    
    q.opt.forEach(o => {
        if(o) {
            const btn = document.createElement('button');
            btn.className = `opt-btn ${userAnswers[currentIndex] === o ? 'selected' : ''}`;
            btn.innerText = o;
            btn.onclick = () => {
                userAnswers[currentIndex] = o;
                qStatus[currentIndex] = 1; 
                renderPalette();
                loadQuestion(); 
            };
            optDiv.appendChild(btn);
        }
    });
    if(qStatus[currentIndex] === 0) qStatus[currentIndex] = 2; 
    renderPalette();
}

function renderPalette() {
    const pal = document.getElementById('q-palette');
    pal.innerHTML = "";
    qStatus.forEach((status, idx) => {
        const btn = document.createElement('div');
        btn.className = 'q-num';
        if(idx === currentIndex) btn.classList.add('current');
        if(status === 1) btn.classList.add('answered');
        if(status === 2) btn.classList.add('skipped');
        if(status === 3) btn.classList.add('reviewed');
        btn.innerText = idx + 1;
        btn.onclick = () => { currentIndex = idx; loadQuestion(); };
        pal.appendChild(btn);
    });
}

function nextQuestion() { if(currentIndex < currentQuiz.length - 1) { currentIndex++; loadQuestion(); } }
function prevQuestion() { if(currentIndex > 0) { currentIndex--; loadQuestion(); } }
function markReview() { qStatus[currentIndex] = 3; renderPalette(); nextQuestion(); }

function startTimer(m) {
    let s = m * 60;
    clearInterval(timer);
    timer = setInterval(() => {
        let mins = Math.floor(s/60), secs = s%60;
        document.getElementById('time-left').innerText = `${mins}:${secs<10?'0'+secs:secs}`;
        if(s-- <= 0) { clearInterval(timer); endQuiz(); }
    }, 1000);
}

function confirmSubmit() { if(confirm("Kya aap test finish karna chahte hain?")) endQuiz(); }

function endQuiz() {
    clearInterval(timer);
    let finalScore = 0;
    let rightCount = 0;
    let wrongCount = 0;
    let attempted = 0;
    const revBox = document.getElementById('review-box');
    revBox.innerHTML = "";
    
    const testName = document.getElementById('subject-label').innerText;
    const isVanrakshak = testName.toLowerCase().includes('vanrakshak');
    
    currentQuiz.forEach((q, i) => {
        const userAnswer = userAnswers[i] ? userAnswers[i].toString().trim().toLowerCase() : "";
        const correctAnswer = q.ans ? q.ans.toString().trim().toLowerCase() : "";
        
        let isCorrect = false;
        let isAttempted = userAnswer !== "";

        if (isAttempted) {
            attempted++;
            if (userAnswer === correctAnswer) {
                isCorrect = true;
                finalScore += 1;
                rightCount++;
            } else {
                wrongCount++;
                if (isVanrakshak) finalScore -= 0.25; 
            }
        }
        
        let reviewImg = "";
        if(q.img && q.img.length > 5) {
             let rUrl = q.img.replace("/file/d/", "/uc?export=view&id=").replace("/view?usp=sharing", "").replace("/view?usp=drivesdk", "");
             reviewImg = `<br><img src="${rUrl}" style="max-height: 100px; margin-top:5px;">`;
        }

        const card = document.createElement('div');
        card.className = `review-card ${isCorrect ? 'correct' : (isAttempted ? 'wrong' : '')}`;
        card.innerHTML = `<b>Q.${i+1}: ${q.q}</b>${reviewImg}<br><span style="color:${isCorrect?'green':(isAttempted?'red':'#6b7280')}">Aapne: ${userAnswers[i] || 'Nahi kiya'}</span> | <span style="color:green; font-weight:bold;">Sahi: ${q.ans}</span><div class="expl-box">💡 ${q.expl}</div>`;
        revBox.appendChild(card);
    });
    
    let displayScore = finalScore % 1 !== 0 ? finalScore.toFixed(2) : finalScore;
    let scoreHTML = `🏆 ${studentName}<br><span style="font-size: 24px;">Marks: ${displayScore} / ${currentQuiz.length}</span>`;
    
    if (isVanrakshak) {
        let negativeCut = (wrongCount * 0.25).toFixed(2);
        scoreHTML += `<br><span style="font-size: 15px; color: #ef4444; font-weight:600;">Right: ${rightCount} | Wrong: ${wrongCount} (-${negativeCut} Marks)</span>`;
    }

    document.getElementById('final-score').innerHTML = scoreHTML;
    switchScreen('result-screen');

    updateStudentStats(rightCount, attempted);
}

function updateStudentStats(right, attempted) {
    let stats = { tests: 0, totalRight: 0, totalAttempted: 0 };
    try {
        let saved = localStorage.getItem('studentStats');
        if (saved) stats = JSON.parse(saved);
        
        stats.tests += 1;
        stats.totalRight += right;
        stats.totalAttempted += attempted;
        
        localStorage.setItem('studentStats', JSON.stringify(stats));
    } catch(e) { console.log("Memory blocked for stats"); }
}

function loadDashboardStats() {
    let stats = { tests: 0, totalRight: 0, totalAttempted: 0 };
    try {
        let saved = localStorage.getItem('studentStats');
        if (saved) stats = JSON.parse(saved);
    } catch(e) {}
    
    document.getElementById('stat-tests').innerText = stats.tests;
    document.getElementById('stat-right').innerText = stats.totalRight;
    
    let acc = stats.totalAttempted > 0 ? Math.round((stats.totalRight / stats.totalAttempted) * 100) : 0;
    document.getElementById('stat-acc').innerText = `${acc}%`;
}

function login() {
    const n = document.getElementById('student-name').value;
    if(!n) return alert("Naam likhein");
    studentName = n; 
    try { localStorage.setItem('studentName', n); } catch(e) {} 
    showDashboard(n);
}

function showDashboard(n) { 
    document.getElementById('display-name').innerText = n; 
    loadDashboardStats(); 
    switchScreen('dashboard-screen'); 
}

function switchScreen(id) {
    ['login-screen', 'dashboard-screen', 'instructions-screen', 'quiz-screen', 'result-screen'].forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = (s === id) ? 'block' : 'none';
        if(id === 'dashboard-screen') document.getElementById('test-selector-modal').style.display = 'none';
    });
}

function logout() { 
    try { 
        localStorage.removeItem('studentName');
        localStorage.removeItem('studentStats');
    } catch(e) {}
    location.reload(); 
}

function goHome() {
    if (document.getElementById('quiz-screen').style.display === 'block') {
        let confirmExit = confirm("Are you sure you want to close your test?");
        if (confirmExit) {
            clearInterval(timer);
            switchScreen('dashboard-screen');
        }
    } else if (document.getElementById('result-screen').style.display === 'block' || document.getElementById('instructions-screen').style.display === 'block') {
        switchScreen('dashboard-screen');
    } else if (document.getElementById('test-selector-modal').style.display === 'flex') {
        closeTestSelector();
    }
}

function shareApp() {
    const shareData = {
        title: 'Paramount Academy App',
        text: '🔥 Free Online Mock Tests for Maths, Reasoning, GK & Science!',
        url: window.location.href
    };
    
    if (navigator.share) {
        navigator.share(shareData).catch(err => console.error(err));
    } else {
        navigator.clipboard.writeText(shareData.url).then(() => {
            alert("✅ App Link Copied! Ab ise WhatsApp par bhejein.");
        });
    }
}
