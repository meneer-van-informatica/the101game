function startGame() {
    // Je logica om het spel te starten, bijvoorbeeld:
    alert('Het spel is begonnen!');
    // Je kunt de gebruiker ook doorsturen naar een andere pagina:
    // window.location.href = '/game'; 
}

function startGame() {
    // Verberg de landing page
    document.querySelector('.landing-page').style.display = 'none';
    
    // Toon het game scherm
    document.getElementById('gameScreen').style.display = 'flex';
}
