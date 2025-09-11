import hashlib
import time

# De Blockchain klasse
class Blockchain:
    def __init__(self):
        self.chain = []
        self.create_genesis_block()  # Voeg de eerste blok toe

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


# De Block klasse
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
