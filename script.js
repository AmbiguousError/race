document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS & BOOTSTRAP ---
    const setupScreen = document.getElementById('setup-screen');
    const teamSelectionContainer = document.getElementById('team-selection');
    const raceScreen = document.getElementById('race-screen');
    const canvas = document.getElementById('race-track');
    const ctx = canvas.getContext('2d');
    const standingsContainer = document.getElementById('standings-container');
    const pitStopModal = new bootstrap.Modal(document.getElementById('pit-stop-modal'));

    // UI Panels
    const lapCounter = document.getElementById('lap-counter');
    const playerPosition = document.getElementById('player-position');
    const playerTyreCompound = document.getElementById('player-tyre-compound');
    const playerTyreWear = document.getElementById('player-tyre-wear');
    const playerPushText = document.getElementById('player-push-text');
    const pushSlider = document.getElementById('push-slider');
    const pitButton = document.getElementById('pit-button');
    const tyreChoices = document.getElementById('tyre-choices');
    
    // --- CONFIGURATION & STATE ---
    const trackImage = new Image();
    trackImage.src = 'assets/track.jpg';

    const TOTAL_LAPS = 50, CAR_COUNT = 20, FPS = 60;
    const ORIGINAL_CANVAS_WIDTH = 1000; // The width the coordinates were mapped to
    let scaleFactor = 1;

    const TEAMS = {
        "Mercedes": { color: "#00D2BE", basePace: 1.02 },
        "Red Bull": { color: "#0600EF", basePace: 1.03 },
        "Ferrari": { color: "#DC0000", basePace: 1.01 },
        "McLaren": { color: "#FF8700", basePace: 1.00 },
        "Aston Martin": { color: "#006F62", basePace: 0.99 },
        "Alpine": { color: "#0090FF", basePace: 0.98 },
    };
    
    const TYRE_COMPOUNDS = {
        Soft:  { grip: 1.05, degradation: 0.0075, color: 'red' },
        Medium:{ grip: 1.00, degradation: 0.0045, color: 'yellow' },
        Hard:  { grip: 0.95, degradation: 0.0025, color: 'white' }
    };

    const PUSH_LEVELS = {
        1: { name: "Conserve", paceEffect: 0.96, tyreEffect: 0.6 },
        2: { name: "Standard", paceEffect: 0.98, tyreEffect: 0.8 },
        3: { name: "Balanced", paceEffect: 1.00, tyreEffect: 1.0 },
        4: { name: "Pushing",  paceEffect: 1.02, tyreEffect: 1.5 },
        5: { name: "Attack",   paceEffect: 1.04, tyreEffect: 2.2 },
    };

    let gameState = { raceActive: false, playerTeam: null, cars: [] };
    
    // --- NEW, MORE ACCURATE TRACK COORDINATES ---
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

    // --- CORE FUNCTIONS ---
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
        const aspectRatio = 600 / 1000; // Original height / width
        
        canvas.width = container.clientWidth;
        canvas.height = container.clientWidth * aspectRatio;
        scaleFactor = canvas.width / ORIGINAL_CANVAS_WIDTH;
    }

    function selectTeam(teamName) {
        gameState.playerTeam = teamName;
        document.getElementById('setup-screen').classList.add('d-none');
        document.getElementById('race-screen').classList.remove('d-none');
        resizeCanvas();
        initRace();
    }

    function initRace() {
        gameState.cars = [];
        const teamNames = Object.keys(TEAMS);
        const playerTeamName = gameState.playerTeam;
        
        gameState.cars.push(createCar(0, playerTeamName, true));

        let teamIndex = 0;
        for (let i = 1; i < CAR_COUNT; i++) {
            if (teamNames[teamIndex] === playerTeamName) teamIndex++;
            const teamName = teamNames[teamIndex % teamNames.length];
            gameState.cars.push(createCar(i, teamName, false));
            teamIndex++;
        }
        
        gameState.raceActive = true;
        gameLoop();
    }
    
    function createCar(id, teamName, isPlayer) {
        return {
            id: id,
            isPlayer: isPlayer,
            team: TEAMS[teamName],
            driverName: isPlayer ? "YOU" : `Driver ${id+1}`,
            progress: TRACK_LENGTH - id * (TRACK_LENGTH / CAR_COUNT) * 0.5,
            lap: 1,
            speed: 0,
            tyre: { ...TYRE_COMPOUNDS.Medium, wear: 100, compoundName: 'Medium' },
            pushLevel: 3,
            pitting: false, pitRequest: false, pitStopTime: 0,
            totalProgress: 0, // Used for gap calculation
        };
    }

    function gameLoop() {
        if (!gameState.raceActive) return;
        updateState();
        render();
        requestAnimationFrame(gameLoop);
    }
    
    function updateState() {
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
            const speed = car.team.basePace * car.tyre.grip * push.paceEffect * wearFactor * 0.25; // SLOWED DOWN
            car.speed = speed;

            car.progress += car.speed;
            const wearRate = car.tyre.degradation * push.tyreEffect;
            car.tyre.wear -= wearRate;
            if (car.tyre.wear < 0) car.tyre.wear = 0;

            if (car.progress >= TRACK_LENGTH) {
                car.progress %= TRACK_LENGTH;
                car.lap++;
            }
            car.totalProgress = (car.lap -1) * TRACK_LENGTH + car.progress;
        });
        
        gameState.cars.sort((a, b) => b.totalProgress - a.totalProgress);
        updateUI();
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(trackImage, 0, 0, canvas.width, canvas.height);
        
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
        lapCounter.textContent = `${playerCar.lap} / ${TOTAL_LAPS}`;
        playerPosition.textContent = `${playerRank} / ${CAR_COUNT}`;
        playerTyreCompound.textContent = playerCar.tyre.compoundName;
        playerTyreWear.textContent = `${playerCar.tyre.wear.toFixed(1)}%`;
        playerPushText.textContent = PUSH_LEVELS[playerCar.pushLevel].name;
        if (playerCar.tyre.wear > 60) playerTyreWear.style.color = 'lightgreen';
        else if (playerCar.tyre.wear > 30) playerTyreWear.style.color = 'orange';
        else playerTyreWear.style.color = 'red';

        let tableHTML = `<table id="standings-table" class="table table-dark table-sm table-borderless"><thead><tr><th>Pos</th><th>Driver</th><th>Gap</th><th>Tyre</th></tr></thead><tbody>`;
        
        gameState.cars.forEach((car, index) => {
            let gapText = '';
            if (index > 0) {
                const carInFront = gameState.cars[index - 1];
                const progressDiff = carInFront.totalProgress - car.totalProgress;
                const gapInSeconds = (progressDiff / car.speed) / FPS;
                gapText = `+${gapInSeconds.toFixed(2)}s`;
            } else {
                gapText = "Interval";
            }
            
            const tyreColor = TYRE_COMPOUNDS[car.tyre.compoundName]?.color || 'gray';
            const playerClass = car.isPlayer ? 'player-row' : '';

            tableHTML += `<tr class="${playerClass}">
                <td>${index + 1}</td>
                <td>${car.driverName}</td>
                <td>${gapText}</td>
                <td><span class="tyre-indicator" style="background-color:${tyreColor};"></span>${car.tyre.compoundName[0]}</td>
            </tr>`;
        });

        tableHTML += `</tbody></table>`;
        standingsContainer.innerHTML = tableHTML;
    }

    // --- EVENT LISTENERS ---
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

    tyreChoices.addEventListener('click', (e) => {
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
    
    // --- START THE SIMULATION ---
    trackImage.onload = () => {
        initSetup();
    };
});
