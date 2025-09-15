from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return 'Welcome to the101game.io!'

@app.route('/load-tests')
def load_tests():
    # Mock-up test data (should be pulled from MongoDB or a dynamic source)
    tests = []
    for i in range(102):
        status = 'OK' if i % 2 == 0 else 'NO'
        progress = i * 1  # Example: increasing progress by test number
        tests.append({
            'test': f'test{str(i).zfill(3)}',
            'status': status,
            'progress': progress
        })
    return jsonify(tests)

if __name__ == '__main__':
    app.run(debug=True)
