            ctx.restore();
        };

        drawMarker(0, 'START/FINISH', 'white');
        drawMarker(TRACK_LENGTH - 10, 'PIT ENTRY', 'yellow');
        drawMarker(5, 'PIT EXIT', 'yellow');
        
        // --- Draw Cars ---
        gameState.cars.forEach(car => { if (car.pitting) return; const rawIdx = Math.floor(car.progress); const p1_idx = Math.max(0, rawIdx) % TRACK_LENGTH, p2_idx = (p1_idx + 1) % TRACK_LENGTH; const p1 = trackPath[p1_idx], p2 = trackPath[p2_idx]; if (!p1 || !p2) return; const segProg = car.progress - rawIdx; const pos = { x: p1.x + (p2.x - p1.x) * segProg, y: p1.y + (p2.y - p1.y) * segProg }; let carX = pos.x * scaleFactor, carY = pos.y * scaleFactor; if (Math.abs(car.lateralOffset) > 0) { const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x); const ox = -Math.sin(angle) * car.lateralOffset * scaleFactor, oy = Math.cos(angle) * car.lateralOffset * scaleFactor; carX += ox; carY += oy; } const r = 11 * scaleFactor; ctx.fillStyle = car.team.color; ctx.beginPath(); ctx.arc(carX, carY, r, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = 'black'; ctx.lineWidth = Math.max(1, 1.5 * scaleFactor); ctx.stroke(); const bright = (parseInt(car.team.color.substring(1,3), 16) * 0.299) + (parseInt(car.team.color.substring(3,5), 16) * 0.587) + (parseInt(car.team.color.substring(5,7), 16) * 0.114); ctx.fillStyle = bright > 128 ? 'black' : 'white'; ctx.font = `bold ${r * 0.9}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(car.initials, carX, carY); });
    }
    
    function updateUI() {
        const playerCar = gameState.cars.find(c => c.isPlayer);
        if (!playerCar) return;

        const playerRank = gameState.cars.findIndex(c => c.isPlayer) + 1;
        const totalLaps = 50; // Re-instating this for now as track-specific was removed

        playerDriverNameEl.textContent = playerCar.driverName;
        playerTeamNameEl.textContent = playerCar.teamName;
        lapCounter.textContent = `${playerCar.lap > totalLaps ? totalLaps : playerCar.lap} / ${totalLaps}`;
        playerPosition.textContent = `${playerRank} / ${CAR_COUNT}`;
        playerTyreCompound.textContent = playerCar.tyre.compoundName;
        playerTyreWear.textContent = `${playerCar.tyre.wear.toFixed(1)}%`;
        playerPushText.textContent = PUSH_LEVELS[playerCar.pushLevel].name;
        playerTyreWear.style.color = playerCar.tyre.wear > 60 ? 'lightgreen' : playerCar.tyre.wear > 30 ? 'orange' : 'red';

        let tableHTML = "";
        gameState.cars.forEach((car, index) => {
            let gapText = '';
            if (index > 0) {
                const carInFront = gameState.cars[index - 1];
                const diff = carInFront.totalProgress - car.totalProgress;
                const gapInSeconds = car.speed > 0 ? (diff / (car.speed * FPS)) * TIME_SCALE_FACTOR : 999;
                gapText = `+${gapInSeconds.toFixed(2)}s`;
            }
            const lastLapText = car.lastLapTime > 0 ? `${car.lastLapTime.toFixed(3)}s` : "-";
            const tyreColor = TYRE_COMPOUNDS[car.tyre.compoundName]?.color || 'gray';
            const playerClass = car.isPlayer ? 'player-row' : '';
            tableHTML += `<tr class="${playerClass}"><td>${index + 1}</td><td>${car.driverName}</td><td>${car.teamName}</td><td>${gapText}</td><td>${lastLapText}</td><td><span class="tyre-indicator" style="background-color:${tyreColor};"></span>${car.tyre.compoundName[0]}</td></tr>`;
        });
        standingsTableBody.innerHTML = tableHTML;
    }

    // --- EVENT LISTENERS ---
    audioToggleButton.addEventListener('click', () => { initAudio(); isMusicPlaying = !isMusicPlaying; if (isMusicPlaying) { audioCtx.resume(); playSong(); audioToggleButton.textContent = '🎵 Mute'; masterGain.gain.setValueAtTime(1, audioCtx.currentTime); } else { masterGain.gain.setValueAtTime(0, audioCtx.currentTime); audioToggleButton.textContent = '🎵 Unmute'; } });
    startingTyreChoices.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { if (isAudioInitialized && isMusicPlaying) { masterGain.gain.setValueAtTime(0, audioCtx.currentTime); isMusicPlaying = false; audioToggleButton.textContent = '🎵 Play Music'; audioToggleButton.disabled = true; } startRace(e.target.dataset.tyre); } });
    pushSlider.addEventListener('input', (e) => { const p = gameState.cars.find(c => c.isPlayer); if (p) p.pushLevel = parseInt(e.target.value); });
    pitButton.addEventListener('click', () => { const p = gameState.cars.find(c => c.isPlayer); if (p && !p.pitRequest && !p.pitting) { p.pitRequest = true; pitButton.textContent = "Pit Stop Requested"; pitButton.disabled = true; } });
    pitTyreChoices.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { const t = e.target.dataset.tyre; const p = gameState.cars.find(c => c.isPlayer); p.tyre = { ...TYRE_COMPOUNDS[t], wear: 100, compoundName: t }; p.pitStopTime = 19.5 + Math.random(); pitButton.textContent = "Request Pit Stop"; pitButton.disabled = false; pitStopModal.hide(); gameState.raceActive = true; gameLoop(); } });
    window.addEventListener('resize', resizeCanvas);
    
    // --- START ---
    initSetup();
});
