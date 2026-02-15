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

window.onload = function() {
    document.getElementById('loading-overlay').style.display = 'flex';
    fetchData();
};

function fetchData() {
    console.log("Fetching Data...");
    fetch(API_URL).then(res => res.text()).then(data => {
        const json = JSON.parse(data.substring(47).slice(0, -2));
        allQuestions = json.table.rows.map(row => ({
            q: row.c[0]?.v, 
            opt: [row.c[1]?.v, row.c[2]?.v, row.c[3]?.v, row.c[4]?.v].filter(Boolean), 
            ans: row.c[5]?.v, 
            sub: row.c[6]?.v ? row.c[6].v.toString().trim() : "", 
            expl: row.c[7]?.v || "Vyakhya uplabdh nahi hai."
        })).filter(i => i.q && i.q !== "Question");
        
        console.log("Questions Loaded:", allQuestions.length);
        document.getElementById('loading-overlay').style.display = 'none';

        const saved = localStorage.getItem('studentName');
        if(saved) { studentName = saved; showDashboard(saved); }
        else { document.getElementById('login-screen').style.display = 'block'; }

    }).catch(err => {
        console.error("Error:", err);
        document.querySelector('.loading-text').innerText = "Internet Error! Please Refresh.";
        document.querySelector('.loading-text').style.color = "red";
    });
}

function openTestSelector(baseSubject, mins) {
    const availableTests = [...new Set(
        allQuestions.map(q => q.sub).filter(s => s.toLowerCase().includes(baseSubject.toLowerCase()))
    )].sort(); 

    if (availableTests.length === 0) return alert(`❌ '${baseSubject}' ke sawal abhi uplabdh nahi hain.`);

    if (availableTests.length === 1) { startQuiz(availableTests[0], mins); return; }

    const listContainer = document.getElementById('test-list-container');
    listContainer.innerHTML = "";
    document.getElementById('modal-subject-title').innerText = `Select ${baseSubject} Test`;

    availableTests.forEach(testName => {
        const btn = document.createElement('button');
        btn.className = 'test-list-btn';
        btn.innerText = `📝 ${testName}`; 
        btn.onclick = () => { closeTestSelector(); startQuiz(testName, mins); };
        listContainer.appendChild(btn);
    });

    document.getElementById('test-selector-modal').style.display = 'flex';
}

function closeTestSelector() { document.getElementById('test-selector-modal').style.display = 'none'; }

// ✅ Super Shuffle Function
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
    
    // Deep Copy banakar options aur questions ko shuffle karna
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
    document.getElementById('q-text').innerText = `Q.${currentIndex + 1} ${q.q}`;
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

function confirmSubmit() { if(confirm("Finish Test?")) endQuiz(); }

function endQuiz() {
    clearInterval(timer);
    let finalScore = 0;
    const revBox = document.getElementById('review-box');
    revBox.innerHTML = "";
    currentQuiz.forEach((q, i) => {
        const userAnswer = userAnswers[i] ? userAnswers[i].toString().trim().toLowerCase() : "";
        const correctAnswer = q.ans ? q.ans.toString().trim().toLowerCase() : "";
        const isCorrect = (userAnswer !== "" && userAnswer === correctAnswer);
        if(isCorrect) finalScore++;
        const card = document.createElement('div');
        card.className = `review-card ${isCorrect ? 'correct' : 'wrong'}`;
        card.innerHTML = `<b>Q.${i+1}: ${q.q}</b><br><span style="color:${isCorrect?'green':'red'}">Aapne: ${userAnswers[i] || 'Nahi kiya'}</span> | <span style="color:green; font-weight:bold;">Sahi: ${q.ans}</span><div class="expl-box">💡 ${q.expl}</div>`;
        revBox.appendChild(card);
    });
    document.getElementById('final-score').innerText = `Marks: ${finalScore} / ${currentQuiz.length}`;
    switchScreen('result-screen');
}

function login() {
    const n = document.getElementById('student-name').value;
    if(!n) return alert("Naam likhein");
    studentName = n; localStorage.setItem('studentName', n);
    showDashboard(n);
}

function showDashboard(n) { document.getElementById('display-name').innerText = n; switchScreen('dashboard-screen'); }

function switchScreen(id) {
    ['login-screen', 'dashboard-screen', 'quiz-screen', 'result-screen'].forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = (s === id) ? 'block' : 'none';
        if(id === 'dashboard-screen') document.getElementById('test-selector-modal').style.display = 'none';
    });
}

function logout() { localStorage.clear(); location.reload(); }

// ✅ KISI BHI PAGE SE BAHAR AANE KA NAYA FUNCTION (Close Button Logic)
function goHome() {
    // 1. Agar test chal raha hai
    if (document.getElementById('quiz-screen').style.display === 'block') {
        let confirmExit = confirm("Are you sure you want to close your test?");
        if (confirmExit) {
            clearInterval(timer); // Timer ko rok do
            switchScreen('dashboard-screen'); // Wapas home par bhejo
        }
    } 
    // 2. Agar Result Screen par hai
    else if (document.getElementById('result-screen').style.display === 'block') {
        switchScreen('dashboard-screen');
    }
    // 3. Agar Test Select karne wala Modal khula hai
    else if (document.getElementById('test-selector-modal').style.display === 'flex') {
        closeTestSelector();
    }
}
