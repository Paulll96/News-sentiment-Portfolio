from flask import Flask, request, jsonify
from finbert import analyze_sentiment

app = Flask(__name__)

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    text = data.get("text", "")

    sentiment, probs = analyze_sentiment(text)
    confidence = max(probs.values())

    return jsonify({
    "sentiment": sentiment,
    "probabilities": probs,
    "confidence": confidence
})


if __name__ == "__main__":
    app.run(port=8000)
