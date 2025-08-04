document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const setupScreen = document.getElementById('setup-screen');
    const teamSelectionContainer = document.getElementById('team-selection');
    const raceScreen = document.getElementById('race-screen');
    const canvas = document.getElementById('race-track');
    const ctx = canvas.getContext('2d');
    const standingsContainer = document.getElementById('standings-container');

    // UI Panels
    const lapCounter = document.getElementById('lap-counter');
    const playerPosition = document.getElementById('player-position');
    const playerTyreCompound = document.getElementById('player-tyre-compound');
    const playerTyreWear = document.getElementById('player-tyre-wear');
    const playerPushText = document.getElementById('player-push-text');
    const pushSlider = document.getElementById('push-slider');
    const pitButton = document.getElementById('pit-button');
    
    // Pit Modal
    const pitModal = document.getElementById('pit-modal');
    const tyreChoices = document.getElementById('tyre-choices');
    
    // Track Image
    const trackImage = new Image();
    trackImage.src = 'assets/track.png';

    // --- GAME CONFIGURATION ---
    const TOTAL_LAPS = 50;
    const CAR_COUNT = 20;
    const FPS = 60; // For gap calculations

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

    // --- GAME STATE ---
    let gameState = {
        raceActive: false,
        playerTeam: null,
        cars: [],
    };
    
    // --- TRACK DATA ---
    const trackPath = [
        { x: 865, y: 485 }, { x: 865, y: 400 }, { x: 865, y: 300 }, { x: 865, y: 200 },
        { x: 860, y: 125 }, { x: 835, y: 80  }, { x: 790, y: 55  }, { x: 740, y: 50  },
        { x: 690, y: 60  }, { x: 655, y: 85  }, { x: 650, y: 150 }, { x: 648, y: 250 },
        { x: 645, y: 350 }, { x: 640, y: 430 }, { x: 620, y: 465 }, { x: 580, y: 480 },
        { x: 530, y: 470 }, { x: 490, y: 440 }, { x: 470, y: 390 }, { x: 480, y: 340 },
        { x: 510, y: 300 }, { x: 535, y: 265 }, { x: 530, y: 220 }, { x: 495, y: 185 },
        { x: 440, y: 180 }, { x: 380, y: 200 }, { x: 330, y: 240 }, { x: 280, y: 280 },
        { x: 200, y: 285 }, { x: 150, y: 295 }, { x: 110, y: 325 }, { x: 80,  y: 375 },
        { x: 75,  y: 435 }, { x: 90,  y: 485 }, { x: 125, y: 525 }, { x: 175, y: 550 },
        { x: 250, y: 555 }, { x: 350, y: 560 }, { x: 450, y: 565 }, { x: 520, y: 555 },
        { x: 565, y: 525 }, { x: 630, y: 520 }, { x: 700, y: 515 }, { x: 800, y: 500 },
    ];
    const TRACK_LENGTH = trackPath.length;

    // --- FUNCTIONS ---

    function initSetup() {
        for (const teamName in TEAMS) {
            const button = document.createElement('button');
            button.className = 'team-button';
            button.innerText = teamName;
            button.style.borderColor = TEAMS[teamName].color;
            button.addEventListener('click', () => selectTeam(teamName));
            teamSelectionContainer.appendChild(button);
        }
    }

    function selectTeam(teamName) {
        gameState.playerTeam = teamName;
        setupScreen.classList.add('hidden');
        raceScreen.classList.remove('hidden');
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
                    pitModal.classList.remove('hidden');
                    gameState.raceActive = false;
                } else {
                    const newTyre = car.tyre.wear < 15 ? 'Hard' : 'Medium';
                    car.tyre = { ...TYRE_COMPOUNDS[newTyre], wear: 100, compoundName: newTyre };
                    car.pitStopTime = 3 + Math.random();
                }
            }

            const push = PUSH_LEVELS[car.pushLevel];
            const wearFactor = 0.85 + (car.tyre.wear / 100) * 0.15;
            const speed = car.team.basePace * car.tyre.grip * push.paceEffect * wearFactor * 0.8;
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
            
            ctx.fillStyle = car.team.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    function updateUI() {
        const playerCar = gameState.cars.find(c => c.isPlayer);
        if (!playerCar) return;

        // Update player status panel
        const playerRank = gameState.cars.findIndex(c => c.isPlayer) + 1;
        lapCounter.textContent = `${playerCar.lap} / ${TOTAL_LAPS}`;
        playerPosition.textContent = `${playerRank} / ${CAR_COUNT}`;
        playerTyreCompound.textContent = playerCar.tyre.compoundName;
        playerTyreWear.textContent = `${playerCar.tyre.wear.toFixed(1)}%`;
        playerPushText.textContent = PUSH_LEVELS[playerCar.pushLevel].name;
        if (playerCar.tyre.wear > 60) playerTyreWear.style.color = 'lightgreen';
        else if (playerCar.tyre.wear > 30) playerTyreWear.style.color = 'orange';
        else playerTyreWear.style.color = 'red';

        // Update live standings table
        let tableHTML = `<table id="standings-table"><thead><tr><th>Pos</th><th>Driver</th><th>Gap</th><th>Tyre</th></tr></thead><tbody>`;
        const leader = gameState.cars[0];

        gameState.cars.forEach((car, index) => {
            let gapText = '';
            if (index > 0) {
                const carInFront = gameState.cars[index - 1];
                const progressDiff = carInFront.totalProgress - car.totalProgress;
                // Convert progress difference to time. (distance / speed) / framerate
                const gapInSeconds = (progressDiff / car.speed) / FPS;
                gapText = `+${gapInSeconds.toFixed(2)}s`;
            } else {
                gapText = "Interval";
            }
            
            const tyreColor = car.tyre.compoundName === 'Soft' ? 'red' : car.tyre.compoundName === 'Medium' ? 'yellow' : 'white';
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
        if (e.target.classList.contains('tyre-option')) {
            const chosenTyre = e.target.dataset.tyre;
            const playerCar = gameState.cars.find(c => c.isPlayer);
            
            playerCar.tyre = { ...TYRE_COMPOUNDS[chosenTyre], wear: 100, compoundName: chosenTyre };
            playerCar.pitStopTime = 2.5 + Math.random() * 0.5;
            
            pitButton.textContent = "Request Pit Stop";
            pitButton.disabled = false;
            pitModal.classList.add('hidden');
            
            gameState.raceActive = true;
            gameLoop();
        }
    });

    // --- START THE SIMULATION ---
    trackImage.onload = () => {
        initSetup();
    };
});
