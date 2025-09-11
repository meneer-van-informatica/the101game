from flask import Flask, jsonify
import hashlib
import time

app = Flask(__name__)

# Blockchain klasse
class Blockchain:
    def __init__(self):
        self.chain = []
        self.create_genesis_block()

    def create_genesis_block(self):
        """Maak het eerste blok, de 'genesis' blok"""
        genesis_block = Block(0, time.time(), "Genesis Block", "0")
        self.chain.append(genesis_block)

    def add_block(self, data):
        """Voeg een nieuw blok toe met gegevens"""
        last_block = self.chain[-1]
        new_block = Block(len(self.chain), time.time(), data, last_block.hash)
        self.chain.append(new_block)

    def print_chain(self):
        """Print de volledige blockchain"""
        for block in self.chain:
            print(f"Block {block.index}: {block.data} | Hash: {block.hash}")

# Block klasse
class Block:
    def __init__(self, index, timestamp, data, previous_hash):
        self.index = index
        self.timestamp = timestamp
        self.data = data
        self.previous_hash = previous_hash
        self.hash = self.calculate_hash()

    def calculate_hash(self):
        """Bereken de hash van het blok op basis van zijn inhoud"""
        value = f"{self.index}{self.timestamp}{self.data}{self.previous_hash}"
        return hashlib.sha256(value.encode('utf-8')).hexdigest()

# Maak de blockchain aan
game_chain = Blockchain()

@app.route('/')
def index():
    return "Welkom bij THE101GAME!"

@app.route('/add_block/<choice>', methods=['GET'])
def add_block(choice):
    """Voeg een keuze toe aan de blockchain"""
    game_chain.add_block(f"Speler kiest optie {choice}")
    return jsonify({
        "message": f"Keuze {choice} geregistreerd!",
        "blockchain": [block.data for block in game_chain.chain]
    })

# Voeg de impactlogica toe in de app.py
impact = 0

def update_impact(choice):
    global impact
    if choice == "A":
        impact += 1
    elif choice == "B":
        impact -= 1
    elif choice == "C":
        impact += 2


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0')
