document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS & BOOTSTRAP ---
    const setupScreen = document.getElementById('setup-screen');
    const teamSelectionView = document.getElementById('team-selection-view');
    const teamSelectionContainer = document.getElementById('team-selection');
    const tyreSelectionView = document.getElementById('tyre-selection-view');
    const startingTyreChoices = document.getElementById('starting-tyre-choices');
    const audioToggleButton = document.getElementById('audio-toggle-button');
    const raceScreen = document.getElementById('race-screen');
    const canvas = document.getElementById('race-track');
    const ctx = canvas.getContext('2d');
    const standingsTableBody = document.querySelector("#standings-table tbody");
    const pitStopModal = new bootstrap.Modal(document.getElementById('pit-stop-modal'));
    const raceFinishModal = new bootstrap.Modal(document.getElementById('race-finish-modal'));
    const winnerNameEl = document.getElementById('winner-name');
    const lapCounter = document.getElementById('lap-counter');
    const playerPosition = document.getElementById('player-position');
    const playerTyreCompound = document.getElementById('player-tyre-compound');
    const playerTyreWear = document.getElementById('player-tyre-wear');
    const playerPushText = document.getElementById('player-push-text');
    const pushSlider = document.getElementById('push-slider');
    const pitButton = document.getElementById('pit-button');
    const pitTyreChoices = document.getElementById('pit-tyre-choices');

    // =======================================================================
    // --- WEB AUDIO MUSIC ENGINE ---
    // =======================================================================
    let audioCtx;
    let masterGain;
    let isAudioInitialized = false;
    let isMusicPlaying = false;
    
    const NOTE_FREQUENCIES = {
        'G3': 196.00, 'A3': 220.00, 'Asharp3': 233.08, 
        'C4': 261.63, 'Dsharp4': 311.13, 'G4': 392.00, 
        'Gsharp4': 415.30, 'Asharp4': 466.16,
    };

    const BPM = 124; 
    const BEAT_DURATION = 60 / BPM;

    const MELODY = [
        { note: 'G3', duration: 0.25 }, { note: 'C4', duration: 0.25 }, { note: 'Dsharp4', duration: 0.25 }, { note: 'G4', duration: 0.25 },
        { note: 'G3', duration: 0.25 }, { note: 'C4', duration: 0.25 }, { note: 'Dsharp4', duration: 0.25 }, { note: 'Asharp4', duration: 0.25 },
        { note: 'G3', duration: 0.25 }, { note: 'C4', duration: 0.25 }, { note: 'Dsharp4', duration: 0.25 }, { note: 'G4', duration: 0.25 },
        { note: 'G3', duration: 0.25 }, { note: 'C4', duration: 0.25 }, { note: 'Dsharp4', duration: 0.25 }, { note: 'Gsharp4', duration: 0.25 },
        { note: 'G3', duration: 0.25 }, { note: 'C4', duration: 0.25 }, { note: 'Dsharp4', duration: 0.25 }, { note: 'G4', duration: 0.25 },
        { note: 'G3', duration: 0.25 }, { note: 'C4', duration: 0.25 }, { note: 'Dsharp4', duration: 0.25 }, { note: 'Asharp4', duration: 0.25 },
        { note: 'G3', duration: 0.25 }, { note: 'C4', duration: 0.25 }, { note: 'Dsharp4', duration: 0.25 }, { note: 'G4', duration: 0.25 },
        { note: 'G3', duration: 0.25 }, { note: 'C4', duration: 0.25 }, { note: 'Dsharp4', duration: 0.25 }, { note: 'Gsharp4', duration: 0.25 },
    ];

    function initAudio() {
        if (isAudioInitialized) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
        masterGain.gain.value = 1;
        isAudioInitialized = true;
    }

    function playNote(note, startTime, duration) {
        if (!audioCtx) return;
        const frequency = NOTE_FREQUENCIES[note];
        if (!frequency) return;

        const oscillator = audioCtx.createOscillator();
        const noteGain = audioCtx.createGain();
        oscillator.connect(noteGain);
        noteGain.connect(masterGain);
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        noteGain.gain.setValueAtTime(0, startTime);
        noteGain.gain.linearRampToValueAtTime(0.5, startTime + 0.01);
        noteGain.gain.linearRampToValueAtTime(0, startTime + duration);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }

    function playSong() {
        if (!isAudioInitialized || !isMusicPlaying) return;
        let currentTime = audioCtx.currentTime;
        MELODY.forEach(noteInfo => {
            const noteDuration = noteInfo.duration * BEAT_DURATION;
            playNote(noteInfo.note, currentTime, noteDuration);
            currentTime += noteDuration;
        });
        const songDuration = currentTime - audioCtx.currentTime;
        setTimeout(playSong, songDuration * 1000);
    }

    // =======================================================================
    // --- SIMULATOR CODE ---
    // =======================================================================
    
    const TOTAL_LAPS = 50, CAR_COUNT = 20, FPS = 60;
    const ORIGINAL_CANVAS_WIDTH = 1000;
    let scaleFactor = 1;
    let selectedTeamName = '';

    const TEAMS = {
        "Ferrari": { color: "#DC0000", basePace: 1.02, drivers: ["Leclerc", "Hamilton"] },
        "Red Bull": { color: "#0600EF", basePace: 1.03, drivers: ["Verstappen", "Perez"] },
        "McLaren": { color: "#FF8700", basePace: 1.015, drivers: ["Norris", "Piastri"] },
        "Mercedes": { color: "#00D2BE", basePace: 1.00, drivers: ["Russell", "Antonelli"] },
        "Aston Martin": { color: "#006F62", basePace: 0.99, drivers: ["Alonso", "Stroll"] },
        "Audi": { color: "#D90000", basePace: 0.97, drivers: ["Hulkenberg", "Sainz"] },
        "Alpine": { color: "#0090FF", basePace: 0.96, drivers: ["Gasly", "Doohan"] },
        "Williams": { color: "#005AFF", basePace: 0.95, drivers: ["Albon", "Bottas"] },
        "Haas": { color: "#BDBDBD", basePace: 0.94, drivers: ["Bearman", "Ocon"] },
        "RB": { color: "#003060", basePace: 0.965, drivers: ["Tsunoda", "Lawson"]},
    };
    
        const TYRE_COMPOUNDS = {
        Soft:  { grip: 1.06, degradation: 0.0190, color: 'red' },
        Medium:{ grip: 1.00, degradation: 0.0105, color: 'yellow' },
        Hard:  { grip: 0.92, degradation: 0.0060, color: 'white' }
    };


    const PUSH_LEVELS = {
        1: { name: "Conserve", paceEffect: 0.96, tyreEffect: 0.6 },
        2: { name: "Standard", paceEffect: 0.98, tyreEffect: 0.8 },
        3: { name: "Balanced", paceEffect: 1.00, tyreEffect: 1.0 },
        4: { name: "Pushing",  paceEffect: 1.02, tyreEffect: 1.5 },
        5: { name: "Attack",   paceEffect: 1.04, tyreEffect: 2.2 },
    };

    let gameState = { raceActive: false, raceFinished: false, raceTime: 0, cars: [] };
    
    const trackPath = [
        {x:864, y:500}, {x:864, y:409}, {x:864, y:318}, {x:864, y:227}, {x:864, y:136}, 
        {x:854, y:91}, {x:828, y:62}, {x:787, y:48}, {x:741, y:51}, {x:700, y:70}, 
        {x:672, y:98}, {x:658, y:139}, {x:653, y:230}, {x:648, y:321}, {x:643, y:412}, 
        {x:628, y:456}, {x:594, y:478}, {x:546, y:476}, {x:504, y:452}, {x:479, y:412}, 
        {x:477, y:361}, {x:496, y:320}, {x:524, y:286}, {x:534, y:241}, {x:520, y:204}, 
        {x:483, y:180}, {x:436, y:182}, {x:387, y:206}, {x:344, y:244}, {x:304, y:286}, 
        {x:248, y:292}, {x:192, y:298}, {x:141, y:316}, {x:104, y:352}, {x:84, y:404}, 
        {x:86, y:458}, {x:112, y:508}, {x:154, y:542}, {x:214, y:558}, {x:306, y:564}, 
        {x:398, y:564}, {x:490, y:564}, {x:552, y:544}, {x:591, y:520}, {x:644, y:514}, 
        {x:736, y:514}, {x:828, y:508}
    ];
    const TRACK_LENGTH = trackPath.length;

    function initSetup() {
        for (const teamName in TEAMS) {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-light';
            button.innerText = teamName;
            button.style.setProperty('--bs-btn-border-color', TEAMS[teamName].color);
            button.style.setProperty('--bs-btn-hover-bg', TEAMS[teamName].color);
            button.addEventListener('click', () => selectTeam(teamName));
            teamSelectionContainer.appendChild(button);
        }
    }

    function resizeCanvas() {
        const container = document.getElementById('race-container');
        const aspectRatio = 600 / 1000;
        canvas.width = container.clientWidth;
        canvas.height = container.clientWidth * aspectRatio;
        scaleFactor = canvas.width / ORIGINAL_CANVAS_WIDTH;
    }

    function selectTeam(teamName) {
        selectedTeamName = teamName;
        teamSelectionView.classList.add('d-none');
        tyreSelectionView.classList.remove('d-none');
    }

    function startRace(startingTyre) {
        setupScreen.classList.add('d-none');
        raceScreen.classList.remove('d-none');
        resizeCanvas();
        initRace(startingTyre);
    }

    function initRace(playerTyre) {
        gameState.cars = [];
        let driverPool = [];
        for(const team in TEAMS) {
            TEAMS[team].drivers.forEach(driver => driverPool.push({ team, driver }));
        }
        
        const playerDriver = TEAMS[selectedTeamName].drivers[0];
        gameState.cars.push(createCar(0, selectedTeamName, playerDriver, true, playerTyre));
        driverPool = driverPool.filter(d => d.driver !== playerDriver);

        for (let i = 1; i < CAR_COUNT; i++) {
            const driverInfo = driverPool[i % driverPool.length];
            const aiTyres = ['Soft', 'Medium', 'Hard'];
            const randomTyre = aiTyres[Math.floor(Math.random() * aiTyres.length)];
            gameState.cars.push(createCar(i, driverInfo.team, driverInfo.driver, false, randomTyre));
        }
        
        gameState.raceActive = true;
        gameLoop();
    }
    
    function createCar(id, teamName, driverName, isPlayer, startingTyre) {
        return {
            id, isPlayer, teamName, driverName,
            team: TEAMS[teamName],
            progress: TRACK_LENGTH - id * (TRACK_LENGTH / CAR_COUNT) * 0.5,
            lap: 1, speed: 0, pushLevel: 3,
            tyre: { ...TYRE_COMPOUNDS[startingTyre], wear: 100, compoundName: startingTyre },
            pitting: false, pitRequest: false, pitStopTime: 0,
            totalProgress: 0,
            lapStartTime: 0,
            lastLapTime: 0,
        };
    }

    function gameLoop() {
        if (!gameState.raceActive) return;
        gameState.raceTime += 1 / FPS;
        updateState();
        render();
        requestAnimationFrame(gameLoop);
    }
    
    function updateState() {
        if (gameState.raceFinished) return;

        gameState.cars.forEach(car => {
            if (car.pitting) {
                car.pitStopTime -= 1 / FPS;
                if (car.pitStopTime <= 0) car.pitting = false;
                return;
            }
            if (!car.isPlayer) {
                if ((car.tyre.wear < 25 || (car.tyre.compoundName === 'Soft' && car.tyre.wear < 40)) && !car.pitRequest) {
                    car.pitRequest = true;
                }
            }
            if (car.pitRequest && car.progress >= TRACK_LENGTH - 10 && car.progress < TRACK_LENGTH) {
                car.pitting = true;
                car.pitRequest = false;
                if (car.isPlayer) {
                    pitStopModal.show();
                    gameState.raceActive = false;
                } else {
                    const newTyre = car.tyre.wear < 15 ? 'Hard' : 'Medium';
                    car.tyre = { ...TYRE_COMPOUNDS[newTyre], wear: 100, compoundName: newTyre };
                    car.pitStopTime = 3 + Math.random();
                }
            }
            const push = PUSH_LEVELS[car.pushLevel];
            const wearFactor = 0.85 + (car.tyre.wear / 100) * 0.15;
            const speed = car.team.basePace * car.tyre.grip * push.paceEffect * wearFactor * 0.15;
            car.speed = speed;
            car.progress += car.speed;
            const wearRate = car.tyre.degradation * push.tyreEffect;
            car.tyre.wear -= wearRate;
            if (car.tyre.wear < 0) car.tyre.wear = 0;

            if (car.progress >= TRACK_LENGTH) {
                car.progress %= TRACK_LENGTH;
                car.lap++;

                if (car.lap > 1) {
                    car.lastLapTime = gameState.raceTime - car.lapStartTime;
                }
                car.lapStartTime = gameState.raceTime;

                const leader = gameState.cars.find(c => c.isPlayer) || gameState.cars[0];
                if (leader.lap > TOTAL_LAPS) {
                    endRace(gameState.cars[0]);
                }
            }
            car.totalProgress = (car.lap - 1) * TRACK_LENGTH + car.progress;
        });
        gameState.cars.sort((a, b) => b.totalProgress - a.totalProgress);
        updateUI();
    }

    function endRace(winner) {
        if (gameState.raceFinished) return;
        gameState.raceActive = false;
        gameState.raceFinished = true;
        winnerNameEl.textContent = winner.driverName;
        raceFinishModal.show();
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 24 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(trackPath[0].x * scaleFactor, trackPath[0].y * scaleFactor);
        for(let i = 1; i < trackPath.length; i++) ctx.lineTo(trackPath[i].x * scaleFactor, trackPath[i].y * scaleFactor);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 20 * scaleFactor;
        ctx.stroke();
        gameState.cars.forEach(car => {
            if (car.pitting) return;
            const posIndex = Math.floor(car.progress) % TRACK_LENGTH;
            const pos = trackPath[posIndex];
            const carX = pos.x * scaleFactor;
            const carY = pos.y * scaleFactor;
            const carRadius = 6 * scaleFactor;
            ctx.fillStyle = car.team.color;
            ctx.beginPath();
            ctx.arc(carX, carY, carRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = Math.max(1, 1 * scaleFactor);
            ctx.stroke();
        });
    }

    function updateUI() {
        const playerCar = gameState.cars.find(c => c.isPlayer);
        if (!playerCar) return;

        const playerRank = gameState.cars.findIndex(c => c.isPlayer) + 1;
        lapCounter.textContent = `${playerCar.lap > TOTAL_LAPS ? TOTAL_LAPS : playerCar.lap} / ${TOTAL_LAPS}`;
        playerPosition.textContent = `${playerRank} / ${CAR_COUNT}`;
        playerTyreCompound.textContent = playerCar.tyre.compoundName;
        playerTyreWear.textContent = `${playerCar.tyre.wear.toFixed(1)}%`;
        playerPushText.textContent = PUSH_LEVELS[playerCar.pushLevel].name;
        if (playerCar.tyre.wear > 60) playerTyreWear.style.color = 'lightgreen';
        else if (playerCar.tyre.wear > 30) playerTyreWear.style.color = 'orange';
        else playerTyreWear.style.color = 'red';

        let tableHTML = "";
        gameState.cars.forEach((car, index) => {
            let gapText = '';
            if (index > 0) {
                const carInFront = gameState.cars[index - 1];
                const progressDiff = carInFront.totalProgress - car.totalProgress;
                const gapInSeconds = car.speed > 0 ? (progressDiff / car.speed) / FPS : 999;
                gapText = `+${gapInSeconds.toFixed(2)}s`;
            }
            const lastLapText = car.lastLapTime > 0 ? `${car.lastLapTime.toFixed(3)}s` : "-";
            const tyreColor = TYRE_COMPOUNDS[car.tyre.compoundName]?.color || 'gray';
            const playerClass = car.isPlayer ? 'player-row' : '';
            tableHTML += `<tr class="${playerClass}">
                <td>${index + 1}</td>
                <td>${car.driverName.substring(0, 10)}</td>
                <td>${car.teamName}</td>
                <td>${gapText}</td>
                <td>${lastLapText}</td>
                <td><span class="tyre-indicator" style="background-color:${tyreColor};"></span>${car.tyre.compoundName[0]}</td>
            </tr>`;
        });
        standingsTableBody.innerHTML = tableHTML;
    }

    // --- EVENT LISTENERS ---
    audioToggleButton.addEventListener('click', () => {
        initAudio();
        isMusicPlaying = !isMusicPlaying;
        if (isMusicPlaying) {
            audioCtx.resume();
            playSong();
            audioToggleButton.textContent = '🎵 Mute';
            masterGain.gain.setValueAtTime(1, audioCtx.currentTime);
        } else {
            masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
            audioToggleButton.textContent = '🎵 Unmute';
        }
    });

    startingTyreChoices.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            if(isAudioInitialized && isMusicPlaying) {
                masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
                isMusicPlaying = false;
                audioToggleButton.textContent = '🎵 Play Music';
                audioToggleButton.disabled = true;
            }
            startRace(e.target.dataset.tyre);
        }
    });

    pushSlider.addEventListener('input', (e) => {
        const playerCar = gameState.cars.find(c => c.isPlayer);
        if (playerCar) playerCar.pushLevel = parseInt(e.target.value);
    });

    pitButton.addEventListener('click', () => {
        const playerCar = gameState.cars.find(c => c.isPlayer);
        if (playerCar && !playerCar.pitRequest && !playerCar.pitting) {
            playerCar.pitRequest = true;
            pitButton.textContent = "Pit Stop Requested";
            pitButton.disabled = true;
        }
    });

    pitTyreChoices.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const chosenTyre = e.target.dataset.tyre;
            const playerCar = gameState.cars.find(c => c.isPlayer);
            playerCar.tyre = { ...TYRE_COMPOUNDS[chosenTyre], wear: 100, compoundName: chosenTyre };
            playerCar.pitStopTime = 2.5 + Math.random() * 0.5;
            pitButton.textContent = "Request Pit Stop";
            pitButton.disabled = false;
            pitStopModal.hide();
            gameState.raceActive = true;
            gameLoop();
        }
    });

    window.addEventListener('resize', resizeCanvas);
    
    // --- START ---
    initSetup();
});
