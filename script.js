document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const setupScreen = document.getElementById('setup-screen');
    const teamSelectionContainer = document.getElementById('team-selection');
    const raceScreen = document.getElementById('race-screen');
    const canvas = document.getElementById('race-track');
    const ctx = canvas.getContext('2d');

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

    // --- GAME CONFIGURATION ---
    const TOTAL_LAPS = 50;
    const CAR_COUNT = 20;

    const TEAMS = {
        "Mercedes": { color: "#00D2BE", basePace: 1.02 },
        "Red Bull": { color: "#0600EF", basePace: 1.03 },
        "Ferrari": { color: "#DC0000", basePace: 1.01 },
        "McLaren": { color: "#FF8700", basePace: 1.00 },
        // Add more teams
    };
    
    const TYRE_COMPOUNDS = {
        Soft:  { grip: 1.05, degradation: 0.007, color: 'red' },
        Medium:{ grip: 1.00, degradation: 0.004, color: 'yellow' },
        Hard:  { grip: 0.95, degradation: 0.002, color: 'white' }
    };

    const PUSH_LEVELS = {
        1: { name: "Conserve", paceEffect: 0.95, tyreEffect: 0.5 },
        2: { name: "Standard", paceEffect: 0.98, tyreEffect: 0.8 },
        3: { name: "Balanced", paceEffect: 1.00, tyreEffect: 1.0 },
        4: { name: "Pushing",  paceEffect: 1.02, tyreEffect: 1.5 },
        5: { name: "Attack",   paceEffect: 1.04, tyreEffect: 2.0 },
    };

    // --- GAME STATE ---
    let gameState = {
        raceActive: false,
        currentLap: 1,
        playerTeam: null,
        cars: [],
    };
    
    // --- TRACK DATA (Simple Oval for now) ---
    // An array of {x, y} points defining the center of the track.
    const trackPath = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radiusX = canvas.width / 2 - 50; // Horizontal radius
    const radiusY = canvas.height / 2 - 50; // Vertical radius
    for (let i = 0; i < 360; i++) {
        const angle = i * Math.PI / 180;
        const x = centerX + radiusX * Math.cos(angle);
        const y = centerY + radiusY * Math.sin(angle);
        trackPath.push({ x, y });
    }
    const TRACK_LENGTH = trackPath.length;

    // --- FUNCTIONS ---

    /**
     * Initializes the team selection screen.
     */
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

    /**
     * Handles the player selecting a team.
     * @param {string} teamName - The name of the selected team.
     */
    function selectTeam(teamName) {
        gameState.playerTeam = teamName;
        setupScreen.classList.add('hidden');
        raceScreen.classList.remove('hidden');
        initRace();
    }
    
    /**
     * Sets up the initial state of the race.
     */
    function initRace() {
        // Create all cars for the race
        gameState.cars = [];
        const teamNames = Object.keys(TEAMS);
        for (let i = 0; i < CAR_COUNT; i++) {
            const team = TEAMS[teamNames[i % teamNames.length]];
            const isPlayer = (i === 0 && TEAMS[gameState.playerTeam]);
            
            gameState.cars.push({
                id: i,
                isPlayer: isPlayer,
                team: isPlayer ? TEAMS[gameState.playerTeam] : team,
                driverName: isPlayer ? "YOU" : `Driver ${i+1}`,
                progress: TRACK_LENGTH - i * (TRACK_LENGTH / CAR_COUNT), // Staggered start
                lap: 1,
                speed: 0,
                tyre: { ...TYRE_COMPOUNDS.Medium, wear: 100 },
                pushLevel: 3,
                pitting: false,
                pitRequest: false,
                pitStopTime: 0,
            });
        }
        
        gameState.raceActive = true;
        gameLoop(); // Start the race
    }

    /**
     * The main game loop, powered by requestAnimationFrame for smooth animation.
     */
    function gameLoop() {
        if (!gameState.raceActive) return;

        updateState();
        render();

        requestAnimationFrame(gameLoop);
    }
    
    /**
     * Updates the state of all cars and game variables for a single frame.
     */
    function updateState() {
        gameState.cars.forEach(car => {
            if (car.pitting) {
                car.pitStopTime -= 1 / 60; // Assuming 60 FPS
                if (car.pitStopTime <= 0) {
                    car.pitting = false;
                    // Exit the pit lane
                }
                return; // Car is in pits, no movement
            }

            // AI Logic
            if (!car.isPlayer) {
                // Simple AI: Pit if tyres are very worn
                if (car.tyre.wear < 20 && !car.pitRequest) {
                    car.pitRequest = true;
                }
            }

            // Check for entering pit lane
            // The pit entry is at the "end" of the lap (progress ~ TRACK_LENGTH)
            if (car.pitRequest && car.progress >= TRACK_LENGTH - 10) {
                car.pitting = true;
                car.pitRequest = false;
                car.progress = 0; // Reset progress for pit lane time
                
                // Simulate pit stop logic
                if (car.isPlayer) {
                    // Player has to choose tyres
                    pitModal.classList.remove('hidden');
                    gameState.raceActive = false; // Pause game for player choice
                } else {
                    // AI chooses new tyres (e.g., Medium) and pit time
                    car.tyre = { ...TYRE_COMPOUNDS.Medium, wear: 100 };
                    car.pitStopTime = 3 + Math.random(); // 3-4 seconds
                }
            }

            // Calculate Speed: BasePace * TyreGrip * PushFactor * TyreWearFactor
            const push = PUSH_LEVELS[car.pushLevel];
            const wearFactor = 0.8 + (car.tyre.wear / 100) * 0.2; // Performance drops at low wear
            const speed = car.team.basePace * car.tyre.grip * push.paceEffect * wearFactor * 3; // Multiplier for visual speed
            car.speed = speed;

            // Update progress
            car.progress += car.speed;

            // Update tyre wear
            const wearRate = car.tyre.degradation * push.tyreEffect;
            car.tyre.wear -= wearRate;
            if (car.tyre.wear < 0) car.tyre.wear = 0;

            // Check for lap completion
            if (car.progress >= TRACK_LENGTH) {
                car.progress %= TRACK_LENGTH;
                car.lap++;
                if (car.lap > TOTAL_LAPS) {
                    // Race finished for this car
                }
            }
        });

        // Sort cars by lap and progress to determine positions
        gameState.cars.sort((a, b) => (b.lap - a.lap) || (b.progress - a.progress));
        updateUI();
    }

    /**
     * Renders the current game state onto the canvas and updates UI text.
     */
    function render() {
        // Clear canvas
        ctx.fillStyle = '#1a472a'; // Grass
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw track
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(trackPath[0].x, trackPath[0].y);
        for (let i = 1; i < trackPath.length; i++) {
            ctx.lineTo(trackPath[i].x, trackPath[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw start/finish line
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 5;
        ctx.beginPath();
        const p1 = trackPath[trackPath.length - 1];
        const p2 = trackPath[trackPath.length - 2];
        const angle = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        ctx.moveTo(p1.x - 20 * Math.sin(angle), p1.y + 20 * Math.cos(angle));
        ctx.lineTo(p1.x + 20 * Math.sin(angle), p1.y - 20 * Math.cos(angle));
        ctx.stroke();
        
        // Draw cars
        gameState.cars.forEach(car => {
            if (car.pitting) return; // Don't draw cars in the pits

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

    /**
     * Updates all the text elements in the UI panel.
     */
    function updateUI() {
        const playerCar = gameState.cars.find(c => c.isPlayer);
        if (!playerCar) return;

        const playerRank = gameState.cars.findIndex(c => c.isPlayer) + 1;

        lapCounter.textContent = `${playerCar.lap} / ${TOTAL_LAPS}`;
        playerPosition.textContent = `${playerRank} / ${CAR_COUNT}`;
        playerTyreCompound.textContent = Object.keys(TYRE_COMPOUNDS).find(key => TYRE_COMPOUNDS[key].color === playerCar.tyre.color);
        playerTyreWear.textContent = `${playerCar.tyre.wear.toFixed(1)}%`;
        playerPushText.textContent = PUSH_LEVELS[playerCar.pushLevel].name;

        // Update tyre wear color
        if (playerCar.tyre.wear > 60) playerTyreWear.style.color = 'lightgreen';
        else if (playerCar.tyre.wear > 30) playerTyreWear.style.color = 'orange';
        else playerTyreWear.style.color = 'red';
    }

    // --- EVENT LISTENERS ---
    
    // Player Push Level Change
    pushSlider.addEventListener('input', (e) => {
        const playerCar = gameState.cars.find(c => c.isPlayer);
        if (playerCar) {
            playerCar.pushLevel = parseInt(e.target.value);
            updateUI(); // Immediate feedback
        }
    });

    // Player requests a pit stop
    pitButton.addEventListener('click', () => {
        const playerCar = gameState.cars.find(c => c.isPlayer);
        if (playerCar && !playerCar.pitRequest) {
            playerCar.pitRequest = true;
            pitButton.textContent = "Pit Stop Requested";
            pitButton.disabled = true;
        }
    });

    // Player chooses tyres in the pit modal
    tyreChoices.addEventListener('click', (e) => {
        if (e.target.classList.contains('tyre-option')) {
            const chosenTyre = e.target.dataset.tyre;
            const playerCar = gameState.cars.find(c => c.isPlayer);
            
            // Apply new tyres
            playerCar.tyre = { ...TYRE_COMPOUNDS[chosenTyre], wear: 100 };
            playerCar.pitStopTime = 2.5 + Math.random() * 0.5; // Player team is fast!
            
            // Reset button and close modal
            pitButton.textContent = "Request Pit Stop";
            pitButton.disabled = false;
            pitModal.classList.add('hidden');
            
            // Resume the game
            gameState.raceActive = true;
            gameLoop();
        }
    });

    // --- START ---
    initSetup();
});
