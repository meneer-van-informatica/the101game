function stopGame() {
    // Stop de muziek als de speler stopt of het spel pauzeert
    const music = document.getElementById('backgroundMusic');
    music.pause();
    music.currentTime = 0;  // Zet de muziek terug naar het begin
}

