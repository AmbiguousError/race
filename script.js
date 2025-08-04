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
    trackImage.src = 'assets/track.jpg'; // Using .jpg as requested

    const TOTAL_LAPS = 50, CAR_COUNT = 20, FPS = 60;
    const ORIGINAL_CANVAS_WIDTH = 1000; // The width the coordinates were mapped to
    let scaleFactor = 1;

    // ... (TEAMS, TYRE_COMPOUNDS, PUSH_LEVELS objects remain the same as before)
    const TEAMS = { /* Omitted for brevity, same as before */ };
    const TYRE_COMPOUNDS = { /* Omitted for brevity, same as before */ };
    const PUSH_LEVELS = { /* Omitted for brevity, same as before */ };

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
        // ... (initRace and createCar functions are the same as before)
        // Omitted for brevity
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

            // --- Pit logic is the same, but uses the new Bootstrap modal ---
            if (car.pitRequest && car.progress >= TRACK_LENGTH - 10 && car.progress < TRACK_LENGTH) {
                car.pitting = true;
                car.pitRequest = false;
                
                if (car.isPlayer) {
                    pitStopModal.show(); // Use Bootstrap API
                    gameState.raceActive = false;
                } else {
                    const newTyre = car.tyre.wear < 15 ? 'Hard' : 'Medium';
                    car.tyre = { ...TYRE_COMPOUNDS[newTyre], wear: 100, compoundName: newTyre };
                    car.pitStopTime = 3 + Math.random();
                }
            }
            
            // --- SLOWED DOWN SPEED CALCULATION ---
            const push = PUSH_LEVELS[car.pushLevel];
            const wearFactor = 0.85 + (car.tyre.wear / 100) * 0.15;
            const speed = car.team.basePace * car.tyre.grip * push.paceEffect * wearFactor * 0.25; // SLOWER
            car.speed = speed;

            // ... (rest of the update logic is the same)
            // Omitted for brevity
        });
        
        gameState.cars.sort((a, b) => b.totalProgress - a.totalProgress);
        updateUI();
    }

    function render() {
        // Use the scaled width and height
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(trackImage, 0, 0, canvas.width, canvas.height);
        
        gameState.cars.forEach(car => {
            if (car.pitting) return;
            const posIndex = Math.floor(car.progress) % TRACK_LENGTH;
            const pos = trackPath[posIndex];
            
            // Apply scaleFactor to coordinates and car size
            const carX = pos.x * scaleFactor;
            const carY = pos.y * scaleFactor;
            const carRadius = 6 * scaleFactor;

            ctx.fillStyle = car.team.color;
            ctx.beginPath();
            ctx.arc(carX, carY, carRadius, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1 * scaleFactor;
            ctx.stroke();
        });
    }

    function updateUI() {
        // ... (This function is the same as the previous version, no changes needed)
        // Omitted for brevity
    }

    // --- EVENT LISTENERS ---
    
    // Tyre choice buttons in the modal
    tyreChoices.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const chosenTyre = e.target.dataset.tyre;
            const playerCar = gameState.cars.find(c => c.isPlayer);
            
            playerCar.tyre = { ...TYRE_COMPOUNDS[chosenTyre], wear: 100, compoundName: chosenTyre };
            playerCar.pitStopTime = 2.5 + Math.random() * 0.5;
            
            pitButton.textContent = "Request Pit Stop";
            pitButton.disabled = false;
            pitStopModal.hide(); // Use Bootstrap API
            
            gameState.raceActive = true;
            gameLoop();
        }
    });

    window.addEventListener('resize', resizeCanvas);
    
    // ... (All other event listeners and the initSetup() function are the same)
    // Omitted for brevity

    // --- START ---
    trackImage.onload = () => {
        // Find the full, non-omitted script to add back the missing functions and objects
        // and then call initSetup();
    };
});
// NOTE: For this script to be fully functional, you must re-insert the object definitions 
// and functions that were marked as "Omitted for brevity" from the previous answer.
