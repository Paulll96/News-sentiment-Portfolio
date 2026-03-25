from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

MODEL_NAME = "ProsusAI/finbert"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)

labels = ["Negative", "Neutral", "Positive"]

def analyze_sentiment(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True)
    outputs = model(**inputs)

    scores = torch.nn.functional.softmax(outputs.logits, dim=1)[0]
    scores = scores.detach().numpy()

    result = {
        "Negative": float(scores[0]),
        "Neutral": float(scores[1]),
        "Positive": float(scores[2])
    }

    sentiment = max(result, key=result.get)

    return sentiment, result
